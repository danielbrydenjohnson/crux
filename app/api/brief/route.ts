import { NextResponse } from "next/server";
import { assembleEvidenceBundle } from "@/lib/orchestrate";

interface BriefRequestBody {
  efoId?: unknown;
  input?: unknown;
}

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

  try {
    const evidenceBundle = await assembleEvidenceBundle({
      efoId: body.efoId,
      input: body.input,
    });

    if (!evidenceBundle) {
      return NextResponse.json(
        {
          ok: false,
          error: "No matching disease was found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      evidenceBundle,
    });
  } catch (error) {
    console.error("Evidence bundle assembly failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Couldn't gather the target evidence just now.",
      },
      { status: 502 },
    );
  }
}