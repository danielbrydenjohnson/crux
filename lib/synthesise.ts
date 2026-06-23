import Anthropic from "@anthropic-ai/sdk";

import type {
  Brief,
  Claim,
  EvidenceBundle,
  EvidenceType,
  Source,
  TargetEvidence,
  TrialLinkage,
  TractabilitySummary,
} from "@/lib/types";

const SYNTHESIS_MAX_OUTPUT_TOKENS = 8000;
const SYNTHESIS_TIMEOUT_MS = 180000;
const MAX_ABSTRACT_CHARACTERS = 1400;

const HEADLINE_MAX_WORDS = 28;
const OVERALL_SUMMARY_MAX_WORDS = 40;
const LITERATURE_ANGLE_MAX_WORDS = 45;
const COMPETITIVE_SUMMARY_MAX_WORDS = 40;
const CASE_FOR_MAX_WORDS = 35;
const CASE_AGAINST_MAX_WORDS = 35;
const CONFIDENCE_RATIONALE_MAX_WORDS = 35;

const MIN_SUBSTANTIVE_CLAIM_WORDS = 8;

type Confidence = "high" | "moderate" | "low";

type ClaudeOperation =
  | "synthesis"
  | "synthesis repair";

interface SynthesisSource {
  id: string;
  type:
    | "open_targets"
    | "clinical_trial"
    | "literature";
  label: string;
}

interface SynthesisTrial {
  nctId: string;
  phase: string;
  status: string;
  sponsor: string | null;
  interventions: string[];
}

interface SynthesisPaper {
  id: string;
  title: string;
  year: number | null;
  citationCount: number | null;
  abstract: string | null;
}

interface SynthesisTargetEvidence {
  ensemblId: string;
  symbol: string;
  associationScore: number;
  evidenceBreakdown: EvidenceType[];
  tractability: TractabilitySummary;
  knownDrugs: string[];
  trialLinkage: TrialLinkage;
  trials: SynthesisTrial[];
  literature: SynthesisPaper[];
  sources: SynthesisSource[];
}

interface SynthesisEvidence {
  query: EvidenceBundle["query"];
  targetCount: number;
  targets: SynthesisTargetEvidence[];
}

export interface SynthesisCitation {
  sourceIds: string[];
}

export interface SynthesisClaim {
  text: string;
  citation: SynthesisCitation;
}

export interface SynthesisTargetDraft {
  ensemblId: string;
  symbol: string;
  literatureAngle: SynthesisClaim;
  competitiveLandscapeSummary: SynthesisClaim;
  caseFor: SynthesisClaim[];
  caseAgainst: SynthesisClaim[];
  confidence: Confidence;
  confidenceRationale: SynthesisClaim;
}

export interface SynthesisDraft {
  headline: SynthesisClaim;
  overallSummary: SynthesisClaim[];
  targets: SynthesisTargetDraft[];
}

export class SynthesisValidationError extends Error {
  readonly validationErrors: string[];

  constructor(validationErrors: string[]) {
    super(
      `Claude synthesis failed validation with ${
        validationErrors.length
      } error${validationErrors.length === 1 ? "" : "s"}.`,
    );

    this.name = "SynthesisValidationError";
    this.validationErrors = validationErrors;
  }
}

export const SYNTHESIS_SYSTEM_PROMPT = `You are a senior biotech target-intelligence analyst. You are given a structured
evidence bundle assembled from Open Targets, ClinicalTrials.gov, and Europe PMC for
a specified disease. Produce a rigorous, decision-ready brief that helps a drug
discovery or business development team decide which targets to pursue.

Hard rules:
- Use ONLY the evidence in the provided bundle. Do not introduce any fact, drug,
  trial, association, or number that is not present in the bundle. If evidence for
  something is thin or missing, say so plainly. Never fill a gap with outside or
  assumed knowledge.
- Every substantive claim must cite its supporting source(s) by their source id from
  the bundle. A claim with no supporting source in the bundle must not be made.
- For every target, provide BOTH a case for and a case against pursuing it. The case
  against is mandatory and must be substantive (e.g. crowded competition, weak or
  text-mining-only evidence, poor tractability, safety or redundancy concerns).
  Never omit, soften, or pad the case against to make a target look better or worse
  than the evidence supports.
- Distinguish strength of evidence honestly. An association driven by genetic
  evidence and known drugs is stronger than one driven mainly by literature
  co-occurrence. Reflect this in the confidence rating and rationale.
- Write for an expert reader. Be concise and precise. No marketing language, no
  hedging filler, no restating the question.

Return ONLY a JSON object matching the schema provided in the user message. No prose
outside the JSON, no markdown code fences.`;

