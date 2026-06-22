import type { Source, Trial } from "@/lib/types";

const CLINICAL_TRIALS_API_URL =
  "https://clinicaltrials.gov/api/v2/studies";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_DRUG_QUERIES = 5;
const TRIALS_PER_QUERY = 20;

const REQUESTED_FIELDS = [
  "NCTId",
  "BriefTitle",
  "OverallStatus",
  "Phase",
  "LeadSponsorName",
  "StartDate",
  "InterventionName",
  "Condition",
].join(",");

const PHASE_LABELS: Record<string, string> = {
  EARLY_PHASE1: "Early Phase 1",
  PHASE1: "Phase 1",
  PHASE2: "Phase 2",
  PHASE3: "Phase 3",
  PHASE4: "Phase 4",
  NA: "N/A",
};

const STATUS_LABELS: Record<string, string> = {
  RECRUITING: "Recruiting",
  NOT_YET_RECRUITING: "Not yet recruiting",
  ACTIVE_NOT_RECRUITING: "Active, not recruiting",
  COMPLETED: "Completed",
  TERMINATED: "Terminated",
  WITHDRAWN: "Withdrawn",
  SUSPENDED: "Suspended",
  ENROLLING_BY_INVITATION: "Enrolling by invitation",
  UNKNOWN: "Unknown",
};

const DRUG_NAME_QUALIFIERS = new Set([
  "acetate",
  "anhydrous",
  "besylate",
  "calcium",
  "citrate",
  "dihydrochloride",
  "esylate",
  "fumarate",
  "hemifumarate",
  "hydrate",
  "hydrobromide",
  "hydrochloride",
  "lactate",
  "maleate",
  "mesylate",
  "monohydrate",
  "phosphate",
  "potassium",
  "sodium",
  "succinate",
  "sulfate",
  "tartrate",
  "tosylate",
]);

export type TrialLinkageMethod =
  | "known_drug"
  | "target_keyword";

export interface ClinicalTrialsResult {
  trials: Trial[];
  linkageMethod: TrialLinkageMethod;
  searchedTerms: string[];
  sources: Source[];
}

export interface GetTrialsForTargetInput {
  diseaseName: string;
  targetSymbol: string;
  knownDrugs: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalisePhase(value: unknown): string {
  if (!Array.isArray(value)) {
    return "N/A";
  }

  const phases = value
    .filter((phase): phase is string => typeof phase === "string")
    .map((phase) => PHASE_LABELS[phase] ?? phase)
    .filter(
      (phase, index, allPhases) =>
        allPhases.indexOf(phase) === index,
    );

  return phases.length > 0 ? phases.join(" / ") : "N/A";
}

function normaliseStatus(value: unknown): string {
  if (typeof value !== "string") {
    return "Unknown";
  }

  return STATUS_LABELS[value] ?? value;
}

function normaliseDrugName(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 0 && !DRUG_NAME_QUALIFIERS.has(word),
    )
    .join(" ");
}

function compactDrugName(value: string): string {
  return normaliseDrugName(value).replace(/\s+/g, "");
}

function interventionMatchesSearchTerm(
  interventionName: string,
  searchTerm: string,
): boolean {
  const normalisedIntervention =
    normaliseDrugName(interventionName);
  const normalisedSearchTerm = normaliseDrugName(searchTerm);

  if (!normalisedIntervention || !normalisedSearchTerm) {
    return false;
  }

  if (normalisedIntervention.startsWith("placebo")) {
    return false;
  }

  const directMatch =
    normalisedIntervention === normalisedSearchTerm ||
    normalisedIntervention.startsWith(
      `${normalisedSearchTerm} `,
    ) ||
    normalisedIntervention.endsWith(
      ` ${normalisedSearchTerm}`,
    ) ||
    normalisedIntervention.includes(
      ` ${normalisedSearchTerm} `,
    );

  if (directMatch) {
    return true;
  }

  const compactIntervention = compactDrugName(interventionName);
  const compactSearchTerm = compactDrugName(searchTerm);

  return (
    compactIntervention === compactSearchTerm ||
    compactIntervention.startsWith(compactSearchTerm)
  );
}

function readInterventionNames(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.interventions)) {
    return [];
  }

  const names = value.interventions
    .map((intervention) => {
      if (
        isRecord(intervention) &&
        typeof intervention.name === "string"
      ) {
        return intervention.name.trim();
      }

      return null;
    })
    .filter((name): name is string => Boolean(name));

  return names.filter(
    (name, index, allNames) => allNames.indexOf(name) === index,
  );
}

