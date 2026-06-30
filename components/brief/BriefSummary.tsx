import { CitationMarker } from "@/components/brief/CitationMarker";
import type { Brief } from "@/lib/types";

interface BriefSummaryProps {
  brief: Brief;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

export function BriefSummary({
  brief,
}: BriefSummaryProps) {
  const analysedTargetCount = brief.targets.length;
  const totalTargetsAvailable =
    brief.query.totalTargetsAvailable;

  const analysedTargetText =
    analysedTargetCount === 1
      ? "the top target"
      : `the top ${formatCount(analysedTargetCount)} targets`;

  const availableTargetText =
    totalTargetsAvailable === 1
      ? "1 associated target"
      : `${formatCount(totalTargetsAvailable)} associated targets`;

  return (
    <section
      aria-labelledby="brief-summary-heading"
      className="border-b border-hairline py-8"
    >
      <h2
        id="brief-summary-heading"
        className="font-document text-[22px] font-semibold leading-[1.3] text-ink"
      >
        Landscape summary
      </h2>

      <p className="mt-5 rounded-control border border-hairline bg-surface-sunk px-4 py-3 font-ui text-[13px] leading-[1.55] text-slate">
        This brief analyses {analysedTargetText} by Open
        Targets association strength out of{" "}
        {availableTargetText}.
      </p>

      {brief.overallSummary.length > 0 ? (
        <div className="mt-5 space-y-4">
          {brief.overallSummary.map(
            (claim, index) => (
              <p
                key={`${index}-${claim.text}`}
                className="max-w-[70ch] font-document text-[17px] leading-[1.65] text-ink"
              >
                {claim.text}
                <CitationMarker
                  sourceIds={
                    claim.citation.sourceIds
                  }
                  sources={brief.sources}
                />
              </p>
            ),
          )}
        </div>
      ) : null}
    </section>
  );
}