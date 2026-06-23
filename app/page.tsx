import Link from "next/link";
import { SearchAsk } from "@/components/ask/SearchAsk";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="mx-auto flex w-full max-w-[75rem] items-center justify-between px-5 py-6 sm:px-8">
        <Link
          href="/"
          aria-label="Crux home"
          className="font-ui text-[15px] font-semibold tracking-[-0.01em] text-ink"
        >
          Crux
        </Link>

        <a
          href="#about"
          className="font-ui text-[13px] font-medium text-slate transition-colors hover:text-ink"
        >
          About
        </a>
      </header>

      <main className="mx-auto w-full max-w-[75rem] flex-1 px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20">
        <SearchAsk />
      </main>

      <footer id="about" className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[75rem] px-5 py-6 sm:px-8">
          <p className="max-w-[48rem] font-ui text-[12px] leading-[1.5] text-mist">
            Crux assembles public biomedical evidence into one cited target
            intelligence brief.
          </p>
        </div>
      </footer>
    </div>
  );
}