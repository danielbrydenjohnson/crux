import { CitationMarker } from "@/components/brief/CitationMarker";
import { ConfidenceChip } from "@/components/brief/ConfidenceChip";
import { EvidenceBreakdown } from "@/components/brief/EvidenceBreakdown";
import { TrialTable } from "@/components/brief/TrialTable";
import type {
  Claim,
  Source,
  TargetBrief,
} from "@/lib/types";

interface TargetSectionProps {
  target: TargetBrief;
  sources: Source[];
  rank: number;
}

interface CitedTextProps {
  claim: Claim;
  sources: Source[];
  className?: string;
}

function CitedText({
  claim,
  sources,
  className,
}: CitedTextProps) {
  return (
    <p className={className}>
      {claim.text}
      <CitationMarker
        sourceIds={claim.citation.sourceIds}
        sources={sources}
      />
    </p>
  );
}

function clampScore(score: number): number {
  return Math.min(1, Math.max(0, score));
}

function formatAssociationScore(
  score: number,
): string {
  return clampScore(score).toFixed(3);
}

function getTrialCountLabel(
  trialCount: number,
): string {
  return trialCount === 1
    ? "linked trial found"
    : "linked trials found";
}

export function TargetSection({
  target,
  sources,
  rank,
}: TargetSectionProps) {
  const sectionId = `target-${target.ensemblId}`;
  const headingId = `${sectionId}-heading`;
  const evidenceHeadingId = `${sectionId}-evidence-heading`;
  const trials =
    target.competitiveLandscape.trials;
  const trialCount = trials.length;

  return (
    <section
      id={sectionId}
      aria-labelledby={headingId}
      className="print-target-section border-b border-hairline py-10 last:border-b-0"
    >
      <header className="print-avoid-break">
        <p className="font-ui text-[11px] font-medium uppercase tracking-[0.1em] text-mist">
          Open Targets association rank {rank}
        </p>

        <div className="mt-2">
          <h2
            id={headingId}
            className="font-document text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink"
          >
            {target.symbol}
          </h2>

          <p className="mt-1 font-ui text-[14px] leading-[1.5] text-slate">
            {target.name}
          </p>

          <p className="mt-2 font-data text-[12px] text-mist">
            {target.ensemblId}
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-control border border-hairline bg-surface-sunk px-4 py-3">
            <span className="block font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-mist">
              Open Targets overall association
            </span>

            <span className="mt-1 block font-data text-[19px] font-semibold text-ink">
              {formatAssociationScore(
                target.associationScore,
              )}
              <span className="ml-1 text-[12px] font-medium text-mist">
                / 1
              </span>
            </span>
          </div>

          <div className="rounded-control border border-hairline bg-surface-sunk px-4 py-3">
            <span className="block font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-mist">
              Linked clinical trials
            </span>

            <span className="mt-1 block font-data text-[19px] font-semibold text-ink">
              {trialCount}
            </span>

            <span className="mt-0.5 block font-ui text-[11px] text-slate">
              {getTrialCountLabel(trialCount)}
            </span>
          </div>

          <div className="rounded-control border border-hairline bg-surface px-4 py-3">
            <span className="block font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-mist">
              Crux confidence
            </span>

            <div className="mt-2">
              <ConfidenceChip
                confidence={target.confidence}
              />
            </div>
          </div>
        </div>

        <CitedText
          claim={target.confidenceRationale}
          sources={sources}
          className="mt-5 max-w-[68ch] font-ui text-[13px] leading-[1.6] text-slate"
        />
      </header>

      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-7">
          <section className="print-avoid-break">
            <h3 className="font-document text-[18px] font-semibold leading-[1.35] text-ink">
              Tractability
            </h3>

            <CitedText
              claim={target.tractabilitySummary}
              sources={sources}
              className="mt-3 font-document text-[16px] leading-[1.65] text-ink"
            />
          </section>

          <section className="print-avoid-break">
            <h3 className="font-document text-[18px] font-semibold leading-[1.35] text-ink">
              Competitive landscape
            </h3>

            {trialCount === 0 ? (
              <div className="mt-3 rounded-control border border-hairline bg-surface-sunk p-4">
                <p className="font-ui text-[13px] font-semibold text-ink">
                  No linked clinical trials found
                </p>

                <p className="mt-1 font-ui text-[12px] leading-[1.5] text-slate">
                  No linked trials were present in the
                  assembled evidence for this target and
                  disease.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-control border border-accent bg-accent-tint p-4">
                <p className="font-ui text-[13px] font-semibold text-accent-deep">
                  {trialCount}{" "}
                  {trialCount === 1
                    ? "linked clinical trial found"
                    : "linked clinical trials found"}
                </p>

                <p className="mt-1 font-ui text-[12px] leading-[1.5] text-slate">
                  These trials were linked to this target
                  and disease through the assembled
                  evidence.
                </p>
              </div>
            )}

            <CitedText
              claim={
                target.competitiveLandscape
                  .summary
              }
              sources={sources}
              className="mt-4 font-document text-[16px] leading-[1.65] text-ink"
            />
          </section>

          <section className="print-avoid-break">
            <h3 className="font-document text-[18px] font-semibold leading-[1.35] text-ink">
              Literature angle
            </h3>

            <CitedText
              claim={target.literatureAngle}
              sources={sources}
              className="mt-3 font-document text-[16px] leading-[1.65] text-ink"
            />
          </section>
        </div>

        <aside className="print-avoid-break rounded-panel border border-hairline bg-surface-sunk p-5">
          <EvidenceBreakdown
            evidence={target.evidenceBreakdown}
            headingId={evidenceHeadingId}
          />
        </aside>
      </div>

      {trialCount > 0 ? (
        <section
          aria-labelledby={`${sectionId}-trials-heading`}
          className="mt-8"
        >
          <h3
            id={`${sectionId}-trials-heading`}
            className="font-document text-[18px] font-semibold leading-[1.35] text-ink"
          >
            Linked trials
          </h3>

          <div className="mt-4">
            <TrialTable trials={trials} />
          </div>
        </section>
      ) : null}

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <section className="print-avoid-break rounded-panel border border-hairline bg-surface p-5">
          <h3 className="font-ui text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">
            Case for
          </h3>

          {target.caseFor.length === 0 ? (
            <p className="mt-3 font-ui text-[13px] leading-[1.55] text-slate">
              No supporting argument was returned.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {target.caseFor.map(
                (claim, index) => (
                  <li
                    key={`${index}-${claim.text}`}
                    className="flex gap-3"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    />

                    <CitedText
                      claim={claim}
                      sources={sources}
                      className="font-document text-[15px] leading-[1.6] text-ink"
                    />
                  </li>
                ),
              )}
            </ul>
          )}
        </section>

        <section className="print-avoid-break rounded-panel border border-hairline bg-surface-sunk p-5">
          <h3 className="font-ui text-[12px] font-semibold uppercase tracking-[0.08em] text-slate">
            Case against
          </h3>

          {target.caseAgainst.length === 0 ? (
            <p className="mt-3 font-ui text-[13px] leading-[1.55] text-slate">
              No substantive counterargument was returned.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {target.caseAgainst.map(
                (claim, index) => (
                  <li
                    key={`${index}-${claim.text}`}
                    className="flex gap-3"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-mist"
                    />

                    <CitedText
                      claim={claim}
                      sources={sources}
                      className="font-document text-[15px] leading-[1.6] text-ink"
                    />
                  </li>
                ),
              )}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}