const SYNTHESIS_DRAFT_SCHEMA_INSTRUCTIONS = `Return one JSON object with exactly this structure:

{
  "headline": {
    "text": "string",
    "citation": {
      "sourceIds": ["source-id"]
    }
  },
  "overallSummary": [
    {
      "text": "string",
      "citation": {
        "sourceIds": ["source-id"]
      }
    }
  ],
  "targets": [
    {
      "ensemblId": "string",
      "symbol": "string",
      "literatureAngle": {
        "text": "string",
        "citation": {
          "sourceIds": ["source-id"]
        }
      },
      "competitiveLandscapeSummary": {
        "text": "string",
        "citation": {
          "sourceIds": ["source-id"]
        }
      },
      "caseFor": [
        {
          "text": "string",
          "citation": {
            "sourceIds": ["source-id"]
          }
        }
      ],
      "caseAgainst": [
        {
          "text": "string",
          "citation": {
            "sourceIds": ["source-id"]
          }
        }
      ],
      "confidence": "high, moderate, or low",
      "confidenceRationale": {
        "text": "string",
        "citation": {
          "sourceIds": ["source-id"]
        }
      }
    }
  ]
}

Strict output requirements:

- Return only the analytical synthesis described by this schema.
- Do not reproduce query metadata, target names, scores, evidence breakdowns,
  trials, source records, URLs, timestamps, drug lists, tractability labels, or
  other deterministic data.
- TypeScript will merge deterministic fields into the final brief.
- Return every supplied target exactly once and in the supplied order.
- Preserve every ensemblId and symbol exactly.
- Do not create, omit, merge, rename, or reorder targets.
- The targets array must contain exactly the stated target count.
- Every Claim must contain non-empty text and at least one valid source id.
- Every target Claim may cite only source ids supplied for that target.
- Use exactly one sentence for the headline, with no more than 28 words.
- Return exactly two overallSummary claims.
- Each overallSummary claim must contain no more than 40 words.
- Each literatureAngle must contain no more than 45 words.
- Each competitiveLandscapeSummary must contain no more than 40 words.
- Return exactly one caseFor claim for each target.
- Return exactly one substantive caseAgainst claim for each target.
- Each caseFor and caseAgainst claim must contain no more than 35 words.
- Each confidenceRationale must contain no more than 35 words.
- Treat target_keyword trial linkage as weaker than known_drug linkage.
- Shared trials for a multi-target drug do not establish which individual target
  drives activity. State this limitation where relevant.
- Do not describe association evidence as causal proof.
- Do not describe a target as clinically validated solely because a multi-target
  drug is clinically used or studied.
- Do not claim that evidence does not exist globally. State only that it is absent
  from or not present in the supplied evidence.
- Do not infer mechanisms, safety concerns, redundancy, or competitive conclusions
  unless directly supported by the supplied evidence.
- Return plain JSON only.`;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function countWords(text: string): number {
  const trimmed = text.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function stripJsonCodeFence(rawText: string): string {
  const trimmed = rawText.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function getAnthropicConfiguration(): {
  apiKey: string;
  model: string;
} {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured.",
    );
  }

  if (!model) {
    throw new Error(
      "ANTHROPIC_MODEL is not configured.",
    );
  }

  return {
    apiKey,
    model,
  };
}

