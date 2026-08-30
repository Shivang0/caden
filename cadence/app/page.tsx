"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { AuthNav } from "@/components/auth-nav";
import { GenerateForm } from "@/components/generate-form";
import { ArtifactTabs } from "@/components/artifact-tabs";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { CadenceArtifacts } from "@/lib/types";

const ARTIFACT_CHIPS = [
  "Investor update",
  "LinkedIn post",
  "X thread",
  "Changelog",
  "Narrated video",
];

const STATS: Array<{ value: string; caption: string }> = [
  { value: "60", caption: "seconds from repo to a finished draft" },
  { value: "3", caption: "artifacts from every sprint: update, posts, changelog" },
  { value: "12", caption: "investor updates a year, sent on time" },
];

const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const heroLine = {
  hidden: { y: "110%" },
  show: {
    y: "0%",
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const heroItem = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export default function Home() {
  const [artifacts, setArtifacts] = useState<CadenceArtifacts | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!artifacts) return;
    const id = window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(id);
  }, [artifacts]);

  return (
    <div className="relative flex flex-1 flex-col bg-[#1a1a1a] text-[#f1f1f1]">
      {/* Blueprint atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="caden-grid caden-grid-fade absolute inset-x-0 top-0 h-[860px]" />
      </div>

      <SiteHeader>
        <a
          href="#generate"
          className="caden-sweep hidden px-1 py-1.5 font-mono text-[12px] uppercase tracking-[0.1em] text-[#8f8f8f] transition-colors hover:text-[#f1f1f1] md:block"
        >
          Generate
        </a>
        <Link
          href="/connections"
          className="caden-sweep px-1 py-1.5 font-mono text-[12px] uppercase tracking-[0.1em] text-[#8f8f8f] transition-colors hover:text-[#f1f1f1]"
        >
          Connections
        </Link>
        <AuthNav />
      </SiteHeader>

      <main className="relative z-10 flex-1">
        {/* Hero: statement top-left, payoff offset right. Never centered. */}
        <motion.section
          variants={heroContainer}
          initial="hidden"
          animate="show"
          className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-16 sm:pt-24"
        >
          {/* Statue: classical patience, modern tooling */}
          <motion.div
            variants={heroItem}
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 top-4 hidden w-[min(46vw,560px)] md:block"
          >
            <Image
              src="/brand/statue-clean.png"
              alt=""
              width={840}
              height={805}
              priority
              className="caden-statue h-auto w-full"
            />
          </motion.div>

          <motion.p variants={heroItem} className="caden-eyebrow relative z-10">
            ( from repo to update )
          </motion.p>

          <h1 className="relative z-10 mt-6 font-medium leading-[0.95] tracking-[-0.03em]">
            <span className="block overflow-hidden">
              <motion.span
                variants={heroLine}
                className="block text-[clamp(52px,9.5vw,148px)]"
              >
                Ship the work.
              </motion.span>
            </span>
            <span className="block overflow-hidden text-right">
              <motion.span
                variants={heroLine}
                className="block text-[clamp(52px,9.5vw,148px)] sm:pr-[4vw]"
              >
                Send the update.
              </motion.span>
            </span>
          </h1>

          <motion.p
            variants={heroItem}
            className="relative z-10 mt-10 max-w-[480px] text-lg leading-relaxed text-[#b5b5b5]"
          >
            caden reads your repo: merged PRs, commits, releases. It drafts the
            founder comms you keep postponing. You review. You hit send.
          </motion.p>

          <motion.div
            variants={heroItem}
            className="relative z-10 mt-8 flex flex-wrap items-center gap-5"
          >
            <a
              href="#generate"
              className="caden-pill inline-flex items-center gap-2 bg-[#f9fe2e] px-6 py-3 text-sm font-medium text-[#161616] transition-[background-color,transform] duration-200 hover:scale-[1.04] hover:bg-[#ffe042]"
            >
              Generate my update
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#6d6d6d]">
              grounded in real diffs, not vibes.
            </span>
          </motion.div>

          <motion.ul
            variants={heroItem}
            className="relative z-10 mt-14 flex flex-wrap items-center gap-x-6 gap-y-2"
          >
            {ARTIFACT_CHIPS.map((chip, i) => (
              <li
                key={chip}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8f8f8f]"
              >
                <span className="mr-2 text-[#6d6d6d]">0{i + 1}</span>
                {chip}
              </li>
            ))}
          </motion.ul>
        </motion.section>

        {/* Stats band: dense functional block after the sparse hero */}
        <section className="border-y border-[#2a2a2a]">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 divide-y divide-[#2a2a2a] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STATS.map((stat) => (
              <div key={stat.value} className="px-6 py-10 sm:py-12">
                <p className="font-mono text-[clamp(56px,7vw,110px)] font-medium leading-none tracking-tight text-[#f1f1f1]">
                  {stat.value}
                </p>
                <p className="mt-3 max-w-[240px] text-sm leading-relaxed text-[#8f8f8f]">
                  {stat.caption}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Generator */}
        <motion.section
          id="generate"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 pb-28 pt-24"
        >
          <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div>
              <p className="caden-eyebrow">( the generator )</p>
              <h2 className="mt-5 text-[clamp(36px,4.5vw,64px)] font-medium leading-[1.02] tracking-[-0.02em] text-[#f1f1f1]">
                Point it at a repo.
              </h2>
              <p className="mt-6 max-w-[420px] leading-relaxed text-[#b5b5b5]">
                Public repo in, finished drafts out. The agents read the
                commits, merged PRs, and releases in your date range, then
                write everything your investors and audience need.
              </p>
            </div>
            <div className="rounded-2xl border border-[#2a2a2a] bg-[#161616] p-6 sm:p-8">
              <GenerateForm onResult={setArtifacts} />
            </div>
          </div>
        </motion.section>

        {/* Results */}
        {artifacts && (
          <section
            ref={resultsRef}
            className="mx-auto w-full max-w-5xl scroll-mt-28 px-6 pb-28"
          >
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="mb-8">
                <p className="caden-eyebrow">( your artifacts )</p>
                <h2 className="mt-4 text-[clamp(32px,4vw,56px)] font-medium leading-[1.02] tracking-[-0.02em] text-[#f1f1f1]">
                  You review. You hit send.
                </h2>
              </div>
              <ArtifactTabs artifacts={artifacts} />
            </motion.div>
          </section>
        )}

        {/* The one loud moment: full-bleed yellow */}
        <section className="relative overflow-hidden bg-[#f9fe2e]">
          <div className="caden-grid absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#161616]">
              ( the wedge )
            </p>
            <h2 className="mt-6 max-w-[14ch] text-[clamp(44px,7vw,110px)] font-medium leading-[0.98] tracking-[-0.03em] text-[#161616]">
              Never write an investor update again.
            </h2>
            <p className="mt-8 max-w-[520px] text-lg leading-relaxed text-[#161616]">
              caden drafts it from the work you shipped: merged PRs, commits,
              releases. Grounded in real diffs, not vibes.
            </p>
            <a
              href="#generate"
              className="caden-pill mt-10 inline-flex items-center gap-2 bg-[#161616] px-6 py-3 text-sm font-medium text-[#f1f1f1] transition-transform duration-200 hover:scale-[1.04]"
            >
              Generate my update
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
