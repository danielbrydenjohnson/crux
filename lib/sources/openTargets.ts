import { DEFAULT_TARGET_COUNT } from "@/lib/config";
import type {
  EvidenceType,
  Source,
  TractabilitySummary,
} from "@/lib/types";

const OPEN_TARGETS_GRAPHQL_URL =
  "https://api.platform.opentargets.org/api/v4/graphql";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ALTERNATIVES = 4;

const RESOLVE_DISEASE_QUERY = `
  query ResolveDisease($q: String!) {
    search(queryString: $q, entityNames: ["disease"]) {
      hits {
        id
        name
        entity
        description
      }
    }
  }
`;

const ASSOCIATED_TARGETS_QUERY = `
  query DiseaseTargets($efoId: String!, $size: Int!) {
    disease(efoId: $efoId) {
      id
      name
      associatedTargets(page: { index: 0, size: $size }) {
        count
        rows {
          target {
            id
            approvedSymbol
            approvedName
          }
          score
          datatypeScores {
            id
            score
          }
        }
      }
    }
  }
`;

const TARGET_DETAIL_QUERY = `
  query TargetDetail($ensemblId: String!) {
    target(ensemblId: $ensemblId) {
      id
      approvedSymbol
      approvedName
      tractability {
        label
        modality
        value
      }
      drugAndClinicalCandidates {
        count
        rows {
          drug {
            id
            name
            parentMolecule {
              id
              name
            }
          }
          clinicalReports {
            clinicalStage
            diseases {
              disease {
                id
              }
            }
          }
        }
      }
    }
  }
`;

const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  genetic_association: "Genetic association",
  genetic_literature: "Genetic literature",
  known_drug: "Known drug",
  clinical: "Clinical",
  literature: "Literature",
  rna_expression: "RNA expression",
  animal_model: "Animal model",
  somatic_mutation: "Somatic mutation",
  affected_pathway: "Affected pathway",
};

const SMALL_MOLECULE_TRACTABILITY_ORDER = [
  "Approved Drug",
  "Advanced Clinical",
  "Phase 1 Clinical",
  "Structure with Ligand",
  "High-Quality Ligand",
  "High-Quality Pocket",
  "Med-Quality Pocket",
  "Druggable Family",
];

const ANTIBODY_TRACTABILITY_ORDER = [
  "Approved Drug",
  "Advanced Clinical",
  "Phase 1 Clinical",
  "UniProt loc high conf",
  "GO CC high conf",
  "UniProt loc med conf",
  "UniProt SigP or TMHMM",
  "GO CC med conf",
  "Human Protein Atlas loc",
];

const PROTAC_TRACTABILITY_ORDER = [
  "Approved Drug",
  "Advanced Clinical",
  "Phase 1 Clinical",
  "Literature",
  "UniProt Ubiquitination",
  "Database Ubiquitination",
  "Half-life Data",
  "Small Molecule Binder",
];

const OTHER_CLINICAL_TRACTABILITY_ORDER = [
  "Approved Drug",
  "Advanced Clinical",
  "Phase 1 Clinical",
];

const DRUG_FORMULATION_SUFFIXES = [
  "anhydrous",
  "monohydrate",
  "dihydrate",
  "hydrate",
  "hydrochloride",
  "hydrobromide",
  "mesylate",
  "esylate",
  "besylate",
  "tosylate",
  "sodium",
  "potassium",
  "calcium",
  "magnesium",
  "acetate",
  "citrate",
  "phosphate",
  "fumarate",
  "maleate",
  "tartrate",
  "succinate",
  "oxalate",
  "sulfate",
  "sulphate",
  "nitrate",
  "chloride",
  "bromide",
  "lactate",
  "gluconate",
];

export interface DiseaseMatch {
  efoId: string;
  name: string;
  description: string | null;
}

export interface DiseaseResolution {
  efoId: string;
  name: string;
  description: string | null;
  alternatives: DiseaseMatch[];
}

