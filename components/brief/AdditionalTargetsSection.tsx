import type { AdditionalTarget } from "@/lib/types";

interface AdditionalTargetsSectionProps {
  additionalTargets: AdditionalTarget[];
  analysedTargetCount: number;
  totalTargetsAvailable: number;
  efoId: string;
}

const countFormatter = new Intl.NumberFormat("en-GB");

const scoreFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

export function AdditionalTargetsSection({
  additionalTargets,
  analysedTargetCount,
  totalTargetsAvailable,
  efoId,
}: AdditionalTargetsSectionProps) {
  const remainingTargetCount = Math.max(
    totalTargetsAvailable -
      analysedTargetCount -
      additionalTargets.length,
    0,
  );

  if (
    additionalTargets.length === 0 &&
    remainingTargetCount === 0
  ) {
    return null;
  }

  const orderedTargets = [...additionalTargets].sort(
    (first, second) =>
      second.associationScore - first.associationScore,
  );

  const openTargetsUrl =
    `https://platform.opentargets.org/disease/` +
    `${encodeURIComponent(efoId)}/associations`;

  return (
    <section
      aria-labelledby="additional-targets-heading"
      className="mt-16 border-t border-hairline pt-10"
    >
      <p className="font-ui text-[12px] font-medium uppercase tracking-[0.1em] text-mist">
        Ranked context
      </p>

      <h2
        id="additional-targets-heading"
        className="mt-2 font-document text-[22px] font-semibold leading-[1.3] text-ink"
      >
        Other associated targets
      </h2>

      <p className="mt-3 max-w-[65ch] font-ui text-[13px] leading-[1.55] text-slate">
        These targets follow the deeply analysed set in
        Open Targets&apos; association ranking. They are
        shown for context and have not received the full
        Crux evidence analysis.
      </p>

      {orderedTargets.length > 0 ? (
        <div className="mt-8 overflow-hidden rounded-panel border border-hairline">
          <div
            role="row"
            className="grid grid-cols-[3rem_minmax(0,1fr)_6.5rem] gap-3 bg-surface-sunk px-4 py-3"
          >
            <span className="font-ui text-[11px] font-medium uppercase tracking-[0.06em] text-mist">
              Rank
            </span>

            <span className="font-ui text-[11px] font-medium uppercase tracking-[0.06em] text-mist">
              Target
            </span>

            <span className="text-right font-ui text-[11px] font-medium uppercase tracking-[0.06em] text-mist">
              Score
            </span>
          </div>

          <ol>
            {orderedTargets.map((target, index) => {
              const rank =
                analysedTargetCount + index + 1;

              return (
                <li
                  key={target.ensemblId}
                  className="grid grid-cols-[3rem_minmax(0,1fr)_6.5rem] gap-3 border-t border-hairline px-4 py-3 first:border-t-0"
                >
                  <span className="font-data text-[12px] text-mist">
                    {rank}
                  </span>

                  <div className="min-w-0">
                    <p className="font-data text-[13px] font-medium text-ink">
                      {target.symbol}
                    </p>

                    <p className="mt-0.5 truncate font-data text-[11px] text-mist">
                      {target.ensemblId}
                    </p>
                  </div>

                  <span className="text-right font-data text-[13px] font-medium text-slate">
                    {scoreFormatter.format(
                      target.associationScore,
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {remainingTargetCount > 0 ? (
        <p className="mt-5 font-ui text-[13px] leading-[1.55] text-slate">
          Plus{" "}
          <span className="font-data font-medium text-ink">
            {countFormatter.format(
              remainingTargetCount,
            )}
          </span>{" "}
          further targets below this threshold.{" "}
          <a
            href={openTargetsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline decoration-hairline underline-offset-4 hover:text-accent-deep hover:decoration-accent focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            View the full ranked list on Open Targets
            <span aria-hidden="true" className="ml-1">
              ↗
            </span>
          </a>
        </p>
      ) : null}
    </section>
  );
}