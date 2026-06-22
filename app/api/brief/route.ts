import { NextResponse } from "next/server";
import { getTrialsForTarget } from "@/lib/sources/clinicalTrials";
import { getLiterature } from "@/lib/sources/europePmc";
import {
  getAssociatedTargets,
  getTargetDetail,
} from "@/lib/sources/openTargets";
import type { Source, TargetEvidence } from "@/lib/types";

interface BriefRequestBody {
  efoId?: unknown;
}

function deduplicateSources(sources: Source[]): Source[] {
  const sourcesById = new Map<string, Source>();

  for (const source of sources) {
    if (!sourcesById.has(source.id)) {
      sourcesById.set(source.id, source);
    }
  }

  return Array.from(sourcesById.values());
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

    const targetEvidence: TargetEvidence = {
      ensemblId: clinicalTarget.ensemblId,
      symbol: clinicalTarget.symbol,
      name: clinicalTarget.name,
      associationScore: clinicalTarget.associationScore,
      evidenceBreakdown: clinicalTarget.evidenceBreakdown,
      tractability: targetDetail.tractability,
      knownDrugs: targetDetail.knownDrugs,
      trials: clinicalTrials.trials,
      literature: literature.papers,
      sources: deduplicateSources([
        clinicalTarget.source,
        targetDetail.source,
        ...clinicalTrials.sources,
        ...literature.sources,
      ]),
    };

    return NextResponse.json({
      ok: true,
      disease: associatedTargets.disease,
      targetEvidence,
      linkage: {
        trialMethod: clinicalTrials.linkageMethod,
        searchedDrugTerms: clinicalTrials.searchedTerms,
        literatureQuery: literature.query,
      },
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