export interface AssociatedTarget {
  ensemblId: string;
  symbol: string;
  name: string;
  associationScore: number;
  evidenceBreakdown: EvidenceType[];
  source: Source;
}

export interface AssociatedTargetsResult {
  disease: {
    efoId: string;
    name: string;
  };
  totalCount: number;
  targets: AssociatedTarget[];
}

export interface TargetDetailResult {
  ensemblId: string;
  symbol: string;
  name: string;
  tractability: TractabilitySummary;
  knownDrugs: string[];
  source: Source;
}

interface TractabilityBucket {
  label: string;
  modality: string;
  value: boolean;
}

interface KnownDrugCandidate {
  canonicalName: string;
  clinicalStage: string;
  clinicalStageRank: number;
  isDirectCanonicalName: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDescription(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const firstDescription = value.find(
      (item): item is string => typeof item === "string",
    );

    return firstDescription ?? null;
  }

  return null;
}

function readGraphQlData(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    throw new Error("Open Targets returned an invalid response.");
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const errorMessages = payload.errors
      .map((error) => {
        if (isRecord(error) && typeof error.message === "string") {
          return error.message;
        }

        return "Unknown GraphQL error";
      })
      .join("; ");

    throw new Error(`Open Targets GraphQL error: ${errorMessages}`);
  }

  if (!isRecord(payload.data)) {
    throw new Error("Open Targets response did not contain data.");
  }

  return payload.data;
}

async function requestOpenTargets(
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPEN_TARGETS_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Crux/0.1",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const errorDetail = errorBody.slice(0, 500);

      throw new Error(
        `Open Targets request failed with status ${response.status}. ${errorDetail}`,
      );
    }

    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Open Targets request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseDiseaseMatch(value: unknown): DiseaseMatch | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    value.entity !== "disease"
  ) {
    return null;
  }

  return {
    efoId: value.id,
    name: value.name,
    description: parseDescription(value.description),
  };
}

function readSearchHits(payload: unknown): unknown[] {
  const data = readGraphQlData(payload);

  if (!isRecord(data.search)) {
    throw new Error("Open Targets response did not contain search results.");
  }

  if (!Array.isArray(data.search.hits)) {
    throw new Error(
      "Open Targets search results were not in the expected format.",
    );
  }

  return data.search.hits;
}

function getEvidenceTypeLabel(id: string): string {
  const knownLabel = EVIDENCE_TYPE_LABELS[id];

  if (knownLabel) {
    return knownLabel;
  }

  return id
    .split("_")
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }

      return word;
    })
    .join(" ");
}

function parseEvidenceType(value: unknown): EvidenceType | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.score !== "number" ||
    !Number.isFinite(value.score)
  ) {
    return null;
  }

  return {
    id: value.id,
    label: getEvidenceTypeLabel(value.id),
    score: value.score,
  };
}

function parseAssociatedTarget(
  value: unknown,
  efoId: string,
): AssociatedTarget | null {
  if (!isRecord(value) || !isRecord(value.target)) {
    return null;
  }

  const target = value.target;

  if (
    typeof target.id !== "string" ||
    typeof target.approvedSymbol !== "string" ||
    typeof target.approvedName !== "string" ||
    typeof value.score !== "number" ||
    !Number.isFinite(value.score)
  ) {
    return null;
  }

  const evidenceBreakdown = Array.isArray(value.datatypeScores)
    ? value.datatypeScores
        .map(parseEvidenceType)
        .filter(
          (evidence): evidence is EvidenceType => evidence !== null,
        )
    : [];

  return {
    ensemblId: target.id,
    symbol: target.approvedSymbol,
    name: target.approvedName,
    associationScore: value.score,
    evidenceBreakdown,
    source: {
      id: `ot:${target.id}:${efoId}`,
      type: "open_targets",
      label: "Open Targets association",
      url: `https://platform.opentargets.org/evidence/${target.id}/${efoId}`,
    },
  };
}