function truncateAbstract(
  abstract: string | null,
): string | null {
  if (
    abstract === null ||
    abstract.length <= MAX_ABSTRACT_CHARACTERS
  ) {
    return abstract;
  }

  const initialSlice = abstract.slice(
    0,
    MAX_ABSTRACT_CHARACTERS,
  );

  const lastSentenceEnd =
    initialSlice.lastIndexOf(". ");

  if (
    lastSentenceEnd >=
    Math.floor(MAX_ABSTRACT_CHARACTERS * 0.6)
  ) {
    return initialSlice
      .slice(0, lastSentenceEnd + 1)
      .trim();
  }

  return `${initialSlice.trim()}…`;
}

function buildSynthesisEvidence(
  evidenceBundle: EvidenceBundle,
): SynthesisEvidence {
  return {
    query: evidenceBundle.query,
    targetCount: evidenceBundle.targets.length,
    targets: evidenceBundle.targets.map((target) => ({
      ensemblId: target.ensemblId,
      symbol: target.symbol,
      associationScore: target.associationScore,
      evidenceBreakdown: target.evidenceBreakdown,
      tractability: target.tractability,
      knownDrugs: target.knownDrugs,
      trialLinkage: target.trialLinkage,
      trials: target.trials.map((trial) => ({
        nctId: trial.nctId,
        phase: trial.phase,
        status: trial.status,
        sponsor: trial.sponsor,
        interventions: trial.interventions,
      })),
      literature: target.literature.map((paper) => ({
        id: paper.id,
        title: paper.title,
        year: paper.year,
        citationCount: paper.citationCount,
        abstract: truncateAbstract(paper.abstract),
      })),
      sources: target.sources.map((source) => ({
        id: source.id,
        type: source.type,
        label: source.label,
      })),
    })),
  };
}

function extractTextResponse(
  content: Anthropic.Messages.ContentBlock[],
): string {
  const text = content
    .filter(
      (
        block,
      ): block is Anthropic.Messages.TextBlock =>
        block.type === "text",
    )
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error(
      "Claude returned no text content for the brief.",
    );
  }

  return text;
}

function buildSynthesisUserMessage(
  evidenceBundle: EvidenceBundle,
): string {
  const synthesisEvidence =
    buildSynthesisEvidence(evidenceBundle);

  const targetSymbols =
    synthesisEvidence.targets.map(
      (target) => target.symbol,
    );

  return [
    "Produce the analytical synthesis using the schema and evidence below.",
    "",
    `The evidence contains exactly ${synthesisEvidence.targetCount} targets.`,
    `Required target order: ${targetSymbols.join(", ")}.`,
    "",
    "OUTPUT SCHEMA AND REQUIREMENTS",
    SYNTHESIS_DRAFT_SCHEMA_INSTRUCTIONS,
    "",
    "COMPACT EVIDENCE",
    JSON.stringify(synthesisEvidence),
  ].join("\n");
}

function buildRepairUserMessage(
  evidenceBundle: EvidenceBundle,
  candidateResponse: string,
  validationErrors: string[],
): string {
  const synthesisEvidence =
    buildSynthesisEvidence(evidenceBundle);

  const targetSymbols =
    synthesisEvidence.targets.map(
      (target) => target.symbol,
    );

  const formattedErrors = validationErrors
    .map(
      (validationError, index) =>
        `${index + 1}. ${validationError}`,
    )
    .join("\n");

  return [
    "Repair the candidate synthesis JSON below.",
    "",
    "Return the complete corrected JSON object, not a patch and not an explanation.",
    "Preserve content that already complies with the schema.",
    "Fix every listed validation error.",
    "Use only the supplied compact evidence.",
    "",
    `The evidence contains exactly ${synthesisEvidence.targetCount} targets.`,
    `Required target order: ${targetSymbols.join(", ")}.`,
    "",
    "VALIDATION ERRORS",
    formattedErrors,
    "",
    "OUTPUT SCHEMA AND REQUIREMENTS",
    SYNTHESIS_DRAFT_SCHEMA_INSTRUCTIONS,
    "",
    "COMPACT EVIDENCE",
    JSON.stringify(synthesisEvidence),
    "",
    "CANDIDATE JSON",
    stripJsonCodeFence(candidateResponse),
  ].join("\n");
}

