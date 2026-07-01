import Link from "next/link";

const DECISION_LAYER_POINTS = [
  {
    number: "01",
    title: "Synthesises into a judgement",
    body:
      "Open Targets exposes the evidence. Crux combines association strength, tractability, trials and literature into a written assessment of what the evidence means.",
  },
  {
    number: "02",
    title: "Adds the competitive landscape",
    body:
      "Target biology is only part of the decision. Crux connects known drugs to ClinicalTrials.gov so the reader can see whether a field is open, active or already crowded.",
  },
  {
    number: "03",
    title: "States the case against and recommends",
    body:
      "Every target includes a substantive argument against pursuing it. Crux then ranks the strongest opportunities based on the evidence and competitive context, rather than simply repeating the association score.",
  },
];

const SOURCES = [
  {
    name: "Open Targets",
    role:
      "Target-disease associations, evidence breakdowns, tractability and known drugs.",
  },
  {
    name: "ClinicalTrials.gov",
    role:
      "Linked clinical trials, phases, sponsors, interventions and status.",
  },
  {
    name: "Europe PMC",
    role:
      "Relevant scientific literature and abstracts used to ground the literature assessment.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex w-full max-w-[75rem] items-center justify-between px-5 py-6 sm:px-8">
        <Link
          href="/"
          aria-label="Crux home"
          className="font-ui text-[15px] font-semibold tracking-[-0.01em] text-ink"
        >
          Crux
        </Link>

        <Link
          href="/"
          className="font-ui text-[13px] font-medium text-slate transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          Build a brief
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[75rem] px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20">
        <article className="max-w-[64rem]">
          <header className="max-w-[52rem]">
            <p className="font-ui text-[13px] font-medium uppercase tracking-[0.12em] text-accent">
              About Crux
            </p>

            <h1 className="mt-4 max-w-[18ch] font-document text-[2.5rem] font-medium leading-[1.12] tracking-[-0.025em] text-ink sm:text-[3.25rem]">
              A decision layer for target selection.
            </h1>

            <p className="mt-7 max-w-[66ch] font-document text-[19px] leading-[1.65] text-slate">
              Crux turns public evidence into a
              single, cited brief on which biological targets
              are worth pursuing for a disease. It ends with a
              ranked recommendation, while showing the evidence,
              uncertainty and case against each target.
            </p>
          </header>

          <section
            aria-labelledby="why-crux-heading"
            className="mt-16 border-t border-hairline pt-12"
          >
            <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
              <div>
                <p className="font-ui text-[12px] font-medium uppercase tracking-[0.1em] text-accent">
                  Why it exists
                </p>

                <h2
                  id="why-crux-heading"
                  className="mt-3 font-document text-[26px] font-semibold leading-[1.25] text-ink"
                >
                  Why not just use Open Targets?
                </h2>
              </div>

              <div className="max-w-[68ch] space-y-5">
                <p className="font-document text-[17px] leading-[1.7] text-ink">
                  Open Targets is a data platform. It provides a
                  broad, neutral view of target-disease evidence
                  and the underlying signals that contribute to
                  an association score.
                </p>

                <p className="font-document text-[17px] leading-[1.7] text-ink">
                  Crux does not replace that platform or rebuild
                  its upstream sources. Open Targets is one of
                  Crux&apos;s core suppliers.
                </p>

                <p className="font-document text-[17px] leading-[1.7] text-ink">
                  Crux competes with the manual analyst workflow:
                  Open Targets in several tabs, ClinicalTrials.gov
                  in another, literature searches elsewhere, and
                  a spreadsheet used to assemble the conclusion.
                  Crux turns that workflow into one document and
                  ends with a defensible judgement.
                </p>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="decision-layer-heading"
            className="mt-16"
          >
            <div className="max-w-[42rem]">
              <p className="font-ui text-[12px] font-medium uppercase tracking-[0.1em] text-accent">
                The decision layer
              </p>

              <h2
                id="decision-layer-heading"
                className="mt-3 font-document text-[26px] font-semibold leading-[1.25] text-ink"
              >
                Three things a neutral data platform does not do
              </h2>
            </div>

            <ol className="mt-8 grid gap-5 lg:grid-cols-3">
              {DECISION_LAYER_POINTS.map((point) => (
                <li
                  key={point.number}
                  className="rounded-panel border border-hairline bg-surface p-6 shadow-brief"
                >
                  <p className="font-data text-[12px] font-semibold text-accent">
                    {point.number}
                  </p>

                  <h3 className="mt-5 font-document text-[20px] font-semibold leading-[1.3] text-ink">
                    {point.title}
                  </h3>

                  <p className="mt-3 font-ui text-[14px] leading-[1.65] text-slate">
                    {point.body}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-labelledby="how-it-works-heading"
            className="mt-16 border-t border-hairline pt-12"
          >
            <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
              <div>
                <p className="font-ui text-[12px] font-medium uppercase tracking-[0.1em] text-accent">
                  How it works
                </p>

                <h2
                  id="how-it-works-heading"
                  className="mt-3 font-document text-[26px] font-semibold leading-[1.25] text-ink"
                >
                  Public evidence, assembled before synthesis
                </h2>
              </div>

              <div>
                <p className="max-w-[68ch] font-document text-[17px] leading-[1.7] text-ink">
                  Crux gathers evidence through a fixed TypeScript
                  workflow. The language model does not decide
                  which sources to search or introduce outside
                  knowledge. It receives the assembled evidence,
                  synthesises it into the brief and must cite every
                  substantive claim.
                </p>

                <p className="mt-5 max-w-[68ch] font-document text-[17px] leading-[1.7] text-ink">
                  When the available evidence is thin, the brief
                  reports it as thin. Missing trials, weak
                  tractability or literature-led associations are
                  not filled in with assumptions.
                </p>

                <dl className="mt-8 divide-y divide-hairline border-y border-hairline">
                  {SOURCES.map((source) => (
                    <div
                      key={source.name}
                      className="grid gap-2 py-5 sm:grid-cols-[12rem_minmax(0,1fr)]"
                    >
                      <dt className="font-ui text-[14px] font-semibold text-ink">
                        {source.name}
                      </dt>

                      <dd className="font-ui text-[14px] leading-[1.6] text-slate">
                        {source.role}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="status-heading"
            className="mt-16 rounded-panel border border-hairline bg-surface-sunk p-6 sm:p-8"
          >
            <p className="font-ui text-[12px] font-medium uppercase tracking-[0.1em] text-accent">
              Status
            </p>

            <h2
              id="status-heading"
              className="mt-3 font-document text-[24px] font-semibold leading-[1.3] text-ink"
            >
              A working portfolio prototype
            </h2>

            <p className="mt-4 max-w-[68ch] font-document text-[17px] leading-[1.7] text-ink">
              Crux was built by Daniel Johnson to demonstrate how
              public biomedical data, deterministic orchestration
              and constrained language-model synthesis can produce
              a credible decision-support tool. It is not a
              commercial product and should not replace
              programme-specific scientific judgement.
            </p>
          </section>

          <div className="mt-12">
            <Link
              href="/"
              className="inline-flex rounded-control bg-accent px-5 py-3 font-ui text-[14px] font-medium text-white transition-colors hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              Build a target brief
            </Link>
          </div>
        </article>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[75rem] px-5 py-6 sm:px-8">
          <p className="font-ui text-[12px] leading-[1.5] text-mist">
            Open Targets · ClinicalTrials.gov · Europe PMC
          </p>
        </div>
      </footer>
    </div>
  );
}