import { NextResponse } from "next/server";
import { resolveDisease } from "@/lib/sources/openTargets";

interface ResolveRequestBody {
  diseaseName?: unknown;
}

export async function POST(request: Request) {
  let body: ResolveRequestBody;

  try {
    body = (await request.json()) as ResolveRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  if (typeof body.diseaseName !== "string") {
    return NextResponse.json(
      {
        ok: false,
        error: "diseaseName must be a string.",
      },
      { status: 400 },
    );
  }

  try {
    const resolution = await resolveDisease(body.diseaseName);

    if (!resolution) {
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
      resolution,
    });
  } catch (error) {
    console.error("Disease resolution failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Couldn't reach Open Targets just now.",
      },
      { status: 502 },
    );
  }
}