async function requestClaudeText(
  userMessage: string,
  operation: ClaudeOperation,
): Promise<string> {
  const { apiKey, model } =
    getAnthropicConfiguration();

  const anthropic = new Anthropic({
    apiKey,
    timeout: SYNTHESIS_TIMEOUT_MS,
  });

  console.info(`Claude ${operation} request:`, {
    requestCharacters: userMessage.length,
  });

  const message =
    await anthropic.messages.create({
      model,
      max_tokens: SYNTHESIS_MAX_OUTPUT_TOKENS,
      temperature: 0,
      system: SYNTHESIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

  console.info(`Claude ${operation} completed:`, {
    stopReason: message.stop_reason,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error(
      `Claude ${operation} reached the output token limit.`,
    );
  }

  if (message.stop_reason !== "end_turn") {
    throw new Error(
      `Claude ${operation} stopped unexpectedly: ${
        message.stop_reason ?? "unknown"
      }.`,
    );
  }

  return extractTextResponse(message.content);
}

function validateCitation(
  value: unknown,
  path: string,
  allowedSourceIds: Set<string>,
  errors: string[],
): SynthesisCitation | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }

  const sourceIdsValue = value.sourceIds;

  if (!Array.isArray(sourceIdsValue)) {
    errors.push(
      `${path}.sourceIds must be an array.`,
    );
    return null;
  }

  if (sourceIdsValue.length === 0) {
    errors.push(
      `${path}.sourceIds must contain at least one source id.`,
    );
    return null;
  }

  const sourceIds: string[] = [];

  sourceIdsValue.forEach(
    (sourceId, index) => {
      if (
        typeof sourceId !== "string" ||
        sourceId.trim().length === 0
      ) {
        errors.push(
          `${path}.sourceIds[${index}] must be a non-empty string.`,
        );
        return;
      }

      if (!allowedSourceIds.has(sourceId)) {
        errors.push(
          `${path}.sourceIds contains source id "${sourceId}" that is not valid for this claim.`,
        );
      }

      sourceIds.push(sourceId);
    },
  );

  return {
    sourceIds,
  };
}

function validateClaim(
  value: unknown,
  path: string,
  allowedSourceIds: Set<string>,
  maximumWords: number,
  errors: string[],
  minimumWords = 1,
): SynthesisClaim | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }

  const textValue = value.text;

  if (
    typeof textValue !== "string" ||
    textValue.trim().length === 0
  ) {
    errors.push(
      `${path}.text must be a non-empty string.`,
    );
    return null;
  }

  const wordCount = countWords(textValue);

  if (wordCount < minimumWords) {
    errors.push(
      `${path}.text must contain at least ${minimumWords} words.`,
    );
  }

  if (wordCount > maximumWords) {
    errors.push(
      `${path}.text contains ${wordCount} words; maximum is ${maximumWords}.`,
    );
  }

  const citation = validateCitation(
    value.citation,
    `${path}.citation`,
    allowedSourceIds,
    errors,
  );

  if (!citation) {
    return null;
  }

  return {
    text: textValue.trim(),
    citation,
  };
}

function validateSingleClaimArray(
  value: unknown,
  path: string,
  allowedSourceIds: Set<string>,
  maximumWords: number,
  minimumWords: number,
  errors: string[],
): SynthesisClaim[] {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return [];
  }

  if (value.length !== 1) {
    errors.push(
      `${path} must contain exactly one claim; received ${value.length}.`,
    );
  }

  const claims: SynthesisClaim[] = [];

  value.forEach(
    (claimValue, index) => {
      const claim = validateClaim(
        claimValue,
        `${path}[${index}]`,
        allowedSourceIds,
        maximumWords,
        errors,
        minimumWords,
      );

      if (claim) {
        claims.push(claim);
      }
    },
  );

  return claims;
}

