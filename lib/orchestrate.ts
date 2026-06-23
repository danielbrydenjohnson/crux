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

const RETRY_DELAY_MS = 500;

type TargetDetail = NonNullable<
  Awaited<ReturnType<typeof getTargetDetail>>
>;

type ClinicalTrialsResult = Awaited<
  ReturnType<typeof getTrialsForTarget>
>;

type LiteratureResult = Awaited<
  ReturnType<typeof getLiterature>
>;

export interface TargetsFoundProgress {
  disease: {
    efoId: string;
    name: string;
  };
  targetCount: number;
  targets: {
    ensemblId: string;
    symbol: string;
  }[];
}

export interface TargetCompleteProgress {
  ensemblId: string;
  symbol: string;
  completed: number;
  total: number;
}

export interface EvidenceAssemblyProgressHandlers {
  onTargetsFound?: (
    progress: TargetsFoundProgress,
  ) => void | Promise<void>;
  onTargetComplete?: (
    progress: TargetCompleteProgress,
  ) => void | Promise<void>;
}

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
  progress?: EvidenceAssemblyProgressHandlers;
}

function deduplicateSources(
  sources: Source[],
): Source[] {
  const sourcesById = new Map<string, Source>();

  for (const source of sources) {
    if (!sourcesById.has(source.id)) {
      sourcesById.set(source.id, source);
    }
  }

  return Array.from(sourcesById.values());
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function escapeQuotedSearchPhrase(
  value: string,
): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function buildLiteratureQuery(
  targetSymbol: string,
  diseaseName: string,
): string {
  const escapedTargetSymbol =
    escapeQuotedSearchPhrase(targetSymbol);

  const escapedDiseaseName =
    escapeQuotedSearchPhrase(diseaseName);

  return (
    `TITLE_ABS:"${escapedTargetSymbol}" ` +
    `AND TITLE_ABS:"${escapedDiseaseName}"`
  );
}

async function delay(
  milliseconds: number,
): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function withSingleRetry<T>(
  operationLabel: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (firstError) {
    console.warn(
      `${operationLabel} failed. Retrying once:`,
      formatError(firstError),
    );

    await delay(RETRY_DELAY_MS);

    try {
      return await operation();
    } catch (secondError) {
      console.warn(
        `${operationLabel} failed after retry:`,
        formatError(secondError),
      );

      throw secondError;
    }
  }
}

async function getTargetDetailWithRetry(
  target: AssociatedTarget,
  efoId: string,
): Promise<TargetDetail> {
  return withSingleRetry(
    `Open Targets detail request for ${target.symbol}`,
    async () => {
      const targetDetail = await getTargetDetail(
        target.ensemblId,
        efoId,
      );

      if (!targetDetail) {
        throw new Error(
          `Open Targets did not return details for ${target.symbol}.`,
        );
      }

      return targetDetail;
    },
  );
}

async function getClinicalTrialsWithFallback({
  diseaseName,
  targetSymbol,
  knownDrugs,
}: {
  diseaseName: string;
  targetSymbol: string;
  knownDrugs: string[];
}): Promise<ClinicalTrialsResult> {
  try {
    return await withSingleRetry(
      `ClinicalTrials.gov request for ${targetSymbol}`,
      () =>
        getTrialsForTarget({
          diseaseName,
          targetSymbol,
          knownDrugs,
        }),
    );
  } catch (error) {
    console.warn(
      `Continuing without clinical trial results for ${targetSymbol}:`,
      formatError(error),
    );

    return {
      trials: [],
      linkageMethod:
        knownDrugs.length > 0
          ? "known_drug"
          : "target_keyword",
      searchedTerms:
        knownDrugs.length > 0
          ? [...knownDrugs]
          : [targetSymbol],
      sources: [],
    };
  }
}

async function getLiteratureWithFallback(
  targetSymbol: string,
  diseaseName: string,
): Promise<LiteratureResult> {
  try {
    return await withSingleRetry(
      `Europe PMC request for ${targetSymbol}`,
      () =>
        getLiterature(
          targetSymbol,
          diseaseName,
        ),
    );
  } catch (error) {
    console.warn(
      `Continuing without literature results for ${targetSymbol}:`,
      formatError(error),
    );

    return {
      papers: [],
      sources: [],
      query: buildLiteratureQuery(
        targetSymbol,
        diseaseName,
      ),
    };
  }
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (
    item: TInput,
    index: number,
  ) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (
    !Number.isInteger(concurrency) ||
    concurrency <= 0
  ) {
    throw new Error(
      "Concurrency must be a positive integer.",
    );
  }

  if (items.length === 0) {
    return [];
  }

  const results =
    new Array<TOutput>(items.length);

  const workerCount = Math.min(
    concurrency,
    items.length,
  );

  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      const currentItem =
        items[currentIndex];

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
  const targetDetail =
    await getTargetDetailWithRetry(
      target,
      disease.efoId,
    );

  const [clinicalTrials, literature] =
    await Promise.all([
      getClinicalTrialsWithFallback({
        diseaseName: disease.name,
        targetSymbol: target.symbol,
        knownDrugs:
          targetDetail.knownDrugs,
      }),
      getLiteratureWithFallback(
        target.symbol,
        disease.name,
      ),
    ]);

  return {
    ensemblId: target.ensemblId,
    symbol: target.symbol,
    name: target.name,
    associationScore:
      target.associationScore,
    evidenceBreakdown:
      target.evidenceBreakdown,
    tractability:
      targetDetail.tractability,
    knownDrugs:
      targetDetail.knownDrugs,
    trials: clinicalTrials.trials,
    trialLinkage: {
      method:
        clinicalTrials.linkageMethod,
      searchedTerms:
        clinicalTrials.searchedTerms,
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
  progress,
}: AssembleEvidenceBundleInput): Promise<EvidenceBundle | null> {
  const trimmedEfoId = efoId.trim();

  if (!trimmedEfoId) {
    throw new Error(
      "EFO ID is required.",
    );
  }

  const associatedTargets =
    await getAssociatedTargets(
      trimmedEfoId,
    );

  if (!associatedTargets) {
    return null;
  }

  const totalTargets =
    associatedTargets.targets.length;

  await progress?.onTargetsFound?.({
    disease: {
      efoId:
        associatedTargets.disease.efoId,
      name:
        associatedTargets.disease.name,
    },
    targetCount: totalTargets,
    targets:
      associatedTargets.targets.map(
        (target) => ({
          ensemblId: target.ensemblId,
          symbol: target.symbol,
        }),
      ),
  });

  let completedTargets = 0;

  const targets =
    await mapWithConcurrency(
      associatedTargets.targets,
      TARGET_ENRICHMENT_CONCURRENCY,
      async (target) => {
        const targetEvidence =
          await assembleTargetEvidence({
            target,
            disease:
              associatedTargets.disease,
          });

        completedTargets += 1;

        await progress?.onTargetComplete?.({
          ensemblId: target.ensemblId,
          symbol: target.symbol,
          completed: completedTargets,
          total: totalTargets,
        });

        return targetEvidence;
      },
    );

  const trimmedInput = input?.trim();

  return {
    query: {
      input:
        trimmedInput ||
        associatedTargets.disease.name,
      efoId:
        associatedTargets.disease.efoId,
      diseaseName:
        associatedTargets.disease.name,
    },
    targets,
    assembledAt:
      new Date().toISOString(),
  };
}