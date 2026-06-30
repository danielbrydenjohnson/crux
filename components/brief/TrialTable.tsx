import type { Trial } from "@/lib/types";

interface TrialTableProps {
  trials: Trial[];
}

type TrialStatusTone =
  | "recruiting"
  | "complete"
  | "stopped";

const STATUS_DOT_CLASSES: Record<
  TrialStatusTone,
  string
> = {
  recruiting: "bg-status-recruiting",
  complete: "bg-status-complete",
  stopped: "bg-status-stopped",
};

function getStatusTone(
  status: string,
): TrialStatusTone {
  const normalisedStatus =
    status.trim().toLowerCase();

  if (
    normalisedStatus.includes("terminated") ||
    normalisedStatus.includes("withdrawn") ||
    normalisedStatus.includes("suspended")
  ) {
    return "stopped";
  }

  if (
    normalisedStatus.includes("recruiting") ||
    normalisedStatus.includes("active") ||
    normalisedStatus.includes("enrolling")
  ) {
    return "recruiting";
  }

  return "complete";
}

function formatSponsor(
  sponsor: string | null,
): string {
  const trimmedSponsor = sponsor?.trim();

  return trimmedSponsor || "Not reported";
}

function formatInterventions(
  interventions: string[],
): string {
  const uniqueInterventions = Array.from(
    new Set(
      interventions
        .map((intervention) =>
          intervention.trim(),
        )
        .filter(Boolean),
    ),
  );

  if (uniqueInterventions.length === 0) {
    return "Not reported";
  }

  return uniqueInterventions.join(", ");
}

function TrialStatus({
  status,
}: {
  status: string;
}) {
  const tone = getStatusTone(status);

  return (
    <span className="inline-flex items-start gap-2">
      <span
        aria-hidden="true"
        className={`mt-[0.4em] h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASSES[tone]}`}
      />

      <span className="font-ui text-[12px] font-medium leading-[1.45] text-ink">
        {status}
      </span>
    </span>
  );
}

function TrialLink({
  trial,
}: {
  trial: Trial;
}) {
  return (
    <a
      href={trial.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${trial.nctId} on ClinicalTrials.gov`}
      className="inline-flex items-center gap-1 font-data text-[12px] font-semibold text-accent underline-offset-2 hover:text-accent-deep hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span>{trial.nctId}</span>

      <span aria-hidden="true">↗</span>
    </a>
  );
}

export function TrialTable({
  trials,
}: TrialTableProps) {
  if (trials.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="hidden overflow-hidden rounded-control border border-hairline sm:block print:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-left">
            <caption className="sr-only">
              Linked clinical trials
            </caption>

            <thead className="bg-surface-sunk">
              <tr>
                <th
                  scope="col"
                  className="w-[19%] px-3 py-2.5 font-ui text-[10px] font-semibold uppercase tracking-[0.08em] text-mist"
                >
                  Status
                </th>

                <th
                  scope="col"
                  className="w-[12%] px-3 py-2.5 font-ui text-[10px] font-semibold uppercase tracking-[0.08em] text-mist"
                >
                  Phase
                </th>

                <th
                  scope="col"
                  className="w-[22%] px-3 py-2.5 font-ui text-[10px] font-semibold uppercase tracking-[0.08em] text-mist"
                >
                  Sponsor
                </th>

                <th
                  scope="col"
                  className="w-[30%] px-3 py-2.5 font-ui text-[10px] font-semibold uppercase tracking-[0.08em] text-mist"
                >
                  Intervention
                </th>

                <th
                  scope="col"
                  className="w-[17%] px-3 py-2.5 font-ui text-[10px] font-semibold uppercase tracking-[0.08em] text-mist"
                >
                  Trial
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-hairline bg-surface">
              {trials.map((trial) => (
                <tr
                  key={trial.nctId}
                  className="align-top"
                >
                  <td className="px-3 py-3">
                    <TrialStatus
                      status={trial.status}
                    />
                  </td>

                  <td className="px-3 py-3">
                    <span className="inline-flex whitespace-nowrap rounded-full bg-surface-sunk px-2 py-1 font-data text-[11px] font-medium text-slate">
                      {trial.phase}
                    </span>
                  </td>

                  <td className="px-3 py-3 font-ui text-[12px] leading-[1.5] text-slate">
                    {formatSponsor(
                      trial.sponsor,
                    )}
                  </td>

                  <td className="px-3 py-3 font-ui text-[12px] leading-[1.5] text-slate">
                    {formatInterventions(
                      trial.interventions,
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <TrialLink trial={trial} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="space-y-3 sm:hidden print:hidden">
        {trials.map((trial) => (
          <li
            key={trial.nctId}
            className="rounded-control border border-hairline bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <TrialStatus
                status={trial.status}
              />

              <span className="inline-flex whitespace-nowrap rounded-full bg-surface-sunk px-2 py-1 font-data text-[11px] font-medium text-slate">
                {trial.phase}
              </span>
            </div>

            <dl className="mt-4 space-y-3">
              <div>
                <dt className="font-ui text-[10px] font-semibold uppercase tracking-[0.08em] text-mist">
                  Sponsor
                </dt>

                <dd className="mt-1 font-ui text-[12px] leading-[1.5] text-slate">
                  {formatSponsor(
                    trial.sponsor,
                  )}
                </dd>
              </div>

              <div>
                <dt className="font-ui text-[10px] font-semibold uppercase tracking-[0.08em] text-mist">
                  Intervention
                </dt>

                <dd className="mt-1 font-ui text-[12px] leading-[1.5] text-slate">
                  {formatInterventions(
                    trial.interventions,
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-hairline pt-3">
              <TrialLink trial={trial} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}