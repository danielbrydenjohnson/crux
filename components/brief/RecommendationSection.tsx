import { CitationMarker } from "@/components/brief/CitationMarker";
import type {
  Recommendation,
  Source,
} from "@/lib/types";

interface RecommendationSectionProps {
  recommendation: Recommendation;
  sources: Source[];
}

export function RecommendationSection({
  recommendation,
  sources,
}: RecommendationSectionProps) {
  if (recommendation.shortlist.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="brief-recommendation-heading"
      className="border-b border-hairline py-8"
    >
      <div className="max-w-[70ch]">
        <p className="font-ui text-[11px] font-medium uppercase tracking-[0.1em] text-accent">
          Crux recommendation
        </p>

        <h2
          id="brief-recommendation-heading"
          className="mt-2 font-document text-[24px] font-semibold leading-[1.3] text-ink"
        >
          Targets to prioritise
        </h2>

        <p className="mt-3 font-document text-[16px] leading-[1.6] text-slate">
          {recommendation.reasoning}
        </p>

        <p className="mt-3 font-ui text-[12px] leading-[1.5] text-mist">
          This is an evidence-backed prioritisation, not
          a verdict. Programme-specific judgement should
          override the ordering.
        </p>
      </div>

      <ol className="mt-7 space-y-5">
        {recommendation.shortlist.map((item) => (
          <li
            key={item.ensemblId}
            className="print-avoid-break rounded-panel border border-hairline bg-surface-sunk p-5"
          >
            <div className="flex items-start gap-4">
              <div
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-data text-[14px] font-semibold text-white"
              >
                {item.rank}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <a
                    href={`#target-${item.ensemblId}`}
                    className="font-document text-[21px] font-semibold leading-[1.3] text-ink hover:text-accent"
                  >
                    {item.symbol}
                  </a>

                  <span className="font-data text-[11px] text-mist">
                    {item.ensemblId}
                  </span>
                </div>

                <div className="mt-4">
                  <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
                    Why this rank
                  </p>

                  <p className="mt-2 font-document text-[16px] leading-[1.6] text-ink">
                    {item.rationale.text}
                    <CitationMarker
                      sourceIds={
                        item.rationale.citation
                          .sourceIds
                      }
                      sources={sources}
                    />
                  </p>
                </div>

                <div className="mt-4 border-l-2 border-hairline pl-4">
                  <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-slate">
                    Main caveat
                  </p>

                  <p className="mt-2 font-document text-[15px] leading-[1.6] text-slate">
                    {item.caveat.text}
                    <CitationMarker
                      sourceIds={
                        item.caveat.citation.sourceIds
                      }
                      sources={sources}
                    />
                  </p>
                </div>

                <a
                  href={`#target-${item.ensemblId}`}
                  className="mt-4 inline-flex font-ui text-[12px] font-medium text-accent hover:text-accent-deep"
                >
                  View full target evidence
                  <span
                    aria-hidden="true"
                    className="ml-1"
                  >
                    ↓
                  </span>
                </a>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}