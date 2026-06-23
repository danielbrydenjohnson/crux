import { TARGET_ENRICHMENT_CONCURRENCY } from "@/lib/config";
import { getTrialsForTarget } from "@/lib/sources/clinicalTrials";
import { getLiterature } from "@/lib/sources/europePmc";
import {
  getAssociatedTargets,
  getTargetDetail,
  type AssociatedTarget,
} from "@/lib/sources/openTargets";
import type {
  EvidenceBundle,
  Source,
  TargetEvidence,
} from "@/lib/types";

interface AssembleTargetEvidenceInput {
  target: AssociatedTarget;
  disease: {
    efoId: string;
    name: string;
  };
}

interface AssembleEvidenceBundleInput {
  efoId: string;
  input?: string;
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

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (
    item: TInput,
    index: number,
  ) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error("Concurrency must be a positive integer.");
  }

  if (items.length === 0) {
    return [];
  }

  const results = new Array<TOutput>(items.length);
  const workerCount = Math.min(concurrency, items.length);

  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      const currentItem = items[currentIndex];

      if (currentItem === undefined) {
        throw new Error(
          `Missing item at orchestration index ${currentIndex}.`,
        );
      }

      results[currentIndex] = await mapper(
        currentItem,
        currentIndex,
      );
    }
  }

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => runWorker(),
    ),
  );

  return results;
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
    trialLinkage: {
      method: clinicalTrials.linkageMethod,
      searchedTerms: clinicalTrials.searchedTerms,
    },
    literature: literature.papers,
    sources: deduplicateSources([
      target.source,
      targetDetail.source,
      ...clinicalTrials.sources,
      ...literature.sources,
    ]),
  };
}

export async function assembleEvidenceBundle({
  efoId,
  input,
}: AssembleEvidenceBundleInput): Promise<EvidenceBundle | null> {
  const trimmedEfoId = efoId.trim();

  if (!trimmedEfoId) {
    throw new Error("EFO ID is required.");
  }

  const associatedTargets =
    await getAssociatedTargets(trimmedEfoId);

  if (!associatedTargets) {
    return null;
  }

  const targets = await mapWithConcurrency(
    associatedTargets.targets,
    TARGET_ENRICHMENT_CONCURRENCY,
    async (target) =>
      assembleTargetEvidence({
        target,
        disease: associatedTargets.disease,
      }),
  );

  const trimmedInput = input?.trim();

  return {
    query: {
      input: trimmedInput || associatedTargets.disease.name,
      efoId: associatedTargets.disease.efoId,
      diseaseName: associatedTargets.disease.name,
    },
    targets,
    assembledAt: new Date().toISOString(),
  };
}