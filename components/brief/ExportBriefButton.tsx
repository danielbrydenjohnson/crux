"use client";

export function ExportBriefButton() {
  function handleExport() {
    window.print();
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="rounded-control border border-hairline bg-surface px-4 py-2.5 font-ui text-[13px] font-medium text-accent transition-colors hover:border-accent hover:text-accent-deep print:hidden"
    >
      Export PDF
    </button>
  );
}