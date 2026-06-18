export type SourceType =
  | "open_targets"
  | "clinical_trial"
  | "literature";

export interface Source {
  id: string;
  type: SourceType;
  label: string;
  url: string;
}

export interface EvidenceType {
  id: string;
  label: string;
  score: number;
}

export interface Trial {
  nctId: string;
  title: string;
  phase: string;
  status: string;
  sponsor: string | null;
  interventions: string[];
  startDate: string | null;
  url: string;
}

export interface Paper {
  id: string;
  title: string;
  year: number | null;
  citationCount: number | null;
  url: string;
}

export interface TractabilitySummary {
  smallMolecule: string | null;
  antibody: string | null;
  other: string | null;
}

export interface TargetEvidence {
  ensemblId: string;
  symbol: string;
  name: string;
  associationScore: number;
  evidenceBreakdown: EvidenceType[];
  tractability: TractabilitySummary;
  knownDrugs: string[];
  trials: Trial[];
  literature: Paper[];
  sources: Source[];
}

export interface EvidenceBundle {
  query: {
    input: string;
    efoId: string;
    diseaseName: string;
  };
  targets: TargetEvidence[];
  assembledAt: string;
}

export interface Citation {
  sourceIds: string[];
}

export interface Claim {
  text: string;
  citation: Citation;
}

export interface TargetBrief {
  ensemblId: string;
  symbol: string;
  name: string;
  associationScore: number;
  evidenceBreakdown: EvidenceType[];
  tractabilitySummary: Claim;
  competitiveLandscape: {
    summary: Claim;
    trials: Trial[];
  };
  literatureAngle: Claim;
  caseFor: Claim[];
  caseAgainst: Claim[];
  confidence: "high" | "moderate" | "low";
  confidenceRationale: string;
}

export interface Brief {
  query: {
    input: string;
    efoId: string;
    diseaseName: string;
  };
  overallSummary: string;
  headline: string;
  targets: TargetBrief[];
  sources: Source[];
  generatedAt: string;
}