function readAssociatedTargets(
  payload: unknown,
  requestedEfoId: string,
): AssociatedTargetsResult | null {
  const data = readGraphQlData(payload);

  if (data.disease === null) {
    return null;
  }

  if (!isRecord(data.disease)) {
    throw new Error("Open Targets response did not contain a valid disease.");
  }

  if (
    typeof data.disease.id !== "string" ||
    typeof data.disease.name !== "string"
  ) {
    throw new Error("Open Targets disease identity was incomplete.");
  }

  if (!isRecord(data.disease.associatedTargets)) {
    throw new Error(
      "Open Targets response did not contain associated targets.",
    );
  }

  const associatedTargets = data.disease.associatedTargets;

  if (!Array.isArray(associatedTargets.rows)) {
    throw new Error(
      "Open Targets associated target rows were not in the expected format.",
    );
  }

  const targets = associatedTargets.rows
    .map((row) => parseAssociatedTarget(row, requestedEfoId))
    .filter((target): target is AssociatedTarget => target !== null);

  return {
    disease: {
      efoId: data.disease.id,
      name: data.disease.name,
    },
    totalCount:
      typeof associatedTargets.count === "number"
        ? associatedTargets.count
        : targets.length,
    targets,
  };
}

function parseTractabilityBucket(
  value: unknown,
): TractabilityBucket | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.label !== "string" ||
    typeof value.modality !== "string" ||
    typeof value.value !== "boolean"
  ) {
    return null;
  }

  return {
    label: value.label,
    modality: value.modality,
    value: value.value,
  };
}

function selectHighestTractabilityLabel(
  buckets: TractabilityBucket[],
  modality: string,
  preferredOrder: string[],
): string | null {
  const availableLabels = buckets
    .filter((bucket) => bucket.modality === modality && bucket.value)
    .map((bucket) => bucket.label);

  for (const preferredLabel of preferredOrder) {
    if (availableLabels.includes(preferredLabel)) {
      return preferredLabel;
    }
  }

  return availableLabels[0] ?? null;
}

function buildTractabilitySummary(
  buckets: TractabilityBucket[],
): TractabilitySummary {
  const protac = selectHighestTractabilityLabel(
    buckets,
    "PR",
    PROTAC_TRACTABILITY_ORDER,
  );

  const otherClinical = selectHighestTractabilityLabel(
    buckets,
    "OC",
    OTHER_CLINICAL_TRACTABILITY_ORDER,
  );

  const otherParts: string[] = [];

  if (protac) {
    otherParts.push(`PROTAC: ${protac}`);
  }

  if (otherClinical) {
    otherParts.push(`Other clinical: ${otherClinical}`);
  }

  return {
    smallMolecule: selectHighestTractabilityLabel(
      buckets,
      "SM",
      SMALL_MOLECULE_TRACTABILITY_ORDER,
    ),
    antibody: selectHighestTractabilityLabel(
      buckets,
      "AB",
      ANTIBODY_TRACTABILITY_ORDER,
    ),
    other: otherParts.length > 0 ? otherParts.join("; ") : null,
  };
}

function getClinicalStageRank(stage: string): number {
  const normalisedStage = stage.trim().toUpperCase().replace(/\s+/g, "_");

  if (normalisedStage.includes("APPROVAL")) {
    return 100;
  }

  if (normalisedStage.includes("EARLY_PHASE_1")) {
    return 8;
  }

  const phaseMatches = Array.from(
    normalisedStage.matchAll(/PHASE_?([0-4])/g),
  );

  if (phaseMatches.length > 0) {
    return Math.max(
      ...phaseMatches.map((match) => Number(match[1]) * 10),
    );
  }

  if (normalisedStage.includes("PRECLINICAL")) {
    return 5;
  }

  return 0;
}

