import type {
  BriefProgressStage,
  BriefProgressState,
} from "@/lib/client/briefProgress";

interface WorkingStepperProps {
  progress: BriefProgressState;
}

type StepState = "complete" | "active" | "pending";

interface WorkingStepProps {
  label: string;
  state: StepState;
  detail?: string;
}

function hasReachedStage(
  currentStage: BriefProgressStage,
  stages: BriefProgressStage[],
): boolean {
  return stages.includes(currentStage);
}

function ActiveStepIndicator() {
  return (
    <span
      aria-hidden="true"
      className="ml-2 inline-flex shrink-0 items-center gap-1 text-accent"
    >
      {[0, 1, 2].map((dotIndex) => (
        <span
          key={dotIndex}
          className="h-1.5 w-1.5 rounded-full bg-current opacity-25 motion-safe:animate-pulse motion-reduce:opacity-100"
          style={{
            animationDelay: `${dotIndex * 180}ms`,
            animationDuration: "900ms",
          }}
        />
      ))}
    </span>
  );
}

function WorkingStep({
  label,
  state,
  detail,
}: WorkingStepProps) {
  const markerClasses = {
    complete:
      "border-ink bg-ink text-white",
    active:
      "border-accent bg-accent-tint text-accent",
    pending:
      "border-hairline bg-surface text-mist",
  }[state];

  const labelClasses = {
    complete: "text-ink",
    active: "text-accent",
    pending: "text-mist",
  }[state];

  return (
    <li className="relative flex gap-4 pb-7 last:pb-0">
      <span
        aria-hidden="true"
        className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-ui text-[12px] font-semibold ${markerClasses}`}
      >
        {state === "complete"
          ? "✓"
          : state === "active"
            ? "●"
            : "○"}
      </span>

      <div className="min-w-0 pt-0.5">
        <p
          className={`flex items-center font-ui text-[14px] font-medium leading-[1.4] ${labelClasses}`}
        >
          <span>{label}</span>

          {state === "active" ? (
            <ActiveStepIndicator />
          ) : null}
        </p>

        {detail ? (
          <p className="mt-1 font-ui text-[12px] leading-[1.5] text-mist">
            {detail}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function WorkingStepper({
  progress,
}: WorkingStepperProps) {
  if (progress.stage === "idle") {
    return null;
  }

  const targetsFoundState: StepState =
    progress.targetCount > 0
      ? "complete"
      : progress.stage === "starting"
        ? "active"
        : "pending";

  const evidenceState: StepState = hasReachedStage(
    progress.stage,
    ["synthesising", "complete"],
  )
    ? "complete"
    : progress.stage === "gathering"
      ? "active"
      : "pending";

  const synthesisState: StepState =
    progress.stage === "complete"
      ? "complete"
      : progress.stage === "synthesising"
        ? "active"
        : "pending";

  const evidenceDetail =
    progress.targetCount > 0
      ? `${progress.completedTargetCount} of ${progress.targetCount} targets complete`
      : undefined;

  return (
    <section
      aria-live="polite"
      aria-busy={
        progress.stage !== "complete" &&
        progress.stage !== "error"
      }
      className="min-h-[20rem] rounded-panel border border-hairline bg-surface p-5 shadow-brief sm:p-6"
    >
      <div className="border-b border-hairline pb-5">
        <p className="font-ui text-[12px] font-medium uppercase tracking-[0.1em] text-accent">
          Building target brief
        </p>

        <h2 className="mt-2 font-document text-[22px] font-semibold leading-[1.3] text-ink">
          {progress.disease?.name ?? "Resolving disease"}
        </h2>

        {progress.disease ? (
          <p className="mt-2 font-data text-[13px] font-medium text-mist">
            {progress.disease.efoId}
          </p>
        ) : null}
      </div>

      {progress.stage === "error" ? (
        <div role="alert" className="pt-5">
          <p className="font-ui text-[13px] font-medium text-status-stopped">
            {progress.error ??
              "The brief could not be completed."}
          </p>
        </div>
      ) : (
        <div className="pt-6">
          <ol className="relative">
            <span
              aria-hidden="true"
              className="absolute bottom-4 left-[13px] top-3 w-px bg-hairline"
            />

            <WorkingStep
              label="Resolved disease"
              state="complete"
            />

            <WorkingStep
              label={
                progress.targetCount > 0
                  ? `Found ${progress.targetCount} associated targets`
                  : "Finding associated targets"
              }
              state={targetsFoundState}
            />

            <WorkingStep
              label="Gathering evidence"
              state={evidenceState}
              detail={evidenceDetail}
            />

            {progress.targets.length > 0 ? (
              <li className="-mt-3 mb-7 ml-11">
                <ul
                  aria-label="Target evidence progress"
                  className="flex flex-wrap gap-2"
                >
                  {progress.targets.map((target) => (
                    <li
                      key={target.ensemblId}
                      className={`rounded-full border px-2.5 py-1 font-data text-[12px] font-medium ${
                        target.complete
                          ? "border-evidence-2 bg-accent-tint text-accent"
                          : "border-hairline bg-surface-sunk text-mist"
                      }`}
                    >
                      <span>{target.symbol}</span>

                      <span
                        className="ml-1.5"
                        aria-hidden="true"
                      >
                        {target.complete ? "✓" : "···"}
                      </span>

                      <span className="sr-only">
                        {target.complete
                          ? " complete"
                          : " in progress"}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ) : null}

            <WorkingStep
              label="Synthesising brief"
              state={synthesisState}
            />
          </ol>
        </div>
      )}
    </section>
  );
}