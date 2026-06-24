import type { Source } from "@/lib/types";

interface CitationMarkerProps {
  sourceIds: string[];
  sources: Source[];
}

interface ResolvedCitation {
  number: number;
  source: Source;
}

function resolveCitations(
  sourceIds: string[],
  sources: Source[],
): ResolvedCitation[] {
  const sourceIndexById = new Map(
    sources.map((source, index) => [
      source.id,
      index,
    ]),
  );

  return sourceIds
    .map((sourceId) => {
      const sourceIndex =
        sourceIndexById.get(sourceId);

      if (sourceIndex === undefined) {
        return null;
      }

      return {
        number: sourceIndex + 1,
        source: sources[sourceIndex],
      };
    })
    .filter(
      (
        citation,
      ): citation is ResolvedCitation =>
        citation !== null,
    );
}

export function CitationMarker({
  sourceIds,
  sources,
}: CitationMarkerProps) {
  const citations = resolveCitations(
    sourceIds,
    sources,
  );

  if (citations.length === 0) {
    return null;
  }

  const citationLabel = citations
    .map((citation) => citation.number)
    .join(", ");

  return (
    <span className="group relative ml-1 inline-block align-super">
      <button
        type="button"
        aria-label={`View sources ${citationLabel}`}
        className="rounded-control px-0.5 font-ui text-[10px] font-semibold leading-none text-accent hover:text-accent-deep"
      >
        {citationLabel}
      </button>

      <span
        role="tooltip"
        className="invisible absolute bottom-full left-1/2 z-20 mb-2 w-72 -translate-x-1/2 rounded-panel border border-hairline bg-surface p-3 opacity-0 shadow-popover transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        <span className="block font-ui text-[11px] font-medium uppercase tracking-[0.08em] text-mist">
          Sources
        </span>

        <span className="mt-2 block space-y-2">
          {citations.map(
            ({ number, source }) => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block font-ui text-[12px] leading-[1.45] text-slate hover:text-accent"
              >
                <span className="mr-1 font-data text-accent">
                  {number}.
                </span>
                {source.label}
                <span
                  aria-hidden="true"
                  className="ml-1"
                >
                  ↗
                </span>
              </a>
            ),
          )}
        </span>
      </span>
    </span>
  );
}