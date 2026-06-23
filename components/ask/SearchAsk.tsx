"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useState,
} from "react";
import {
  DisambiguationList,
  type DiseaseMatch,
} from "@/components/ask/DisambiguationList";

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

export function SearchAsk() {
  const [diseaseName, setDiseaseName] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolution, setResolution] =
    useState<DiseaseResolution | null>(null);
  const [selectedDisease, setSelectedDisease] =
    useState<DiseaseMatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolveDisease(query: string) {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError("Enter a disease to continue.");
      setResolution(null);
      setSelectedDisease(null);
      return;
    }

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    setDiseaseName(match.name);
    setSelectedDisease(match);
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
          <label htmlFor="disease-name" className="sr-only">
            Enter a disease
          </label>

          <div className="relative">
            <input
              id="disease-name"
              name="diseaseName"
              type="search"
              value={diseaseName}
              onChange={handleInputChange}
              disabled={isResolving}
              aria-invalid={error ? true : undefined}
              aria-describedby="disease-search-support"
              autoComplete="off"
              placeholder="Enter a disease..."
              className="h-16 w-full rounded-control border border-hairline bg-surface pl-5 pr-16 font-ui text-[16px] text-ink shadow-brief transition-colors hover:border-mist focus:border-accent disabled:cursor-wait disabled:bg-surface-sunk"
            />

            <button
              type="submit"
              disabled={isResolving}
              aria-label="Build brief"
              className="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-control bg-accent font-ui text-[22px] text-white transition-colors hover:bg-accent-deep disabled:cursor-wait disabled:opacity-70"
            >
              {isResolving ? (
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
                disabled={isResolving}
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
          aria-live="polite"
          aria-busy={isResolving}
          className="mt-6 min-h-[20rem]"
        >
          {isResolving ? (
            <section
              role="status"
              className="min-h-[14rem] rounded-panel border border-hairline bg-surface p-5 shadow-brief"
            >
              <p className="font-ui text-[12px] font-medium uppercase tracking-[0.1em] text-accent">
                Resolving disease
              </p>

              <p className="mt-3 font-ui text-[14px] leading-[1.55] text-slate">
                Checking Open Targets for the intended disease.
              </p>
            </section>
          ) : null}

          {!isResolving && error ? (
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
          ) : null}

          {!isResolving && resolution ? (
            <DisambiguationList
              matches={diseaseOptions}
              disabled={false}
              onSelect={handleDiseaseSelect}
            />
          ) : null}

          {!isResolving && selectedDisease ? (
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
                  onClick={() => {
                    setSelectedDisease(null);
                    setResolution(null);
                  }}
                  className="self-start font-ui text-[13px] font-medium text-accent hover:text-accent-deep"
                >
                  Change
                </button>
              </div>

              <p className="mt-4 border-t border-hairline pt-4 font-ui text-[13px] text-slate">
                Ready to assemble the target brief.
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}