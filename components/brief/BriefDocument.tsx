import { BriefHeader } from "@/components/brief/BriefHeader";
import { BriefSummary } from "@/components/brief/BriefSummary";
import { TargetSection } from "@/components/brief/TargetSection";
import type { Brief } from "@/lib/types";

interface BriefDocumentProps {
  brief: Brief;
}

export function BriefDocument({
  brief,
}: BriefDocumentProps) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-brief sm:p-10">
      <BriefHeader brief={brief} />
      <BriefSummary brief={brief} />

      <div>
        {brief.targets.map((target, index) => (
          <TargetSection
            key={target.ensemblId}
            target={target}
            sources={brief.sources}
            rank={index + 1}
          />
        ))}
      </div>
    </article>
  );
}