function parseTrial(value: unknown): Trial | null {
  if (!isRecord(value) || !isRecord(value.protocolSection)) {
    return null;
  }

  const protocolSection = value.protocolSection;

  const identificationModule = isRecord(
    protocolSection.identificationModule,
  )
    ? protocolSection.identificationModule
    : null;

  const statusModule = isRecord(protocolSection.statusModule)
    ? protocolSection.statusModule
    : null;

  const designModule = isRecord(protocolSection.designModule)
    ? protocolSection.designModule
    : null;

  const sponsorModule = isRecord(
    protocolSection.sponsorCollaboratorsModule,
  )
    ? protocolSection.sponsorCollaboratorsModule
    : null;

  const interventionsModule = isRecord(
    protocolSection.armsInterventionsModule,
  )
    ? protocolSection.armsInterventionsModule
    : null;

  if (
    !identificationModule ||
    typeof identificationModule.nctId !== "string" ||
    typeof identificationModule.briefTitle !== "string"
  ) {
    return null;
  }

  const nctId = identificationModule.nctId;

  const leadSponsor =
    sponsorModule && isRecord(sponsorModule.leadSponsor)
      ? sponsorModule.leadSponsor
      : null;

  const startDateStruct =
    statusModule && isRecord(statusModule.startDateStruct)
      ? statusModule.startDateStruct
      : null;

  return {
    nctId,
    title: identificationModule.briefTitle,
    phase: normalisePhase(designModule?.phases),
    status: normaliseStatus(statusModule?.overallStatus),
    sponsor:
      leadSponsor && typeof leadSponsor.name === "string"
        ? leadSponsor.name
        : null,
    interventions: readInterventionNames(interventionsModule),
    startDate:
      startDateStruct &&
      typeof startDateStruct.date === "string"
        ? startDateStruct.date
        : null,
    url: `https://clinicaltrials.gov/study/${nctId}`,
  };
}

function readStudies(payload: unknown): unknown[] {
  if (!isRecord(payload)) {
    throw new Error(
      "ClinicalTrials.gov returned an invalid response.",
    );
  }

  if (!Array.isArray(payload.studies)) {
    return [];
  }

  return payload.studies;
}

async function requestStudies(
  diseaseName: string,
  searchParameter: "query.intr" | "query.term",
  searchTerm: string,
): Promise<Trial[]> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const parameters = new URLSearchParams({
    "query.cond": diseaseName,
    [searchParameter]: searchTerm,
    fields: REQUESTED_FIELDS,
    pageSize: String(TRIALS_PER_QUERY),
    format: "json",
    sort: "LastUpdatePostDate:desc",
  });

  try {
    const response = await fetch(
      `${CLINICAL_TRIALS_API_URL}?${parameters.toString()}`,
      {
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
        `ClinicalTrials.gov request failed with status ${response.status}. ${errorDetail}`,
      );
    }

    const payload: unknown = await response.json();

    const trials = readStudies(payload)
      .map(parseTrial)
      .filter((trial): trial is Trial => trial !== null);

    if (searchParameter === "query.term") {
      return trials;
    }

    return trials.filter((trial) =>
      trial.interventions.some((interventionName) =>
        interventionMatchesSearchTerm(
          interventionName,
          searchTerm,
        ),
      ),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "ClinicalTrials.gov request timed out.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function prepareDrugNames(knownDrugs: string[]): string[] {
  const names: string[] = [];
  const seenNames = new Set<string>();

  for (const drugName of knownDrugs) {
    const trimmedName = drugName.trim();
    const normalisedName = normaliseDrugName(trimmedName);

    if (!normalisedName || seenNames.has(normalisedName)) {
      continue;
    }

    seenNames.add(normalisedName);
    names.push(trimmedName);

    if (names.length === MAX_DRUG_QUERIES) {
      break;
    }
  }

  return names;
}

function buildTrialSource(trial: Trial): Source {
  return {
    id: `ct:${trial.nctId}`,
    type: "clinical_trial",
    label: trial.nctId,
    url: trial.url,
  };
}

export async function getTrialsForTarget(
  input: GetTrialsForTargetInput,
): Promise<ClinicalTrialsResult> {
  const diseaseName = input.diseaseName.trim();
  const targetSymbol = input.targetSymbol.trim();
  const drugNames = prepareDrugNames(input.knownDrugs);

  if (!diseaseName) {
    throw new Error("Disease name is required.");
  }

  if (!targetSymbol) {
    throw new Error("Target symbol is required.");
  }

  const trialsById = new Map<string, Trial>();

  if (drugNames.length > 0) {
    for (const drugName of drugNames) {
      const trials = await requestStudies(
        diseaseName,
        "query.intr",
        drugName,
      );

      for (const trial of trials) {
        trialsById.set(trial.nctId, trial);
      }
    }

    const trials = Array.from(trialsById.values());

    return {
      trials,
      linkageMethod: "known_drug",
      searchedTerms: drugNames,
      sources: trials.map(buildTrialSource),
    };
  }

  const fallbackTrials = await requestStudies(
    diseaseName,
    "query.term",
    targetSymbol,
  );

  for (const trial of fallbackTrials) {
    trialsById.set(trial.nctId, trial);
  }

  const trials = Array.from(trialsById.values());

  return {
    trials,
    linkageMethod: "target_keyword",
    searchedTerms: [targetSymbol],
    sources: trials.map(buildTrialSource),
  };
}