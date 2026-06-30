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

const SYNTHESIS_MAX_OUTPUT_TOKENS = 12000;
const SYNTHESIS_TIMEOUT_MS = 240000;
const MAX_ABSTRACT_CHARACTERS = 1400;

const HEADLINE_MAX_WORDS = 28;
const OVERALL_SUMMARY_MAX_WORDS = 40;
const LITERATURE_ANGLE_MAX_WORDS = 45;
const COMPETITIVE_SUMMARY_MAX_WORDS = 40;
const CASE_FOR_MAX_WORDS = 35;
const CASE_AGAINST_MAX_WORDS = 35;
const CONFIDENCE_RATIONALE_MAX_WORDS = 35;
const RECOMMENDATION_REASONING_MAX_WORDS = 45;
const RECOMMENDATION_RATIONALE_MAX_WORDS = 45;
const RECOMMENDATION_CAVEAT_MAX_WORDS = 35;

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

export interface SynthesisRecommendationItem {
  rank: number;
  ensemblId: string;
  symbol: string;
  rationale: SynthesisClaim;
  caveat: SynthesisClaim;
}

export interface SynthesisRecommendation {
  reasoning: string;
  shortlist: SynthesisRecommendationItem[];
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
  recommendation: SynthesisRecommendation;
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
discovery or business development team decide which targets to pursue, ending in a
ranked recommendation.

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

Recommendation rules:
- Produce a ranked shortlist of 3 to 5 targets most worth prioritising. Rank as an
  analyst deciding where to place a bet, not by raw association score.
- Explicitly weigh the competitive landscape. A crowded field can lower a strong
  target; credible evidence with open competitive space can raise another target.
- For each shortlisted target, provide a cited rationale grounded in that target's
  evidence and competitive position, plus a cited caveat stating the specific catch.
- The recommendation is a defensible suggestion that shows its work, not a verdict.
  Do not imply certainty beyond the supplied evidence.
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
  "recommendation": {
    "reasoning": "string",
    "shortlist": [
      {
        "rank": 1,
        "ensemblId": "string",
        "symbol": "string",
        "rationale": {
          "text": "string",
          "citation": {
            "sourceIds": ["source-id"]
          }
        },
        "caveat": {
          "text": "string",
          "citation": {
            "sourceIds": ["source-id"]
          }
        }
      }
    ]
  },
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
- recommendation.reasoning must contain 1 to 45 words and explain the basis for the
  ordering without making uncited target-specific claims.
- recommendation.shortlist must contain 3 to 5 unique supplied targets.
- recommendation ranks must be consecutive integers starting at 1, with shortlist
  entries ordered by rank.
- Each recommendation rationale must contain 8 to 45 words and cite only sources
  supplied for that shortlisted target. It must weigh evidence and competition rather
  than merely repeat the association score.
- Each recommendation caveat must contain 8 to 35 words and cite only sources
  supplied for that shortlisted target.
- Preserve each shortlisted target's ensemblId and symbol exactly.
- Do not rank targets by simply re-sorting associationScore.
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

function extractJsonObject(rawText: string): string {
  const strippedText =
    stripJsonCodeFence(rawText);

  const objectStart =
    strippedText.indexOf("{");

  if (objectStart === -1) {
    return strippedText;
  }

  let depth = 0;
  let insideString = false;
  let escaping = false;

  for (
    let index = objectStart;
    index < strippedText.length;
    index += 1
  ) {
    const character = strippedText[index];

    if (insideString) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (character === "\\") {
        escaping = true;
        continue;
      }

      if (character === '"') {
        insideString = false;
      }

      continue;
    }

    if (character === '"') {
      insideString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return strippedText
          .slice(objectStart, index + 1)
          .trim();
      }
    }
  }

  return strippedText.slice(objectStart).trim();
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
  fallbackSourceId: string | null = null,
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

  const validSourceIds: string[] = [];
  const removedSourceIds: string[] = [];
  let replacementSourceId: string | null = null;

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
        removedSourceIds.push(sourceId);
        return;
      }

      if (!validSourceIds.includes(sourceId)) {
        validSourceIds.push(sourceId);
      }
    },
  );

  if (
    validSourceIds.length === 0 &&
    fallbackSourceId &&
    allowedSourceIds.has(fallbackSourceId)
  ) {
    validSourceIds.push(fallbackSourceId);
    replacementSourceId = fallbackSourceId;
  }

  if (removedSourceIds.length > 0) {
    console.warn(
      "Synthesis citation was normalised:",
      {
        path,
        removedSourceIds,
        replacementSourceId,
      },
    );
  }

  if (validSourceIds.length === 0) {
    errors.push(
      `${path}.sourceIds must contain at least one valid source id.`,
    );
    return null;
  }

  return {
    sourceIds: validSourceIds,
  };
}

