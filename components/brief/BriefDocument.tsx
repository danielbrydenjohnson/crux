import { BriefHeader } from "@/components/brief/BriefHeader";
import { BriefSummary } from "@/components/brief/BriefSummary";
import { ExportBriefButton } from "@/components/brief/ExportBriefButton";
import { RecommendationSection } from "@/components/brief/RecommendationSection";
import { SourceList } from "@/components/brief/SourceList";
import { TargetSection } from "@/components/brief/TargetSection";
import type { Brief } from "@/lib/types";

interface BriefDocumentProps {
  brief: Brief;
}

export function BriefDocument({
  brief,
}: BriefDocumentProps) {
  return (
    <div>
      <div className="mb-4 flex justify-end print:hidden">
        <ExportBriefButton />
      </div>

      <article className="brief-document rounded-panel bg-surface p-6 shadow-brief sm:p-10">
        <BriefHeader brief={brief} />
        <BriefSummary brief={brief} />

        <RecommendationSection
          recommendation={brief.recommendation}
          sources={brief.sources}
        />

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

        <SourceList sources={brief.sources} />
      </article>
    </div>
  );
}