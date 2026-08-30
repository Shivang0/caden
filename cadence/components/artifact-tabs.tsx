"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Markdown } from "@/components/markdown";
import { VideoStudio } from "@/components/video-studio";
import type { CadenceArtifacts } from "@/lib/types";

type TabId = "investor" | "linkedin" | "x" | "changelog" | "video";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "investor", label: "Investor Update" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X Thread" },
  { id: "changelog", label: "Changelog" },
  { id: "video", label: "Video update" },
];

const TWEET_LIMIT = 280;
const TWEET_WARN = 260;

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const empty = text.trim().length === 0;

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      disabled={empty}
      aria-live="polite"
      onClick={async () => {
        const ok = await copyToClipboard(text);
        if (!ok) return;
        setCopied(true);
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
      }}
      className={`caden-pill inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        copied
          ? "border-[#f9fe2e]/50 bg-[#f9fe2e]/10 text-[#f9fe2e]"
          : "border-[#363636] bg-[#212121] text-[#8f8f8f] hover:border-[#676767] hover:text-[#f1f1f1]"
      }`}
    >
      {copied ? (
        "Copied ✓"
      ) : (
        <>
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect
              x="5.5"
              y="5.5"
              width="8"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.25"
            />
            <path
              d="M10.5 3.5v-1a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1h1"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

// Direct publish to the founder's real LinkedIn feed. Two clicks (arm, then
// confirm) so nothing goes public by accident; uses the portal session cookie.
function PostLinkedInButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "armed" | "posting" | "posted" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const disarmRef = useRef<number | null>(null);
  const empty = text.trim().length === 0;

  useEffect(() => {
    return () => {
      if (disarmRef.current !== null) window.clearTimeout(disarmRef.current);
    };
  }, []);

  async function onClick() {
    if (state === "posting" || state === "posted") return;
    if (state !== "armed") {
      setState("armed");
      setMessage("Publishes to your real feed. Click again to confirm.");
      if (disarmRef.current !== null) window.clearTimeout(disarmRef.current);
      disarmRef.current = window.setTimeout(() => {
        setState((s) => (s === "armed" ? "idle" : s));
        setMessage(null);
      }, 6000);
      return;
    }
    if (disarmRef.current !== null) window.clearTimeout(disarmRef.current);
    setState("posting");
    setMessage(null);
    try {
      const res = await fetch("/portal/api/publish/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; name?: string };
      if (!res.ok) throw new Error(data.error ?? `Publish failed (${res.status}).`);
      setState("posted");
      setMessage(data.name ? `Live on LinkedIn as ${data.name}.` : "Live on LinkedIn.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Publish failed.");
      window.setTimeout(() => {
        setState((s) => (s === "error" ? "idle" : s));
      }, 4000);
    }
  }

  const label =
    state === "armed"
      ? "Confirm post?"
      : state === "posting"
        ? "Posting…"
        : state === "posted"
          ? "Posted ✓"
          : "Post to LinkedIn";

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={empty || state === "posting" || state === "posted"}
        aria-live="polite"
        onClick={() => void onClick()}
        className={`caden-pill inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          state === "posted"
            ? "border-[#f9fe2e]/50 bg-[#f9fe2e]/10 text-[#f9fe2e]"
            : state === "armed"
              ? "border-[#f9fe2e] bg-[#f9fe2e] text-[#161616]"
              : "border-[#363636] bg-[#212121] text-[#8f8f8f] hover:border-[#676767] hover:text-[#f1f1f1]"
        }`}
      >
        {label}
      </button>
      {message && (
        <span
          className={`max-w-[220px] text-right text-[11px] leading-snug ${
            state === "error" ? "text-[#ff7a6e]" : "text-[#8f8f8f]"
          }`}
        >
          {message}
        </span>
      )}
    </span>
  );
}

function PanelHeader({
  title,
  subtitle,
  copyText,
  copyLabel,
  action,
}: {
  title: string;
  subtitle: string;
  copyText: string;
  copyLabel?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-base font-medium tracking-tight text-[#f1f1f1]">{title}</h3>
        <p className="mt-0.5 text-xs text-[#8f8f8f]">{subtitle}</p>
      </div>
      <div className="flex items-start gap-2">
        {action}
        <CopyButton text={copyText} label={copyLabel} />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#363636] bg-[#1a1a1a] px-6 py-10 text-center">
      <p className="text-sm text-[#b5b5b5]">{message}</p>
      <p className="mt-1.5 text-xs text-[#6d6d6d]">
        Try a wider date range or a more active repo, then regenerate.
      </p>
    </div>
  );
}

export interface ArtifactTabsProps {
  artifacts: CadenceArtifacts;
}

export function ArtifactTabs({ artifacts }: ArtifactTabsProps) {
  const [tab, setTab] = useState<TabId>("investor");
  // The video studio holds expensive local state (generated voiceover, scene
  // edits), so once visited it stays mounted and is hidden with CSS instead of
  // being unmounted on tab switches.
  const [videoMounted, setVideoMounted] = useState(false);
  if (tab === "video" && !videoMounted) setVideoMounted(true);
  const { meta } = artifacts;

  const onTablistKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === -1) return;
    event.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`artifact-tab-${TABS[next].id}`)?.focus();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#161616]">
      {/* Header: company, themes, meta */}
      <div className="border-b border-[#2a2a2a] px-6 pb-5 pt-6 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-lg font-medium tracking-tight text-[#f1f1f1]">
            {artifacts.company}
          </h2>
          {meta.mock && (
            <span
              className="caden-pill inline-flex items-center gap-1.5 border border-[#f9fe2e]/40 bg-[#f9fe2e]/10 px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#f9fe2e]"
              title="Demo mode: generated without an LLM key, from your real repo activity"
            >
              <span className="h-1.5 w-1.5 bg-[#f9fe2e]" />
              demo output
            </span>
          )}
          {meta.cached && (
            <span
              className="caden-pill inline-flex items-center gap-1.5 border border-[#676767]/60 bg-[#212121] px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#b5b5b5]"
              title="Served instantly from your latest successful run"
            >
              <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M6.5 1L2 7h3l-.5 4L9 5H6l.5-4z"
                  fill="currentColor"
                />
              </svg>
              cached
            </span>
          )}
          <span className="w-full font-mono text-[11px] text-[#6d6d6d] sm:ml-auto sm:w-auto">
            {meta.commitCount} commits · {meta.prCount} PRs · {meta.releaseCount} releases ·{" "}
            {meta.model}
          </span>
        </div>
        {artifacts.themes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {artifacts.themes.map((theme) => (
              <span
                key={theme}
                className="caden-pill border border-[#363636] bg-[#212121] px-2.5 py-1 font-mono text-[11px] text-[#b5b5b5]"
              >
                {theme}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tab bar: mono label strip with a yellow underline fill */}
      <div className="border-b border-[#2a2a2a] px-3 sm:px-5">
        <div
          role="tablist"
          aria-label="Generated artifacts"
          onKeyDown={onTablistKeyDown}
          className="flex gap-1 overflow-x-auto"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                id={`artifact-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`artifact-panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={`relative shrink-0 px-3.5 py-3.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
                  active ? "text-[#f1f1f1]" : "text-[#8f8f8f] hover:text-[#f1f1f1]"
                }`}
              >
                {t.label}
                {active && (
                  <motion.span
                    layoutId="artifact-tab-underline"
                    className="absolute inset-x-2 -bottom-px h-0.5 bg-[#f9fe2e]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panels */}
      <div className="px-6 py-6 sm:px-8 sm:py-7">
        <AnimatePresence mode="wait" initial={false}>
          {tab !== "video" && (
          <motion.div
            key={tab}
            id={`artifact-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`artifact-tab-${tab}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {tab === "investor" && (
              <div>
                <PanelHeader
                  title="Investor update"
                  subtitle="Markdown, ready to paste into your monthly email"
                  copyText={artifacts.investorUpdate}
                />
                {artifacts.investorUpdate.trim().length > 0 ? (
                  <Markdown
                    content={artifacts.investorUpdate}
                    className="max-w-prose"
                  />
                ) : (
                  <EmptyState message="No investor update was generated for this period." />
                )}
              </div>
            )}

            {tab === "linkedin" && (
              <div>
                <PanelHeader
                  title="LinkedIn post"
                  subtitle="Build-in-public, formatted for the feed"
                  copyText={artifacts.linkedinPost}
                  action={<PostLinkedInButton text={artifacts.linkedinPost} />}
                />
                {artifacts.linkedinPost.trim().length > 0 ? (
                  <div className="max-w-xl rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f9fe2e] text-sm font-bold text-[#161616]">
                        {artifacts.company.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#f1f1f1]">
                          {artifacts.company}
                        </p>
                        <p className="text-xs text-[#8f8f8f]">
                          Building in public · Just now ·{" "}
                          <svg
                            className="inline h-3 w-3 -translate-y-px"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            aria-hidden="true"
                          >
                            <circle cx="8" cy="8" r="6.25" />
                            <path d="M1.75 8h12.5M8 1.75c1.8 1.9 2.6 4 2.6 6.25S9.8 12.35 8 14.25c-1.8-1.9-2.6-4-2.6-6.25S6.2 3.65 8 1.75z" />
                          </svg>
                        </p>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#cfcfcf]">
                      {artifacts.linkedinPost}
                    </p>
                    <div
                      className="mt-4 flex items-center justify-between border-t border-[#2a2a2a] pt-3 text-[#6d6d6d]"
                      aria-hidden="true"
                    >
                      {[
                        {
                          name: "Like",
                          d: "M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3",
                        },
                        {
                          name: "Comment",
                          d: "M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z",
                        },
                        {
                          name: "Repost",
                          d: "M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3",
                        },
                        {
                          name: "Send",
                          d: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
                        },
                      ].map((action) => (
                        <span
                          key={action.name}
                          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d={action.d} />
                          </svg>
                          {action.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState message="No LinkedIn post was generated for this period." />
                )}
              </div>
            )}

            {tab === "x" && (
              <div>
                <PanelHeader
                  title="X thread"
                  subtitle={`${artifacts.xThread.length} tweets`}
                  copyText={artifacts.xThread.join("\n\n")}
                  copyLabel="Copy thread"
                />
                {artifacts.xThread.length > 0 ? (
                  <ol className="flex max-w-xl flex-col gap-3">
                    {artifacts.xThread.map((tweet, i) => {
                      const over = tweet.length > TWEET_LIMIT;
                      const near = !over && tweet.length >= TWEET_WARN;
                      return (
                        <li
                          key={`tweet-${i}`}
                          className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 transition-colors hover:border-[#363636]"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="font-mono text-[11px] text-[#6d6d6d]">
                              {i + 1}/{artifacts.xThread.length}
                            </span>
                            <div className="flex items-center gap-3">
                              <span
                                className={`font-mono text-[11px] tabular-nums ${
                                  over
                                    ? "font-semibold text-[#ff7a6e]"
                                    : near
                                      ? "text-[#f9fe2e]"
                                      : "text-[#6d6d6d]"
                                }`}
                                title={
                                  over
                                    ? "Over the 280-character limit"
                                    : "Characters used"
                                }
                              >
                                {tweet.length}/{TWEET_LIMIT}
                              </span>
                              <CopyButton text={tweet} />
                            </div>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#cfcfcf]">
                            {tweet}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <EmptyState message="No X thread was generated for this period." />
                )}
              </div>
            )}

            {tab === "changelog" && (
              <div>
                <PanelHeader
                  title="Changelog"
                  subtitle="Markdown, ready for your docs or release page"
                  copyText={artifacts.changelog}
                />
                {artifacts.changelog.trim().length > 0 ? (
                  <Markdown content={artifacts.changelog} className="max-w-prose" />
                ) : (
                  <EmptyState message="No changelog entries were generated for this period." />
                )}
              </div>
            )}

          </motion.div>
          )}
        </AnimatePresence>

        {/* Kept mounted (CSS-hidden) so voiceover + scene edits survive tab
            switches; mounts lazily on first visit to the video tab. */}
        {videoMounted && (
          <div
            id="artifact-panel-video"
            role="tabpanel"
            aria-labelledby="artifact-tab-video"
            hidden={tab !== "video"}
            className={tab === "video" ? "" : "hidden"}
          >
            <VideoStudio artifacts={artifacts} />
          </div>
        )}
      </div>
    </div>
  );
}
