import { NextResponse } from "next/server";

import { assembleEvidenceBundle } from "@/lib/orchestrate";
import {
  SSE_RESPONSE_HEADERS,
  encodeSseComment,
  encodeSseEvent,
  type BriefStreamEvent,
} from "@/lib/stream";
import {
  SynthesisValidationError,
  synthesiseBrief,
} from "@/lib/synthesise";

export const maxDuration = 300;

interface BriefRequestBody {
  efoId?: unknown;
  input?: unknown;
}

const KEEP_ALIVE_INTERVAL_MS = 15_000;

export async function POST(request: Request) {
  let body: BriefRequestBody;

  try {
    body = (await request.json()) as BriefRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  if (typeof body.efoId !== "string") {
    return NextResponse.json(
      {
        ok: false,
        error: "efoId must be a string.",
      },
      { status: 400 },
    );
  }

  const efoId = body.efoId.trim();

  if (!efoId) {
    return NextResponse.json(
      {
        ok: false,
        error: "efoId must not be empty.",
      },
      { status: 400 },
    );
  }

  if (
    body.input !== undefined &&
    typeof body.input !== "string"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "input must be a string when provided.",
      },
      { status: 400 },
    );
  }

  const trimmedInput = body.input?.trim();
  const input = trimmedInput || undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let streamOpen = true;

      function send(
        event: BriefStreamEvent,
      ): void {
        if (!streamOpen) {
          return;
        }

        try {
          controller.enqueue(
            encodeSseEvent(event),
          );
        } catch {
          streamOpen = false;
        }
      }

      function sendKeepAlive(): void {
        if (!streamOpen) {
          return;
        }

        try {
          controller.enqueue(
            encodeSseComment(),
          );
        } catch {
          streamOpen = false;
        }
      }

      function closeStream(): void {
        if (!streamOpen) {
          return;
        }

        streamOpen = false;

        try {
          controller.close();
        } catch {
          // The client may already have disconnected.
        }
      }

      const keepAliveTimer = setInterval(
        sendKeepAlive,
        KEEP_ALIVE_INTERVAL_MS,
      );

      request.signal.addEventListener(
        "abort",
        closeStream,
        { once: true },
      );

      send({
        type: "started",
        efoId,
        input: input ?? null,
      });

      void (async () => {
        try {
          let evidenceBundle;

          try {
            evidenceBundle =
              await assembleEvidenceBundle({
                efoId,
                input,
                progress: {
                  onTargetsFound: (
                    progress,
                  ) => {
                    send({
                      type: "targets_found",
                      disease:
                        progress.disease,
                      targetCount:
                        progress.targetCount,
                      targets:
                        progress.targets,
                    });
                  },
                  onTargetComplete: (
                    progress,
                  ) => {
                    send({
                      type: "target_complete",
                      ensemblId:
                        progress.ensemblId,
                      symbol:
                        progress.symbol,
                      completed:
                        progress.completed,
                      total:
                        progress.total,
                    });
                  },
                },
              });
          } catch (error) {
            console.error(
              "Evidence bundle assembly failed:",
              error,
            );

            send({
              type: "error",
              code: "evidence_failed",
              message:
                "Couldn't gather the target evidence just now.",
            });

            return;
          }

          if (!evidenceBundle) {
            send({
              type: "error",
              code: "disease_not_found",
              message:
                "No matching disease was found.",
            });

            return;
          }

          send({
            type: "evidence_complete",
            targetCount:
              evidenceBundle.targets.length,
          });

          send({
            type: "synthesising",
          });

          try {
            const brief =
              await synthesiseBrief(
                evidenceBundle,
              );

            send({
              type: "complete",
              brief,
            });
          } catch (error) {
            if (
              error instanceof
              SynthesisValidationError
            ) {
              console.error(
                "Brief synthesis validation failed:",
                error.validationErrors,
              );

              send({
                type: "error",
                code:
                  "synthesis_validation_failed",
                message:
                  "The generated brief did not pass validation.",
                validationErrors:
                  error.validationErrors,
              });

              return;
            }

            console.error(
              "Brief synthesis failed:",
              error,
            );

            send({
              type: "error",
              code: "synthesis_failed",
              message:
                "Couldn't synthesise the target brief just now.",
            });
          }
        } finally {
          clearInterval(keepAliveTimer);
          closeStream();
        }
      })();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: SSE_RESPONSE_HEADERS,
  });
}