function validateClaim(
  value: unknown,
  path: string,
  allowedSourceIds: Set<string>,
  maximumWords: number,
  errors: string[],
  minimumWords = 1,
  fallbackSourceId: string | null = null,
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
    fallbackSourceId,
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
  fallbackSourceId: string | null = null,
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
        fallbackSourceId,
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

function validateRecommendationReasoning(
  value: unknown,
  path: string,
  errors: string[],
): string | null {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    errors.push(
      `${path} must be a non-empty string.`,
    );
    return null;
  }

  const wordCount = countWords(value);

  if (
    wordCount >
    RECOMMENDATION_REASONING_MAX_WORDS
  ) {
    errors.push(
      `${path} contains ${wordCount} words; maximum is ${RECOMMENDATION_REASONING_MAX_WORDS}.`,
    );
  }

  return value.trim();
}

function validateRecommendationItem(
  value: unknown,
  index: number,
  evidenceBundle: EvidenceBundle,
  seenTargetIds: Set<string>,
  errors: string[],
): SynthesisRecommendationItem | null {
  const path = `recommendation.shortlist[${index}]`;

  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }

  const rank = value.rank;
  const ensemblId = value.ensemblId;
  const symbol = value.symbol;

  if (
    typeof rank !== "number" ||
    !Number.isInteger(rank)
  ) {
    errors.push(
      `${path}.rank must be an integer.`,
    );
  } else if (rank !== index + 1) {
    errors.push(
      `${path}.rank must be ${index + 1}.`,
    );
  }

  if (
    typeof ensemblId !== "string" ||
    ensemblId.trim().length === 0
  ) {
    errors.push(
      `${path}.ensemblId must be a non-empty string.`,
    );
    return null;
  }

  const expectedTarget =
    evidenceBundle.targets.find(
      (target) =>
        target.ensemblId === ensemblId,
    );

  if (!expectedTarget) {
    errors.push(
      `${path}.ensemblId must identify a supplied target.`,
    );
    return null;
  }

  if (seenTargetIds.has(ensemblId)) {
    errors.push(
      `${path}.ensemblId duplicates a target already in the shortlist.`,
    );
  } else {
    seenTargetIds.add(ensemblId);
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

  const firstSourceIdOfType = (
    sourceType: Source["type"],
  ): string | null =>
    expectedTarget.sources.find(
      (source) => source.type === sourceType,
    )?.id ?? null;

  const openTargetsFallback =
    firstSourceIdOfType("open_targets");
  const trialFallback =
    firstSourceIdOfType("clinical_trial");
  const literatureFallback =
    firstSourceIdOfType("literature");
  const generalFallback =
    openTargetsFallback ??
    trialFallback ??
    literatureFallback ??
    null;

  const rationale = validateClaim(
    value.rationale,
    `${path}.rationale`,
    allowedSourceIds,
    RECOMMENDATION_RATIONALE_MAX_WORDS,
    errors,
    MIN_SUBSTANTIVE_CLAIM_WORDS,
    trialFallback ??
      openTargetsFallback ??
      generalFallback,
  );

  const caveat = validateClaim(
    value.caveat,
    `${path}.caveat`,
    allowedSourceIds,
    RECOMMENDATION_CAVEAT_MAX_WORDS,
    errors,
    MIN_SUBSTANTIVE_CLAIM_WORDS,
    openTargetsFallback ??
      trialFallback ??
      generalFallback,
  );

  if (
    typeof rank !== "number" ||
    !Number.isInteger(rank) ||
    typeof symbol !== "string" ||
    !rationale ||
    !caveat
  ) {
    return null;
  }

  return {
    rank,
    ensemblId,
    symbol,
    rationale,
    caveat,
  };
}