function clinicalReportMatchesDisease(
  value: unknown,
  efoId: string,
): boolean {
  if (!isRecord(value) || !Array.isArray(value.diseases)) {
    return false;
  }

  return value.diseases.some((diseaseEntry) => {
    if (!isRecord(diseaseEntry) || !isRecord(diseaseEntry.disease)) {
      return false;
    }

    return diseaseEntry.disease.id === efoId;
  });
}

function getHighestDiseaseClinicalStage(
  clinicalReports: unknown,
  efoId: string,
): string | null {
  if (!Array.isArray(clinicalReports)) {
    return null;
  }

  const matchingStages = clinicalReports
    .filter((report) => clinicalReportMatchesDisease(report, efoId))
    .map((report) => {
      if (!isRecord(report) || typeof report.clinicalStage !== "string") {
        return null;
      }

      return report.clinicalStage;
    })
    .filter((stage): stage is string => stage !== null)
    .sort((first, second) => {
      const rankDifference =
        getClinicalStageRank(second) - getClinicalStageRank(first);

      if (rankDifference !== 0) {
        return rankDifference;
      }

      return first.localeCompare(second);
    });

  return matchingStages[0] ?? null;
}

function stripDrugFormulationSuffixes(name: string): string {
  let cleanedName = name.trim().replace(/\s+/g, " ");
  let changed = true;

  while (changed) {
    changed = false;

    for (const suffix of DRUG_FORMULATION_SUFFIXES) {
      const suffixPattern = new RegExp(
        `(?:\\s+|[-,]\\s*)${suffix}$`,
        "i",
      );

      const nextName = cleanedName.replace(suffixPattern, "").trim();

      if (nextName && nextName !== cleanedName) {
        cleanedName = nextName;
        changed = true;
        break;
      }
    }
  }

  return cleanedName;
}

function normaliseDrugKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseKnownDrugCandidate(
  value: unknown,
  efoId: string,
): KnownDrugCandidate | null {
  if (!isRecord(value) || !isRecord(value.drug)) {
    return null;
  }

  if (typeof value.drug.name !== "string") {
    return null;
  }

  const diseaseClinicalStage = getHighestDiseaseClinicalStage(
    value.clinicalReports,
    efoId,
  );

  if (!diseaseClinicalStage) {
    return null;
  }

  const rawDrugName = value.drug.name.trim();

  const parentDrugName =
    isRecord(value.drug.parentMolecule) &&
    typeof value.drug.parentMolecule.name === "string"
      ? value.drug.parentMolecule.name.trim()
      : null;

  const canonicalName = stripDrugFormulationSuffixes(
    parentDrugName || rawDrugName,
  );

  if (!canonicalName) {
    return null;
  }

  return {
    canonicalName,
    clinicalStage: diseaseClinicalStage,
    clinicalStageRank: getClinicalStageRank(diseaseClinicalStage),
    isDirectCanonicalName:
      normaliseDrugKey(rawDrugName) === normaliseDrugKey(canonicalName),
  };
}

function collectKnownDrugNames(
  value: unknown,
  efoId: string,
): string[] {
  if (!isRecord(value) || !Array.isArray(value.rows)) {
    return [];
  }

  const candidates = value.rows
    .map((row) => parseKnownDrugCandidate(row, efoId))
    .filter(
      (candidate): candidate is KnownDrugCandidate => candidate !== null,
    );

  const bestCandidateByDrug = new Map<string, KnownDrugCandidate>();

  for (const candidate of candidates) {
    const key = normaliseDrugKey(candidate.canonicalName);
    const existingCandidate = bestCandidateByDrug.get(key);

    if (!existingCandidate) {
      bestCandidateByDrug.set(key, candidate);
      continue;
    }

    if (
      candidate.clinicalStageRank > existingCandidate.clinicalStageRank
    ) {
      bestCandidateByDrug.set(key, candidate);
      continue;
    }

    if (
      candidate.clinicalStageRank ===
        existingCandidate.clinicalStageRank &&
      candidate.isDirectCanonicalName &&
      !existingCandidate.isDirectCanonicalName
    ) {
      bestCandidateByDrug.set(key, candidate);
    }
  }

  return Array.from(bestCandidateByDrug.values())
    .sort((first, second) => {
      if (second.clinicalStageRank !== first.clinicalStageRank) {
        return second.clinicalStageRank - first.clinicalStageRank;
      }

      return first.canonicalName.localeCompare(second.canonicalName);
    })
    .map((candidate) => candidate.canonicalName);
}

