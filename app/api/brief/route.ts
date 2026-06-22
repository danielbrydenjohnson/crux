import { NextResponse } from "next/server";
import { assembleTargetEvidence } from "@/lib/orchestrate";
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
    const associatedTargets = await getAssociatedTargets(body.efoId);

    if (!associatedTargets) {
      return NextResponse.json(
        {
          ok: false,
          error: "No matching disease was found.",
        },
        { status: 404 },
      );
    }

    const clinicalTarget = associatedTargets.targets.find((target) =>
      target.evidenceBreakdown.some(
        (evidence) => evidence.id === "clinical",
      ),
    );

    if (!clinicalTarget) {
      return NextResponse.json(
        {
          ok: false,
          error: "No target with clinical evidence was found.",
        },
        { status: 404 },
      );
    }

    const targetEvidence = await assembleTargetEvidence({
      target: clinicalTarget,
      disease: associatedTargets.disease,
    });

    return NextResponse.json({
      ok: true,
      disease: associatedTargets.disease,
      targetEvidence,
    });
  } catch (error) {
    console.error("Brief data lookup failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Couldn't gather the target evidence just now.",
      },
      { status: 502 },
    );
  }
}