function validateRecommendation(
  value: unknown,
  evidenceBundle: EvidenceBundle,
  errors: string[],
): SynthesisRecommendation | null {
  const path = "recommendation";

  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }

  const reasoning =
    validateRecommendationReasoning(
      value.reasoning,
      `${path}.reasoning`,
      errors,
    );

  const shortlistValue = value.shortlist;
  const shortlist: SynthesisRecommendationItem[] = [];

  if (!Array.isArray(shortlistValue)) {
    errors.push(
      `${path}.shortlist must be an array.`,
    );
  } else {
    if (
      shortlistValue.length < 3 ||
      shortlistValue.length > 5
    ) {
      errors.push(
        `${path}.shortlist must contain 3 to 5 items; received ${shortlistValue.length}.`,
      );
    }

    if (
      shortlistValue.length >
      evidenceBundle.targets.length
    ) {
      errors.push(
        `${path}.shortlist cannot contain more items than the evidence bundle has targets.`,
      );
    }

    const seenTargetIds = new Set<string>();

    shortlistValue.forEach(
      (itemValue, index) => {
        const item =
          validateRecommendationItem(
            itemValue,
            index,
            evidenceBundle,
            seenTargetIds,
            errors,
          );

        if (item) {
          shortlist.push(item);
        }
      },
    );
  }

  if (
    !reasoning ||
    shortlist.length < 3 ||
    shortlist.length > 5
  ) {
    return null;
  }

  return {
    reasoning,
    shortlist,
  };
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

  const firstSourceIdOfType = (
    sourceType: Source["type"],
  ): string | null =>
    expectedTarget.sources.find(
      (source) => source.type === sourceType,
    )?.id ?? null;

  const openTargetsFallback =
    firstSourceIdOfType("open_targets");
  const trialFallback =
    firstSourceIdOfType("clinical_trial");
  const literatureFallback =
    firstSourceIdOfType("literature");
  const generalFallback =
    openTargetsFallback ??
    literatureFallback ??
    trialFallback ??
    null;

  const literatureAngle = validateClaim(
    value.literatureAngle,
    `${path}.literatureAngle`,
    allowedSourceIds,
    LITERATURE_ANGLE_MAX_WORDS,
    errors,
    1,
    literatureFallback ?? generalFallback,
  );

  const competitiveLandscapeSummary =
    validateClaim(
      value.competitiveLandscapeSummary,
      `${path}.competitiveLandscapeSummary`,
      allowedSourceIds,
      COMPETITIVE_SUMMARY_MAX_WORDS,
      errors,
      1,
      trialFallback ?? generalFallback,
    );

  const caseFor =
    validateSingleClaimArray(
      value.caseFor,
      `${path}.caseFor`,
      allowedSourceIds,
      CASE_FOR_MAX_WORDS,
      MIN_SUBSTANTIVE_CLAIM_WORDS,
      errors,
      openTargetsFallback ?? generalFallback,
    );

  const caseAgainst =
    validateSingleClaimArray(
      value.caseAgainst,
      `${path}.caseAgainst`,
      allowedSourceIds,
      CASE_AGAINST_MAX_WORDS,
      MIN_SUBSTANTIVE_CLAIM_WORDS,
      errors,
      openTargetsFallback ?? generalFallback,
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
    1,
    openTargetsFallback ?? generalFallback,
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
    extractJsonObject(rawText);

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

  const recommendation =
    validateRecommendation(
      parsed.recommendation,
      evidenceBundle,
      errors,
    );

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

  if (!recommendation) {
    errors.push(
      "recommendation could not be validated.",
    );
  }

  if (
    errors.length > 0 ||
    !headline ||
    !recommendation
  ) {
    throw new SynthesisValidationError(
      errors,
    );
  }

  return {
    headline,
    overallSummary,
    recommendation,
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
    recommendation:
      synthesisDraft.recommendation,
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