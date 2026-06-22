import { getTrialsForTarget } from "@/lib/sources/clinicalTrials";
import { getLiterature } from "@/lib/sources/europePmc";
import {
  getTargetDetail,
  type AssociatedTarget,
} from "@/lib/sources/openTargets";
import type { Source, TargetEvidence } from "@/lib/types";

interface AssembleTargetEvidenceInput {
  target: AssociatedTarget;
  disease: {
    efoId: string;
    name: string;
  };
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

export async function assembleTargetEvidence({
  target,
  disease,
}: AssembleTargetEvidenceInput): Promise<TargetEvidence> {
  const targetDetail = await getTargetDetail(
    target.ensemblId,
    disease.efoId,
  );

  if (!targetDetail) {
    throw new Error(
      `Open Targets did not return details for ${target.symbol}.`,
    );
  }

  const [clinicalTrials, literature] = await Promise.all([
    getTrialsForTarget({
      diseaseName: disease.name,
      targetSymbol: target.symbol,
      knownDrugs: targetDetail.knownDrugs,
    }),
    getLiterature(target.symbol, disease.name),
  ]);

  return {
    ensemblId: target.ensemblId,
    symbol: target.symbol,
    name: target.name,
    associationScore: target.associationScore,
    evidenceBreakdown: target.evidenceBreakdown,
    tractability: targetDetail.tractability,
    knownDrugs: targetDetail.knownDrugs,
    trials: clinicalTrials.trials,
    literature: literature.papers,
    sources: deduplicateSources([
      target.source,
      targetDetail.source,
      ...clinicalTrials.sources,
      ...literature.sources,
    ]),
  };
}