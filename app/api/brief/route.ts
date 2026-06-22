import { NextResponse } from "next/server";
import { getTrialsForTarget } from "@/lib/sources/clinicalTrials";
import { getLiterature } from "@/lib/sources/europePmc";
import {
  getAssociatedTargets,
  getTargetDetail,
} from "@/lib/sources/openTargets";

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

    const targetDetail = await getTargetDetail(
      clinicalTarget.ensemblId,
      associatedTargets.disease.efoId,
    );

    if (!targetDetail) {
      return NextResponse.json(
        {
          ok: false,
          error: "Target details were not found.",
        },
        { status: 404 },
      );
    }

    const [clinicalTrials, literature] = await Promise.all([
      getTrialsForTarget({
        diseaseName: associatedTargets.disease.name,
        targetSymbol: clinicalTarget.symbol,
        knownDrugs: targetDetail.knownDrugs,
      }),
      getLiterature(
        clinicalTarget.symbol,
        associatedTargets.disease.name,
      ),
    ]);

    return NextResponse.json({
      ok: true,
      disease: associatedTargets.disease,
      selectedTarget: clinicalTarget,
      targetDetail,
      clinicalTrials,
      literature,
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