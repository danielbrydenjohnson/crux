import type { TargetBrief } from "@/lib/types";

interface ConfidenceChipProps {
  confidence: TargetBrief["confidence"];
}

const CONFIDENCE_LABELS: Record<
  TargetBrief["confidence"],
  string
> = {
  high: "High confidence",
  moderate: "Moderate confidence",
  low: "Low confidence",
};

const CONFIDENCE_MARKS: Record<
  TargetBrief["confidence"],
  string
> = {
  high: "●",
  moderate: "◐",
  low: "○",
};

const CONFIDENCE_CLASSES: Record<
  TargetBrief["confidence"],
  string
> = {
  high:
    "border-evidence-3 bg-accent-tint text-accent-deep",
  moderate:
    "border-evidence-2 bg-surface-sunk text-slate",
  low:
    "border-hairline bg-surface text-slate",
};

export function ConfidenceChip({
  confidence,
}: ConfidenceChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-ui text-[12px] font-medium ${CONFIDENCE_CLASSES[confidence]}`}
    >
      <span aria-hidden="true">
        {CONFIDENCE_MARKS[confidence]}
      </span>

      <span>{CONFIDENCE_LABELS[confidence]}</span>
    </span>
  );
}