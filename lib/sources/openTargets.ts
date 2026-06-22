import { DEFAULT_TARGET_COUNT } from "@/lib/config";
import type { EvidenceType, Source } from "@/lib/types";

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

const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  genetic_association: "Genetic association",
  known_drug: "Known drug",
  literature: "Literature",
  rna_expression: "RNA expression",
  animal_model: "Animal model",
  somatic_mutation: "Somatic mutation",
  affected_pathway: "Affected pathway",
};

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
      throw new Error(
        `Open Targets request failed with status ${response.status}.`,
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
    throw new Error("Open Targets search results were not in the expected format.");
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