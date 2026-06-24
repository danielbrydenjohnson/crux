import type {
  Brief,
  Citation,
  Claim,
  EvidenceType,
  Source,
  TargetBrief,
  Trial,
} from "@/lib/types";

const BRIEF_STORAGE_KEY = "crux.latest-brief.v1";
const BRIEF_STORAGE_VERSION = 1;
const BRIEF_MAX_AGE_MS =
  14 * 24 * 60 * 60 * 1000;

export interface StoredDisease {
  efoId: string;
  name: string;
  description: string | null;
}

export interface StoredBriefSnapshot {
  disease: StoredDisease;
  brief: Brief;
  savedAt: string;
}

interface StoredBriefRecord {
  version: number;
  disease: StoredDisease;
  brief: Brief;
  savedAt: string;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isNullableString(
  value: unknown,
): value is string | null {
  return value === null || typeof value === "string";
}

function isFiniteNumber(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function isStringArray(
  value: unknown,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(isNonEmptyString)
  );
}

function isSource(value: unknown): value is Source {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    (value.type === "open_targets" ||
      value.type === "clinical_trial" ||
      value.type === "literature") &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.url)
  );
}

function isEvidenceType(
  value: unknown,
): value is EvidenceType {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.label) &&
    isFiniteNumber(value.score) &&
    value.score >= 0 &&
    value.score <= 1
  );
}

function isTrial(value: unknown): value is Trial {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.nctId) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.phase) &&
    isNonEmptyString(value.status) &&
    isNullableString(value.sponsor) &&
    isStringArray(value.interventions) &&
    isNullableString(value.startDate) &&
    isNonEmptyString(value.url)
  );
}

function isCitation(
  value: unknown,
): value is Citation {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isStringArray(value.sourceIds) &&
    value.sourceIds.length > 0
  );
}

function isClaim(value: unknown): value is Claim {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.text) &&
    isCitation(value.citation)
  );
}

function isClaimArray(
  value: unknown,
): value is Claim[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isClaim)
  );
}

function isTargetBrief(
  value: unknown,
): value is TargetBrief {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isRecord(value.competitiveLandscape)
  ) {
    return false;
  }

  return (
    isNonEmptyString(value.ensemblId) &&
    isNonEmptyString(value.symbol) &&
    isNonEmptyString(value.name) &&
    isFiniteNumber(value.associationScore) &&
    value.associationScore >= 0 &&
    value.associationScore <= 1 &&
    Array.isArray(value.evidenceBreakdown) &&
    value.evidenceBreakdown.every(
      isEvidenceType,
    ) &&
    isClaim(value.tractabilitySummary) &&
    isClaim(
      value.competitiveLandscape.summary,
    ) &&
    Array.isArray(
      value.competitiveLandscape.trials,
    ) &&
    value.competitiveLandscape.trials.every(
      isTrial,
    ) &&
    isClaim(value.literatureAngle) &&
    isClaimArray(value.caseFor) &&
    isClaimArray(value.caseAgainst) &&
    (value.confidence === "high" ||
      value.confidence === "moderate" ||
      value.confidence === "low") &&
    isClaim(value.confidenceRationale)
  );
}

function isBriefQuery(
  value: unknown,
): value is Brief["query"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.input) &&
    isNonEmptyString(value.efoId) &&
    isNonEmptyString(value.diseaseName)
  );
}

function isBriefStructure(
  value: unknown,
): value is Brief {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isBriefQuery(value.query) &&
    isClaimArray(value.overallSummary) &&
    isClaim(value.headline) &&
    Array.isArray(value.targets) &&
    value.targets.length > 0 &&
    value.targets.every(isTargetBrief) &&
    Array.isArray(value.sources) &&
    value.sources.length > 0 &&
    value.sources.every(isSource) &&
    isNonEmptyString(value.generatedAt)
  );
}

function collectClaims(brief: Brief): Claim[] {
  return [
    ...brief.overallSummary,
    brief.headline,
    ...brief.targets.flatMap((target) => [
      target.tractabilitySummary,
      target.competitiveLandscape.summary,
      target.literatureAngle,
      ...target.caseFor,
      ...target.caseAgainst,
      target.confidenceRationale,
    ]),
  ];
}

function hasValidCitationReferences(
  brief: Brief,
): boolean {
  const sourceIds = new Set(
    brief.sources.map((source) => source.id),
  );

  return collectClaims(brief).every((claim) =>
    claim.citation.sourceIds.every((sourceId) =>
      sourceIds.has(sourceId),
    ),
  );
}

function isValidBrief(
  value: unknown,
): value is Brief {
  return (
    isBriefStructure(value) &&
    hasValidCitationReferences(value)
  );
}

function isStoredDisease(
  value: unknown,
): value is StoredDisease {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.efoId) &&
    isNonEmptyString(value.name) &&
    isNullableString(value.description)
  );
}

function isValidSavedAt(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }

  const savedTime = Date.parse(value);

  if (!Number.isFinite(savedTime)) {
    return false;
  }

  const age = Date.now() - savedTime;

  return age >= 0 && age <= BRIEF_MAX_AGE_MS;
}

function isStoredBriefRecord(
  value: unknown,
): value is StoredBriefRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === BRIEF_STORAGE_VERSION &&
    isStoredDisease(value.disease) &&
    isValidBrief(value.brief) &&
    isValidSavedAt(value.savedAt) &&
    value.disease.efoId ===
      value.brief.query.efoId
  );
}

function canUseLocalStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

export function saveLatestBrief(
  snapshot: {
    disease: StoredDisease;
    brief: Brief;
  },
): boolean {
  if (!canUseLocalStorage()) {
    return false;
  }

  const record: StoredBriefRecord = {
    version: BRIEF_STORAGE_VERSION,
    disease: snapshot.disease,
    brief: snapshot.brief,
    savedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(
      BRIEF_STORAGE_KEY,
      JSON.stringify(record),
    );

    return true;
  } catch {
    return false;
  }
}

export function loadLatestBrief():
  | StoredBriefSnapshot
  | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const rawRecord =
      window.localStorage.getItem(
        BRIEF_STORAGE_KEY,
      );

    if (!rawRecord) {
      return null;
    }

    const parsedRecord: unknown =
      JSON.parse(rawRecord);

    if (!isStoredBriefRecord(parsedRecord)) {
      clearLatestBrief();
      return null;
    }

    return {
      disease: parsedRecord.disease,
      brief: parsedRecord.brief,
      savedAt: parsedRecord.savedAt,
    };
  } catch {
    clearLatestBrief();
    return null;
  }
}

export function clearLatestBrief(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(
      BRIEF_STORAGE_KEY,
    );
  } catch {
    // Storage may be blocked or unavailable.
  }
}