function readTargetDetail(
  payload: unknown,
  efoId: string,
): TargetDetailResult | null {
  const data = readGraphQlData(payload);

  if (data.target === null) {
    return null;
  }

  if (!isRecord(data.target)) {
    throw new Error(
      "Open Targets response did not contain a valid target.",
    );
  }

  const target = data.target;

  if (
    typeof target.id !== "string" ||
    typeof target.approvedSymbol !== "string" ||
    typeof target.approvedName !== "string"
  ) {
    throw new Error("Open Targets target identity was incomplete.");
  }

  const tractabilityBuckets = Array.isArray(target.tractability)
    ? target.tractability
        .map(parseTractabilityBucket)
        .filter(
          (bucket): bucket is TractabilityBucket => bucket !== null,
        )
    : [];

  return {
    ensemblId: target.id,
    symbol: target.approvedSymbol,
    name: target.approvedName,
    tractability: buildTractabilitySummary(tractabilityBuckets),
    knownDrugs: collectKnownDrugNames(
      target.drugAndClinicalCandidates,
      efoId,
    ),
    source: {
      id: `ot-target:${target.id}`,
      type: "open_targets",
      label: "Open Targets target profile",
      url: `https://platform.opentargets.org/target/${target.id}`,
    },
  };
}

export async function resolveDisease(
  diseaseName: string,
): Promise<DiseaseResolution | null> {
  const trimmedDiseaseName = diseaseName.trim();

  if (!trimmedDiseaseName) {
    throw new Error("Disease name is required.");
  }

  const payload = await requestOpenTargets(RESOLVE_DISEASE_QUERY, {
    q: trimmedDiseaseName,
  });

  const hits = readSearchHits(payload);

  const diseaseMatches = hits
    .map(parseDiseaseMatch)
    .filter((match): match is DiseaseMatch => match !== null);

  const [primaryMatch, ...remainingMatches] = diseaseMatches;

  if (!primaryMatch) {
    return null;
  }

  return {
    efoId: primaryMatch.efoId,
    name: primaryMatch.name,
    description: primaryMatch.description,
    alternatives: remainingMatches.slice(0, MAX_ALTERNATIVES),
  };
}

export async function getAssociatedTargets(
  efoId: string,
  targetCount: number = DEFAULT_TARGET_COUNT,
): Promise<AssociatedTargetsResult | null> {
  const trimmedEfoId = efoId.trim();

  if (!trimmedEfoId) {
    throw new Error("EFO ID is required.");
  }

  if (!Number.isInteger(targetCount) || targetCount <= 0) {
    throw new Error("Target count must be a positive integer.");
  }

  const payload = await requestOpenTargets(ASSOCIATED_TARGETS_QUERY, {
    efoId: trimmedEfoId,
    size: targetCount,
  });

  return readAssociatedTargets(payload, trimmedEfoId);
}

export async function getTargetDetail(
  ensemblId: string,
  efoId: string,
): Promise<TargetDetailResult | null> {
  const trimmedEnsemblId = ensemblId.trim();
  const trimmedEfoId = efoId.trim();

  if (!trimmedEnsemblId) {
    throw new Error("Ensembl ID is required.");
  }

  if (!trimmedEfoId) {
    throw new Error("EFO ID is required.");
  }

  const payload = await requestOpenTargets(TARGET_DETAIL_QUERY, {
    ensemblId: trimmedEnsemblId,
  });

  return readTargetDetail(payload, trimmedEfoId);
}