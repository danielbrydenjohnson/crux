import type { Paper, Source } from "@/lib/types";

const EUROPE_PMC_SEARCH_URL =
  "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_PAPER_COUNT = 5;
const MAX_PAPER_COUNT = 10;
const MAX_SOURCE_LABEL_LENGTH = 120;

export interface LiteratureResult {
  papers: Paper[];
  sources: Source[];
  query: string;
}

interface ParsedLiteratureRecord {
  paper: Paper;
  source: Source;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cleanEuropePmcText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleanedText = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  return cleanedText || null;
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

function parseYear(value: unknown): number | null {
  const parsedValue = parseFiniteNumber(value);

  if (parsedValue === null) {
    return null;
  }

  const year = Math.trunc(parsedValue);

  if (year < 1000 || year > 9999) {
    return null;
  }

  return year;
}

function parseCitationCount(value: unknown): number | null {
  const parsedValue = parseFiniteNumber(value);

  if (parsedValue === null || parsedValue < 0) {
    return null;
  }

  return Math.trunc(parsedValue);
}

function escapeQuotedSearchPhrase(value: string): string {
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

function truncateSourceLabel(title: string): string {
  if (title.length <= MAX_SOURCE_LABEL_LENGTH) {
    return title;
  }

  return `${title.slice(0, MAX_SOURCE_LABEL_LENGTH - 1).trimEnd()}…`;
}

function parseLiteratureRecord(
  value: unknown,
): ParsedLiteratureRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.source !== "string"
  ) {
    return null;
  }

  const title = cleanEuropePmcText(value.title);

  if (!title) {
    return null;
  }

  const sourceName = value.source.trim();
  const recordId = value.id.trim();

  if (!sourceName || !recordId) {
    return null;
  }

  const pmid =
    typeof value.pmid === "string" && value.pmid.trim()
      ? value.pmid.trim()
      : null;

  const pmcid =
    typeof value.pmcid === "string" && value.pmcid.trim()
      ? value.pmcid.trim()
      : null;

  const paperId = pmcid ?? pmid ?? recordId;

  const url =
    `https://europepmc.org/article/` +
    `${encodeURIComponent(sourceName)}/` +
    `${encodeURIComponent(recordId)}`;

  return {
    paper: {
      id: paperId,
      title,
      year: parseYear(value.pubYear),
      citationCount: parseCitationCount(value.citedByCount),
      abstract: cleanEuropePmcText(value.abstractText),
      url,
    },
    source: {
      id: `epmc:${sourceName}:${recordId}`,
      type: "literature",
      label: truncateSourceLabel(title),
      url,
    },
  };
}

function readLiteratureRecords(
  payload: unknown,
): ParsedLiteratureRecord[] {
  if (!isRecord(payload)) {
    throw new Error("Europe PMC returned an invalid response.");
  }

  if (!isRecord(payload.resultList)) {
    return [];
  }

  if (!Array.isArray(payload.resultList.result)) {
    return [];
  }

  const parsedRecords = payload.resultList.result
    .map(parseLiteratureRecord)
    .filter(
      (
        record,
      ): record is ParsedLiteratureRecord => record !== null,
    );

  const recordsBySourceId =
    new Map<string, ParsedLiteratureRecord>();

  for (const record of parsedRecords) {
    if (!recordsBySourceId.has(record.source.id)) {
      recordsBySourceId.set(record.source.id, record);
    }
  }

  return Array.from(recordsBySourceId.values());
}

async function requestEuropePmc(
  query: string,
  paperCount: number,
): Promise<unknown> {
  const searchParameters = new URLSearchParams({
    query,
    format: "json",
    resultType: "core",
    pageSize: String(paperCount),
  });

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${EUROPE_PMC_SEARCH_URL}?${searchParameters.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Crux/0.1",
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      const errorDetail = errorBody.slice(0, 500);

      throw new Error(
        `Europe PMC request failed with status ` +
          `${response.status}. ${errorDetail}`,
      );
    }

    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Europe PMC request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getLiterature(
  targetSymbol: string,
  diseaseName: string,
  paperCount: number = DEFAULT_PAPER_COUNT,
): Promise<LiteratureResult> {
  const trimmedTargetSymbol = targetSymbol.trim();
  const trimmedDiseaseName = diseaseName.trim();

  if (!trimmedTargetSymbol) {
    throw new Error("Target symbol is required.");
  }

  if (!trimmedDiseaseName) {
    throw new Error("Disease name is required.");
  }

  if (
    !Number.isInteger(paperCount) ||
    paperCount <= 0 ||
    paperCount > MAX_PAPER_COUNT
  ) {
    throw new Error(
      `Paper count must be an integer between 1 and ` +
        `${MAX_PAPER_COUNT}.`,
    );
  }

  const query = buildLiteratureQuery(
    trimmedTargetSymbol,
    trimmedDiseaseName,
  );

  const payload = await requestEuropePmc(query, paperCount);
  const records = readLiteratureRecords(payload);

  return {
    papers: records.map((record) => record.paper),
    sources: records.map((record) => record.source),
    query,
  };
}