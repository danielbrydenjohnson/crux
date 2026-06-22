import { NextResponse } from "next/server";
import { getAssociatedTargets } from "@/lib/sources/openTargets";

interface BriefRequestBody {
  efoId?: unknown;
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

  try {
    const result = await getAssociatedTargets(body.efoId);

    if (!result) {
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
      result,
    });
  } catch (error) {
    console.error("Associated target lookup failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Couldn't reach Open Targets just now.",
      },
      { status: 502 },
    );
  }
}