function validateConfidence(
  value: unknown,
  path: string,
  errors: string[],
): Confidence | null {
  if (
    value !== "high" &&
    value !== "moderate" &&
    value !== "low"
  ) {
    errors.push(
      `${path} must be "high", "moderate", or "low".`,
    );
    return null;
  }

  return value;
}

function validateTargetDraft(
  value: unknown,
  index: number,
  evidenceBundle: EvidenceBundle,
  errors: string[],
): SynthesisTargetDraft | null {
  const path = `targets[${index}]`;
  const expectedTarget =
    evidenceBundle.targets[index];

  if (!expectedTarget) {
    errors.push(
      `${path} has no corresponding target in the evidence bundle.`,
    );
    return null;
  }

  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }

  const ensemblId = value.ensemblId;
  const symbol = value.symbol;

  if (ensemblId !== expectedTarget.ensemblId) {
    errors.push(
      `${path}.ensemblId must be "${expectedTarget.ensemblId}".`,
    );
  }

  if (symbol !== expectedTarget.symbol) {
    errors.push(
      `${path}.symbol must be "${expectedTarget.symbol}".`,
    );
  }

  const allowedSourceIds = new Set(
    expectedTarget.sources.map(
      (source) => source.id,
    ),
  );

  const literatureAngle = validateClaim(
    value.literatureAngle,
    `${path}.literatureAngle`,
    allowedSourceIds,
    LITERATURE_ANGLE_MAX_WORDS,
    errors,
  );

  const competitiveLandscapeSummary =
    validateClaim(
      value.competitiveLandscapeSummary,
      `${path}.competitiveLandscapeSummary`,
      allowedSourceIds,
      COMPETITIVE_SUMMARY_MAX_WORDS,
      errors,
    );

  const caseFor =
    validateSingleClaimArray(
      value.caseFor,
      `${path}.caseFor`,
      allowedSourceIds,
      CASE_FOR_MAX_WORDS,
      MIN_SUBSTANTIVE_CLAIM_WORDS,
      errors,
    );

  const caseAgainst =
    validateSingleClaimArray(
      value.caseAgainst,
      `${path}.caseAgainst`,
      allowedSourceIds,
      CASE_AGAINST_MAX_WORDS,
      MIN_SUBSTANTIVE_CLAIM_WORDS,
      errors,
    );

  const confidence = validateConfidence(
    value.confidence,
    `${path}.confidence`,
    errors,
  );

  const confidenceRationale = validateClaim(
    value.confidenceRationale,
    `${path}.confidenceRationale`,
    allowedSourceIds,
    CONFIDENCE_RATIONALE_MAX_WORDS,
    errors,
  );

  if (
    typeof ensemblId !== "string" ||
    typeof symbol !== "string" ||
    !literatureAngle ||
    !competitiveLandscapeSummary ||
    caseFor.length === 0 ||
    caseAgainst.length === 0 ||
    !confidence ||
    !confidenceRationale
  ) {
    return null;
  }

  return {
    ensemblId,
    symbol,
    literatureAngle,
    competitiveLandscapeSummary,
    caseFor,
    caseAgainst,
    confidence,
    confidenceRationale,
  };
}

