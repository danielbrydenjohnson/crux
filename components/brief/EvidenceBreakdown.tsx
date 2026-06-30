import type { EvidenceType } from "@/lib/types";

interface EvidenceBreakdownProps {
  evidence: EvidenceType[];
  headingId: string;
}

function clampScore(score: number): number {
  return Math.min(1, Math.max(0, score));
}

function getEvidenceColour(score: number): string {
  if (score >= 0.75) {
    return "bg-evidence-4";
  }

  if (score >= 0.5) {
    return "bg-evidence-3";
  }

  if (score >= 0.25) {
    return "bg-evidence-2";
  }

  return "bg-evidence-1";
}

function formatScore(score: number): string {
  return clampScore(score).toFixed(2);
}

export function EvidenceBreakdown({
  evidence,
  headingId,
}: EvidenceBreakdownProps) {
  const sortedEvidence = [...evidence].sort(
    (first, second) => second.score - first.score,
  );

  return (
    <section aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="font-document text-[18px] font-semibold leading-[1.35] text-ink"
      >
        Open Targets evidence by type
      </h3>

      <p className="mt-2 font-ui text-[12px] leading-[1.5] text-slate">
        Independent category scores from 0 to 1. They do
        not add up to the overall association score.
      </p>

      {sortedEvidence.length === 0 ? (
        <p className="mt-4 font-ui text-[13px] leading-[1.5] text-slate">
          No evidence breakdown was returned for this
          target.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {sortedEvidence.map((item) => {
            const score = clampScore(item.score);
            const percentage = score * 100;

            return (
              <li key={item.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-4">
                  <span className="font-ui text-[13px] font-medium text-slate">
                    {item.label}
                  </span>

                  <span className="font-data text-[12px] font-medium text-mist">
                    {formatScore(score)}
                  </span>
                </div>

                <div
                  role="meter"
                  aria-label={`${item.label} evidence score`}
                  aria-valuemin={0}
                  aria-valuemax={1}
                  aria-valuenow={score}
                  className="h-2 overflow-hidden rounded-full bg-surface"
                >
                  <div
                    className={`h-full rounded-full ${getEvidenceColour(score)}`}
                    style={{
                      width: `${percentage}%`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}