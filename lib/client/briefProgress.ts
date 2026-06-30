import type { Brief } from "@/lib/types";
import type { BriefStreamEvent } from "@/lib/stream";

export type BriefProgressStage =
  | "idle"
  | "starting"
  | "gathering"
  | "synthesising"
  | "complete"
  | "error";

export interface BriefProgressTarget {
  ensemblId: string;
  symbol: string;
  complete: boolean;
}

export interface BriefProgressState {
  stage: BriefProgressStage;
  disease: {
    efoId: string;
    name: string;
  } | null;
  targetCount: number;
  totalTargetsAvailable: number;
  completedTargetCount: number;
  targets: BriefProgressTarget[];
  brief: Brief | null;
  error: string | null;
}

export const INITIAL_BRIEF_PROGRESS_STATE: BriefProgressState = {
  stage: "idle",
  disease: null,
  targetCount: 0,
  totalTargetsAvailable: 0,
  completedTargetCount: 0,
  targets: [],
  brief: null,
  error: null,
};

export function createStartingBriefProgressState(
  disease: {
    efoId: string;
    name: string;
  },
): BriefProgressState {
  return {
    ...INITIAL_BRIEF_PROGRESS_STATE,
    stage: "starting",
    disease,
  };
}

export function reduceBriefProgress(
  state: BriefProgressState,
  event: BriefStreamEvent,
): BriefProgressState {
  switch (event.type) {
    case "started":
      return {
        ...state,
        stage: "starting",
        error: null,
      };

    case "targets_found":
      return {
        ...state,
        stage: "gathering",
        disease: event.disease,
        targetCount: event.targetCount,
        totalTargetsAvailable:
          event.totalTargetsAvailable,
        completedTargetCount: 0,
        targets: event.targets.map((target) => ({
          ...target,
          complete: false,
        })),
        error: null,
      };

    case "target_complete":
      return {
        ...state,
        stage: "gathering",
        targetCount: event.total,
        completedTargetCount: event.completed,
        targets: state.targets.map((target) =>
          target.ensemblId === event.ensemblId
            ? {
                ...target,
                complete: true,
              }
            : target,
        ),
      };

    case "evidence_complete":
      return {
        ...state,
        stage: "gathering",
        targetCount: event.targetCount,
        completedTargetCount: event.targetCount,
        targets: state.targets.map((target) => ({
          ...target,
          complete: true,
        })),
      };

    case "synthesising":
      return {
        ...state,
        stage: "synthesising",
      };

    case "complete":
      return {
        ...state,
        stage: "complete",
        disease: {
          efoId: event.brief.query.efoId,
          name: event.brief.query.diseaseName,
        },
        targetCount: event.brief.targets.length,
        totalTargetsAvailable:
          event.brief.query.totalTargetsAvailable,
        completedTargetCount:
          event.brief.targets.length,
        brief: event.brief,
        error: null,
      };

    case "error":
      return {
        ...state,
        stage: "error",
        error: event.message,
      };
  }
}