export function parseAndValidateSynthesisDraft(
  rawText: string,
  evidenceBundle: EvidenceBundle,
): SynthesisDraft {
  const errors: string[] = [];
  const jsonText =
    stripJsonCodeFence(rawText);

  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown JSON parsing error.";

    throw new SynthesisValidationError([
      `Response is not valid JSON: ${message}`,
    ]);
  }

  if (!isRecord(parsed)) {
    throw new SynthesisValidationError([
      "Response root must be a JSON object.",
    ]);
  }

  const allSourceIds = new Set(
    evidenceBundle.targets.flatMap((target) =>
      target.sources.map(
        (source) => source.id,
      ),
    ),
  );

  const headline = validateClaim(
    parsed.headline,
    "headline",
    allSourceIds,
    HEADLINE_MAX_WORDS,
    errors,
  );

  const overallSummaryValue =
    parsed.overallSummary;

  const overallSummary: SynthesisClaim[] = [];

  if (!Array.isArray(overallSummaryValue)) {
    errors.push(
      "overallSummary must be an array.",
    );
  } else {
    if (overallSummaryValue.length !== 2) {
      errors.push(
        `overallSummary must contain exactly two claims; received ${overallSummaryValue.length}.`,
      );
    }

    overallSummaryValue.forEach(
      (claimValue, index) => {
        const claim = validateClaim(
          claimValue,
          `overallSummary[${index}]`,
          allSourceIds,
          OVERALL_SUMMARY_MAX_WORDS,
          errors,
        );

        if (claim) {
          overallSummary.push(claim);
        }
      },
    );
  }

  const targetsValue = parsed.targets;
  const targets: SynthesisTargetDraft[] = [];

  if (!Array.isArray(targetsValue)) {
    errors.push("targets must be an array.");
  } else {
    if (
      targetsValue.length !==
      evidenceBundle.targets.length
    ) {
      errors.push(
        `targets must contain exactly ${
          evidenceBundle.targets.length
        } entries; received ${targetsValue.length}.`,
      );
    }

    targetsValue.forEach(
      (targetValue, index) => {
        const target = validateTargetDraft(
          targetValue,
          index,
          evidenceBundle,
          errors,
        );

        if (target) {
          targets.push(target);
        }
      },
    );
  }

  if (!headline) {
    errors.push(
      "headline could not be validated.",
    );
  }

  if (overallSummary.length !== 2) {
    errors.push(
      "overallSummary did not produce exactly two valid claims.",
    );
  }

  if (
    targets.length !==
    evidenceBundle.targets.length
  ) {
    errors.push(
      `Only ${targets.length} of ${
        evidenceBundle.targets.length
      } target drafts passed validation.`,
    );
  }

  if (errors.length > 0 || !headline) {
    throw new SynthesisValidationError(
      errors,
    );
  }

  return {
    headline,
    overallSummary,
    targets,
  };
}

function getTargetProfileSource(
  target: TargetEvidence,
): Source {
  const source =
    target.sources.find(
      (candidate) =>
        candidate.id ===
        `ot-target:${target.ensemblId}`,
    ) ??
    target.sources.find(
      (candidate) =>
        candidate.type ===
          "open_targets" &&
        candidate.label ===
          "Open Targets target profile",
    ) ??
    target.sources.find(
      (candidate) =>
        candidate.type ===
        "open_targets",
    );

  if (!source) {
    throw new Error(
      `No Open Targets source is available for ${target.symbol} tractability.`,
    );
  }

  return source;
}

function buildTractabilitySummary(
  target: TargetEvidence,
): Claim {
  const annotations = [
    {
      label: "small molecule",
      value:
        target.tractability.smallMolecule,
    },
    {
      label: "antibody",
      value: target.tractability.antibody,
    },
    {
      label: "other",
      value: target.tractability.other,
    },
  ].filter(
    (
      annotation,
    ): annotation is {
      label: string;
      value: string;
    } => annotation.value !== null,
  );

  const text =
    annotations.length === 0
      ? "Open Targets provides no positive tractability annotation for small-molecule, antibody, or other modalities in the supplied target profile."
      : `Open Targets reports the following tractability annotations: ${annotations
          .map(
            (annotation) =>
              `${annotation.label}, ${annotation.value}`,
          )
          .join("; ")}.`;

  const source =
    getTargetProfileSource(target);

  return {
    text,
    citation: {
      sourceIds: [source.id],
    },
  };
}

