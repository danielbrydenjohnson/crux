import type { Brief } from "@/lib/types";

interface BriefHeaderProps {
  brief: Brief;
}

function formatGeneratedDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

export function BriefHeader({
  brief,
}: BriefHeaderProps) {
  const analysedTargetCount = brief.targets.length;
  const totalTargetsAvailable =
    brief.query.totalTargetsAvailable;
  const sourceCount = brief.sources.length;

  return (
    <header className="border-b border-hairline pb-8">
      <p className="font-ui text-[12px] font-medium uppercase tracking-[0.1em] text-accent">
        Target intelligence brief
      </p>

      <h1 className="mt-3 font-document text-[30px] font-medium leading-[1.2] tracking-[-0.02em] text-ink sm:text-[36px]">
        {brief.query.diseaseName}
      </h1>

      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-data text-[13px] font-medium text-mist">
        <span>{brief.query.efoId}</span>

        <span aria-hidden="true">·</span>

        <span>
          Top {formatCount(analysedTargetCount)} of{" "}
          {formatCount(totalTargetsAvailable)}{" "}
          {totalTargetsAvailable === 1
            ? "target"
            : "targets"}
        </span>

        <span aria-hidden="true">·</span>

        <span>
          {formatCount(sourceCount)}{" "}
          {sourceCount === 1 ? "source" : "sources"}
        </span>

        <span aria-hidden="true">·</span>

        <time dateTime={brief.generatedAt}>
          {formatGeneratedDate(brief.generatedAt)}
        </time>
      </p>

      <p className="mt-8 max-w-[34ch] font-document text-[26px] font-medium leading-[1.3] tracking-[-0.015em] text-ink sm:text-[30px]">
        {brief.headline.text}
      </p>
    </header>
  );
}