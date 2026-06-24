import type { Source } from "@/lib/types";

interface SourceListProps {
  sources: Source[];
}

function getSourceTypeLabel(
  type: Source["type"],
): string {
  switch (type) {
    case "open_targets":
      return "Open Targets";

    case "clinical_trial":
      return "ClinicalTrials.gov";

    case "literature":
      return "Europe PMC";
  }
}

export function SourceList({
  sources,
}: SourceListProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="brief-sources-heading"
      className="mt-16 border-t border-hairline pt-10"
    >
      <p className="font-ui text-[12px] font-medium uppercase tracking-[0.1em] text-accent">
        Bibliography
      </p>

      <h2
        id="brief-sources-heading"
        className="mt-2 font-document text-[22px] font-semibold leading-[1.3] text-ink"
      >
        Sources
      </h2>

      <p className="mt-3 max-w-[65ch] font-ui text-[13px] leading-[1.55] text-slate">
        Sources are numbered in the order used throughout
        this brief.
      </p>

      <ol className="mt-8 space-y-4">
        {sources.map((source, index) => (
          <li
            key={source.id}
            id={`source-${index + 1}`}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 border-b border-hairline pb-4 last:border-b-0"
          >
            <span className="pt-0.5 font-data text-[12px] font-medium text-accent">
              {index + 1}.
            </span>

            <div className="min-w-0">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-ui text-[13px] font-medium leading-[1.5] text-ink underline decoration-hairline underline-offset-4 hover:text-accent hover:decoration-accent"
              >
                {source.label}
                <span
                  aria-hidden="true"
                  className="ml-1 text-accent"
                >
                  ↗
                </span>
              </a>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-ui text-[11px] font-medium uppercase tracking-[0.06em] text-mist">
                  {getSourceTypeLabel(source.type)}
                </span>

                <span className="break-all font-data text-[11px] text-mist">
                  {source.id}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}