function deduplicateSources(
  evidenceBundle: EvidenceBundle,
): Source[] {
  const sourcesById =
    new Map<string, Source>();

  evidenceBundle.targets.forEach(
    (target) => {
      target.sources.forEach((source) => {
        if (!sourcesById.has(source.id)) {
          sourcesById.set(
            source.id,
            source,
          );
        }
      });
    },
  );

  return Array.from(
    sourcesById.values(),
  );
}

export function buildBriefFromSynthesisDraft(
  evidenceBundle: EvidenceBundle,
  synthesisDraft: SynthesisDraft,
): Brief {
  const targets =
    evidenceBundle.targets.map(
      (target, index) => {
        const synthesisTarget =
          synthesisDraft.targets[index];

        if (!synthesisTarget) {
          throw new Error(
            `No synthesis draft is available for target ${target.symbol}.`,
          );
        }

        if (
          synthesisTarget.ensemblId !==
            target.ensemblId ||
          synthesisTarget.symbol !==
            target.symbol
        ) {
          throw new Error(
            `Synthesis target identity does not match evidence target ${target.symbol}.`,
          );
        }

        return {
          ensemblId: target.ensemblId,
          symbol: target.symbol,
          name: target.name,
          associationScore:
            target.associationScore,
          evidenceBreakdown:
            target.evidenceBreakdown,
          tractabilitySummary:
            buildTractabilitySummary(target),
          competitiveLandscape: {
            summary:
              synthesisTarget
                .competitiveLandscapeSummary,
            trials: target.trials,
          },
          literatureAngle:
            synthesisTarget.literatureAngle,
          caseFor:
            synthesisTarget.caseFor,
          caseAgainst:
            synthesisTarget.caseAgainst,
          confidence:
            synthesisTarget.confidence,
          confidenceRationale:
            synthesisTarget
              .confidenceRationale,
        };
      },
    );

  return {
    query: evidenceBundle.query,
    overallSummary:
      synthesisDraft.overallSummary,
    headline: synthesisDraft.headline,
    targets,
    sources:
      deduplicateSources(evidenceBundle),
    generatedAt: new Date().toISOString(),
  };
}

export async function synthesiseBriefRaw(
  evidenceBundle: EvidenceBundle,
): Promise<string> {
  return requestClaudeText(
    buildSynthesisUserMessage(
      evidenceBundle,
    ),
    "synthesis",
  );
}

async function repairSynthesisBriefRaw(
  evidenceBundle: EvidenceBundle,
  candidateResponse: string,
  validationErrors: string[],
): Promise<string> {
  return requestClaudeText(
    buildRepairUserMessage(
      evidenceBundle,
      candidateResponse,
      validationErrors,
    ),
    "synthesis repair",
  );
}

export async function synthesiseBrief(
  evidenceBundle: EvidenceBundle,
): Promise<Brief> {
  const initialRawText =
    await synthesiseBriefRaw(
      evidenceBundle,
    );

  let synthesisDraft: SynthesisDraft;

  try {
    synthesisDraft =
      parseAndValidateSynthesisDraft(
        initialRawText,
        evidenceBundle,
      );
  } catch (error) {
    if (
      !(
        error instanceof
        SynthesisValidationError
      )
    ) {
      throw error;
    }

    console.warn(
      "Initial synthesis failed validation. Attempting one repair:",
      error.validationErrors,
    );

    const repairedRawText =
      await repairSynthesisBriefRaw(
        evidenceBundle,
        initialRawText,
        error.validationErrors,
      );

    try {
      synthesisDraft =
        parseAndValidateSynthesisDraft(
          repairedRawText,
          evidenceBundle,
        );
    } catch (repairError) {
      if (
        repairError instanceof
        SynthesisValidationError
      ) {
        throw new SynthesisValidationError([
          ...error.validationErrors.map(
            (validationError) =>
              `Initial response: ${validationError}`,
          ),
          ...repairError.validationErrors.map(
            (validationError) =>
              `Repair response: ${validationError}`,
          ),
        ]);
      }

      throw repairError;
    }
  }

  return buildBriefFromSynthesisDraft(
    evidenceBundle,
    synthesisDraft,
  );
}