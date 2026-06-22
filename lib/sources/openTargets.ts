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

  if (!isRecord(payload.data.search)) {
    throw new Error("Open Targets response did not contain search results.");
  }

  if (!Array.isArray(payload.data.search.hits)) {
    throw new Error("Open Targets search results were not in the expected format.");
  }

  return payload.data.search.hits;
}

export async function resolveDisease(
  diseaseName: string,
): Promise<DiseaseResolution | null> {
  const trimmedDiseaseName = diseaseName.trim();

  if (!trimmedDiseaseName) {
    throw new Error("Disease name is required.");
  }

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
        query: RESOLVE_DISEASE_QUERY,
        variables: {
          q: trimmedDiseaseName,
        },
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Open Targets request failed with status ${response.status}.`,
      );
    }

    const payload: unknown = await response.json();
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
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Open Targets request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}