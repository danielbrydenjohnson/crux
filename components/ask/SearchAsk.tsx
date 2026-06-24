"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DisambiguationList,
  type DiseaseMatch,
} from "@/components/ask/DisambiguationList";
import { BriefDocument } from "@/components/brief/BriefDocument";
import { WorkingStepper } from "@/components/working/WorkingStepper";
import {
  INITIAL_BRIEF_PROGRESS_STATE,
  createStartingBriefProgressState,
  reduceBriefProgress,
  type BriefProgressState,
} from "@/lib/client/briefProgress";
import { readBriefStream } from "@/lib/client/readBriefStream";

interface DiseaseResolution extends DiseaseMatch {
  alternatives: DiseaseMatch[];
}

type ResolveApiResponse =
  | {
      ok: true;
      resolution: DiseaseResolution;
    }
  | {
      ok: false;
      error: string;
    };

const EXAMPLE_QUERIES = [
  {
    label: "IPF",
    query: "idiopathic pulmonary fibrosis",
  },
  {
    label: "Alzheimer's",
    query: "Alzheimer disease",
  },
  {
    label: "NASH",
    query: "non-alcoholic steatohepatitis",
  },
  {
    label: "ALS",
    query: "amyotrophic lateral sclerosis",
  },
];

function normaliseDiseaseName(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getPrimaryMatch(
  resolution: DiseaseResolution,
): DiseaseMatch {
  return {
    efoId: resolution.efoId,
    name: resolution.name,
    description: resolution.description,
  };
}

function requiresDisambiguation(
  query: string,
  resolution: DiseaseResolution,
): boolean {
  if (resolution.alternatives.length === 0) {
    return false;
  }

  return (
    normaliseDiseaseName(query) !==
    normaliseDiseaseName(resolution.name)
  );
}

function isBriefBuilding(
  progress: BriefProgressState,
): boolean {
  return (
    progress.stage === "starting" ||
    progress.stage === "gathering" ||
    progress.stage === "synthesising"
  );
}

export function SearchAsk() {
  const [diseaseName, setDiseaseName] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolution, setResolution] =
    useState<DiseaseResolution | null>(null);
  const [selectedDisease, setSelectedDisease] =
    useState<DiseaseMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [briefProgress, setBriefProgress] =
    useState<BriefProgressState>(
      INITIAL_BRIEF_PROGRESS_STATE,
    );

  const briefAbortController =
    useRef<AbortController | null>(null);

  const briefIsBuilding =
    isBriefBuilding(briefProgress);
  const interfaceIsBusy =
    isResolving || briefIsBuilding;

  useEffect(() => {
    return () => {
      briefAbortController.current?.abort();
    };
  }, []);

  function resetBriefProgress() {
    briefAbortController.current?.abort();
    briefAbortController.current = null;
    setBriefProgress(INITIAL_BRIEF_PROGRESS_STATE);
  }

  async function resolveDisease(query: string) {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError("Enter a disease to continue.");
      setResolution(null);
      setSelectedDisease(null);
      resetBriefProgress();
      return;
    }

    resetBriefProgress();
    setDiseaseName(trimmedQuery);
    setIsResolving(true);
    setError(null);
    setResolution(null);
    setSelectedDisease(null);

    try {
      const response = await fetch("/api/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          diseaseName: trimmedQuery,
        }),
      });

      const payload =
        (await response.json()) as ResolveApiResponse;

      if (!response.ok || !payload.ok) {
        const message = payload.ok
          ? "Couldn't resolve that disease."
          : payload.error;

        throw new Error(message);
      }

      if (
        requiresDisambiguation(
          trimmedQuery,
          payload.resolution,
        )
      ) {
        setResolution(payload.resolution);
        return;
      }

      setSelectedDisease(
        getPrimaryMatch(payload.resolution),
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Couldn't resolve that disease.";

      setError(message);
    } finally {
      setIsResolving(false);
    }
  }

  async function buildBrief(disease: DiseaseMatch) {
    briefAbortController.current?.abort();

    const controller = new AbortController();
    briefAbortController.current = controller;

    setError(null);
    setBriefProgress(
      createStartingBriefProgressState({
        efoId: disease.efoId,
        name: disease.name,
      }),
    );

    let receivedTerminalEvent = false;

    try {
      const response = await fetch("/api/brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          efoId: disease.efoId,
          input: disease.name,
        }),
        signal: controller.signal,
      });

      await readBriefStream(response, (event) => {
        if (
          event.type === "complete" ||
          event.type === "error"
        ) {
          receivedTerminalEvent = true;
        }

        setBriefProgress((currentProgress) =>
          reduceBriefProgress(
            currentProgress,
            event,
          ),
        );
      });

      if (!receivedTerminalEvent) {
        setBriefProgress((currentProgress) => ({
          ...currentProgress,
          stage: "error",
          error:
            "The brief stream ended before completion.",
        }));
      }
    } catch (caughtError) {
      if (controller.signal.aborted) {
        return;
      }

      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Couldn't build the target brief.";

      setBriefProgress((currentProgress) => ({
        ...currentProgress,
        stage: "error",
        error: message,
      }));
    } finally {
      if (
        briefAbortController.current === controller
      ) {
        briefAbortController.current = null;
      }
    }
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    void resolveDisease(diseaseName);
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const nextValue = event.target.value;

    setDiseaseName(nextValue);
    setError(null);
    setResolution(null);
    resetBriefProgress();

    if (
      selectedDisease &&
      normaliseDiseaseName(nextValue) !==
        normaliseDiseaseName(selectedDisease.name)
    ) {
      setSelectedDisease(null);
    }
  }

  function handleExampleClick(query: string) {
    void resolveDisease(query);
  }

  function handleDiseaseSelect(match: DiseaseMatch) {
    resetBriefProgress();
    setDiseaseName(match.name);
    setSelectedDisease(match);
    setResolution(null);
    setError(null);
  }

  function handleChangeDisease() {
    resetBriefProgress();
    setSelectedDisease(null);
    setResolution(null);
    setError(null);
  }

  const diseaseOptions = resolution
    ? [
        getPrimaryMatch(resolution),
        ...resolution.alternatives,
      ]
    : [];

  return (
    <section className="w-full">
      <div className="max-w-[45rem]">
        <p className="mb-4 font-ui text-[13px] font-medium uppercase tracking-[0.12em] text-accent">
          Target intelligence
        </p>

        <h1 className="max-w-[13ch] font-document text-[2.5rem] font-medium leading-[1.15] tracking-[-0.025em] text-ink sm:text-[3rem]">
          Which targets should we pursue?
        </h1>

        <p className="mt-5 max-w-[42rem] font-ui text-[17px] leading-[1.6] text-slate">
          Evidence-backed target intelligence for any
          disease, in one brief.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10"
          noValidate
        >
          <label
            htmlFor="disease-name"
            className="sr-only"
          >
            Enter a disease
          </label>

          <div className="relative">
            <input
              id="disease-name"
              name="diseaseName"
              type="search"
              value={diseaseName}
              onChange={handleInputChange}
              disabled={interfaceIsBusy}
              aria-invalid={error ? true : undefined}
              aria-describedby="disease-search-support"
              autoComplete="off"
              placeholder="Enter a disease..."
              className="h-16 w-full rounded-control border border-hairline bg-surface pl-5 pr-16 font-ui text-[16px] text-ink shadow-brief transition-colors hover:border-mist focus:border-accent disabled:cursor-wait disabled:bg-surface-sunk"
            />

            <button
              type="submit"
              disabled={interfaceIsBusy}
              aria-label="Resolve disease"
              className="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-control bg-accent font-ui text-[22px] text-white transition-colors hover:bg-accent-deep disabled:cursor-wait disabled:opacity-70"
            >
              {interfaceIsBusy ? (
                <span aria-hidden="true">···</span>
              ) : (
                <span aria-hidden="true">→</span>
              )}
            </button>
          </div>

          <div
            id="disease-search-support"
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            <span className="mr-1 font-ui text-[13px] text-mist">
              Try:
            </span>

            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example.label}
                type="button"
                disabled={interfaceIsBusy}
                onClick={() =>
                  handleExampleClick(example.query)
                }
                className="rounded-full bg-accent-tint px-3 py-1.5 font-ui text-[13px] font-medium text-accent transition-colors hover:bg-evidence-1 disabled:cursor-wait disabled:opacity-60"
              >
                {example.label}
              </button>
            ))}
          </div>
        </form>

        <p className="mt-8 max-w-[34rem] font-ui text-[12px] leading-[1.5] text-mist">
          Sources: Open Targets · ClinicalTrials.gov ·
          Europe PMC. Every substantive claim cited.
        </p>

        <div
          aria-busy={interfaceIsBusy}
          className="mt-6 min-h-[20rem]"
        >
          {briefProgress.stage === "complete" &&
          briefProgress.brief ? (
            <BriefDocument
              brief={briefProgress.brief}
            />
          ) : briefProgress.stage !== "idle" ? (
            <div>
              <WorkingStepper
                progress={briefProgress}
              />

              {briefProgress.stage === "error" &&
              selectedDisease ? (
                <button
                  type="button"
                  onClick={() =>
                    void buildBrief(selectedDisease)
                  }
                  className="mt-4 rounded-control bg-accent px-4 py-2.5 font-ui text-[13px] font-medium text-white transition-colors hover:bg-accent-deep"
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : isResolving ? (
            <section
              role="status"
              className="min-h-[14rem] rounded-panel border border-hairline bg-surface p-5 shadow-brief"
            >
              <p className="font-ui text-[12px] font-medium uppercase tracking-[0.1em] text-accent">
                Resolving disease
              </p>

              <p className="mt-3 font-ui text-[14px] leading-[1.55] text-slate">
                Checking Open Targets for the intended
                disease.
              </p>
            </section>
          ) : error ? (
            <section
              role="alert"
              className="min-h-[14rem] rounded-panel border border-hairline bg-surface p-5 shadow-brief"
            >
              <p className="font-ui text-[12px] font-medium uppercase tracking-[0.1em] text-status-stopped">
                Disease not resolved
              </p>

              <p className="mt-3 font-ui text-[14px] font-medium leading-[1.55] text-status-stopped">
                {error}
              </p>
            </section>
          ) : resolution ? (
            <DisambiguationList
              matches={diseaseOptions}
              disabled={false}
              onSelect={handleDiseaseSelect}
            />
          ) : selectedDisease ? (
            <section
              aria-labelledby="resolved-disease-heading"
              className="min-h-[14rem] rounded-panel border border-hairline bg-surface p-5 shadow-brief"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-ui text-[12px] font-medium uppercase tracking-[0.1em] text-accent">
                    Resolved disease
                  </p>

                  <h2
                    id="resolved-disease-heading"
                    className="mt-2 font-document text-[22px] font-semibold leading-[1.3] text-ink"
                  >
                    {selectedDisease.name}
                  </h2>

                  <p className="mt-2 font-data text-[13px] font-medium text-mist">
                    {selectedDisease.efoId}
                  </p>

                  {selectedDisease.description ? (
                    <p className="mt-3 max-w-[65ch] font-ui text-[13px] leading-[1.55] text-slate">
                      {selectedDisease.description}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={handleChangeDisease}
                  className="self-start font-ui text-[13px] font-medium text-accent hover:text-accent-deep"
                >
                  Change
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-ui text-[13px] text-slate">
                  Ready to assemble the target brief.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void buildBrief(selectedDisease)
                  }
                  className="self-start rounded-control bg-accent px-4 py-2.5 font-ui text-[13px] font-medium text-white transition-colors hover:bg-accent-deep sm:self-auto"
                >
                  Build brief
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}