export interface DiseaseMatch {
  efoId: string;
  name: string;
  description: string | null;
}

interface DisambiguationListProps {
  matches: DiseaseMatch[];
  disabled: boolean;
  onSelect: (match: DiseaseMatch) => void;
}

function shortenDescription(description: string): string {
  const cleanedDescription = description.replace(/\s+/g, " ").trim();

  if (cleanedDescription.length <= 180) {
    return cleanedDescription;
  }

  return `${cleanedDescription.slice(0, 177).trimEnd()}...`;
}

export function DisambiguationList({
  matches,
  disabled,
  onSelect,
}: DisambiguationListProps) {
  return (
    <section
      aria-labelledby="disease-options-heading"
      className="overflow-hidden rounded-panel border border-hairline bg-surface"
    >
      <div className="border-b border-hairline bg-surface-sunk px-4 py-3">
        <h2
          id="disease-options-heading"
          className="font-ui text-[13px] font-medium text-slate"
        >
          Choose the intended disease
        </h2>
      </div>

      <ul>
        {matches.map((match, index) => (
          <li
            key={match.efoId}
            className="border-b border-hairline last:border-b-0"
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(match)}
              className="w-full px-4 py-4 text-left transition-colors hover:bg-accent-tint disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-document text-[18px] font-semibold leading-[1.35] text-ink">
                  {match.name}
                </span>

                {index === 0 ? (
                  <span className="rounded-full bg-accent-tint px-2 py-0.5 font-ui text-[12px] font-medium text-accent">
                    Best match
                  </span>
                ) : null}
              </span>

              {match.description ? (
                <span className="mt-1.5 block max-w-[65ch] font-ui text-[13px] leading-[1.5] text-slate">
                  {shortenDescription(match.description)}
                </span>
              ) : null}

              <span className="mt-2 block font-data text-[12px] font-medium text-mist">
                {match.efoId}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}