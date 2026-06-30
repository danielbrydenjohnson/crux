import type { Brief } from "@/lib/types";

export const SSE_RESPONSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

export type BriefStreamErrorCode =
  | "invalid_request"
  | "disease_not_found"
  | "evidence_failed"
  | "synthesis_validation_failed"
  | "synthesis_failed";

export type BriefStreamEvent =
  | {
      type: "started";
      efoId: string;
      input: string | null;
    }
  | {
      type: "targets_found";
      disease: {
        efoId: string;
        name: string;
      };
      targetCount: number;
      totalTargetsAvailable: number;
      targets: {
        ensemblId: string;
        symbol: string;
      }[];
    }
  | {
      type: "target_complete";
      ensemblId: string;
      symbol: string;
      completed: number;
      total: number;
    }
  | {
      type: "evidence_complete";
      targetCount: number;
    }
  | {
      type: "synthesising";
    }
  | {
      type: "complete";
      brief: Brief;
    }
  | {
      type: "error";
      code: BriefStreamErrorCode;
      message: string;
      validationErrors?: string[];
    };

const encoder = new TextEncoder();

export function encodeSseEvent(
  event: BriefStreamEvent,
): Uint8Array {
  return encoder.encode(
    `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
  );
}

export function encodeSseComment(
  comment = "keep-alive",
): Uint8Array {
  return encoder.encode(`: ${comment}\n\n`);
}