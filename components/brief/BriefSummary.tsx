import { CitationMarker } from "@/components/brief/CitationMarker";
import type { Brief } from "@/lib/types";

interface BriefSummaryProps {
  brief: Brief;
}

export function BriefSummary({
  brief,
}: BriefSummaryProps) {
  if (brief.overallSummary.length === 0) {
    return null;
  }

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
    </section>
  );
}