"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { VoiceNoteButton } from "@/components/voice-note";
import type { CadenceArtifacts, GenerateRequest } from "@/lib/types";

const AGENT_STEPS = [
  "Reading your repo…",
  "Analyst agent extracting themes…",
  "Writers drafting…",
  "Narrator scripting your video…",
] as const;

const STEP_INTERVAL_MS = 4500;

const TONES: Array<{ value: NonNullable<GenerateRequest["tone"]>; label: string }> = [
  { value: "confident", label: "Confident" },
  { value: "humble", label: "Humble" },
  { value: "hype", label: "Hype" },
];

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): { since: string; until: string } {
  const until = new Date();
  const since = new Date(until.getTime() - 14 * 24 * 60 * 60 * 1000);
  return { since: toISODate(since), until: toISODate(until) };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isVideoScene(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.title === "string" &&
    typeof s.narration === "string" &&
    isStringArray(s.bullets)
  );
}

function isCadenceArtifacts(value: unknown): value is CadenceArtifacts {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v.company !== "string" ||
    typeof v.investorUpdate !== "string" ||
    typeof v.linkedinPost !== "string" ||
    typeof v.changelog !== "string" ||
    !isStringArray(v.xThread) ||
    !isStringArray(v.themes)
  ) {
    return false;
  }
  if (typeof v.script !== "object" || v.script === null) return false;
  const script = v.script as Record<string, unknown>;
  if (
    typeof script.durationSeconds !== "number" ||
    !Array.isArray(script.scenes) ||
    !script.scenes.every(isVideoScene)
  ) {
    return false;
  }
  if (typeof v.meta !== "object" || v.meta === null) return false;
  const meta = v.meta as Record<string, unknown>;
  return (
    typeof meta.mock === "boolean" &&
    typeof meta.model === "string" &&
    typeof meta.commitCount === "number" &&
    typeof meta.prCount === "number" &&
    typeof meta.releaseCount === "number"
  );
}

// Turn machine error codes into something a human (and a judge) can read.
const FRIENDLY_ERRORS: Record<string, string> = {
  login_required:
    "You've used your free run in this browser. Log in to keep generating.",
  payment_required:
    "You're on the free plan. Upgrade to generate unlimited updates.",
};

function extractErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    if (typeof b.error === "string") {
      return FRIENDLY_ERRORS[b.error] ?? b.error;
    }
    if (typeof b.message === "string") return b.message;
    try {
      return JSON.stringify(body);
    } catch {
      return fallback;
    }
  }
  if (typeof body === "string" && body.trim().length > 0) return body;
  return fallback;
}

// The API adds an optional sourceErrors[] when an optional connected source
// (Linear/Notion/Figma/Vercel/Stripe/PostHog) failed: surface it, don't drop it.
function extractSourceErrors(body: unknown): string[] {
  if (typeof body === "object" && body !== null) {
    const se = (body as Record<string, unknown>).sourceErrors;
    if (Array.isArray(se)) return se.filter((s): s is string => typeof s === "string");
  }
  return [];
}

const fieldLabel =
  "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#8f8f8f]";

const fieldInput =
  "w-full rounded-xl border border-[#363636] bg-[#212121] px-3.5 py-2.5 text-sm text-[#f1f1f1] placeholder:text-[#6d6d6d] outline-none transition-colors focus:border-[#f9fe2e]/70";

export interface GenerateFormProps {
  onResult: (artifacts: CadenceArtifacts) => void;
}

export function GenerateForm({ onResult }: GenerateFormProps) {
  const initialRange = defaultRange();
  const [repoUrl, setRepoUrl] = useState("");
  const [since, setSince] = useState(initialRange.since);
  const [until, setUntil] = useState(initialRange.until);
  const [company, setCompany] = useState("");
  const [metricsNotes, setMetricsNotes] = useState("");
  const [tone, setTone] = useState<NonNullable<GenerateRequest["tone"]>>("confident");

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      setStep((s) => Math.min(s + 1, AGENT_STEPS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loading]);

  // Elapsed-time readout for the stepper: makes the wait feel accounted for.
  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const tick = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [loading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError(null);
    setSourceWarnings([]);
    setStep(0);
    setElapsed(0);
    setLoading(true);

    // Cleared date inputs submit "" so omit them; the server applies its
    // default window (until = today, since = until - 14d) instead of 400ing.
    const payload: Partial<GenerateRequest> & Pick<GenerateRequest, "repoUrl"> = {
      repoUrl: repoUrl.trim(),
      tone,
    };
    if (since) payload.since = since;
    if (until) payload.until = until;
    if (company.trim()) payload.company = company.trim();
    if (metricsNotes.trim()) payload.metricsNotes = metricsNotes.trim();

    try {
      const res = await fetch("/portal/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      let body: unknown = null;
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }

      if (!res.ok) {
        throw new Error(
          extractErrorMessage(body, `Request failed (${res.status} ${res.statusText}).`),
        );
      }

      if (!isCadenceArtifacts(body)) {
        throw new Error("The generator returned an unexpected response shape.");
      }

      setSourceWarnings(extractSourceErrors(body));
      onResult(body);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong while generating. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate={false}>
      {/* Repo URL */}
      <div className="flex flex-col gap-2">
        <label htmlFor="repo-url" className={fieldLabel}>
          GitHub repository
        </label>
        <input
          id="repo-url"
          type="url"
          required
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/vercel/ai"
          disabled={loading}
          className={fieldInput}
        />
      </div>

      {/* Date range */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="since" className={fieldLabel}>
            From
          </label>
          <input
            id="since"
            type="date"
            value={since}
            max={until}
            onChange={(e) => setSince(e.target.value)}
            disabled={loading}
            className={fieldInput}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="until" className={fieldLabel}>
            To
          </label>
          <input
            id="until"
            type="date"
            value={until}
            min={since}
            onChange={(e) => setUntil(e.target.value)}
            disabled={loading}
            className={fieldInput}
          />
        </div>
      </div>

      {/* Company */}
      <div className="flex flex-col gap-2">
        <label htmlFor="company" className={fieldLabel}>
          Company name{" "}
          <span className="normal-case tracking-normal text-[#6d6d6d]">(optional)</span>
        </label>
        <input
          id="company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Defaults to the repo name"
          disabled={loading}
          className={fieldInput}
        />
      </div>

      {/* Metrics / context + voice note */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="metrics" className={fieldLabel}>
            Metrics &amp; context{" "}
            <span className="normal-case tracking-normal text-[#6d6d6d]">(optional)</span>
          </label>
          <VoiceNoteButton
            disabled={loading}
            onTranscript={(text) =>
              setMetricsNotes((prev) =>
                prev.trim().length > 0 ? `${prev.trimEnd()} ${text}` : text,
              )
            }
          />
        </div>
        <textarea
          id="metrics"
          rows={4}
          value={metricsNotes}
          onChange={(e) => setMetricsNotes(e.target.value)}
          placeholder="MRR hit $12k (+18% MoM), signed 3 design partners, hired a founding engineer… or dictate it."
          disabled={loading}
          className={`${fieldInput} resize-y leading-relaxed`}
        />
      </div>

      {/* Tone segmented control */}
      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>Tone</span>
        <div
          role="radiogroup"
          aria-label="Tone"
          onKeyDown={(event) => {
            const index = TONES.findIndex((t) => t.value === tone);
            let next = -1;
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              next = (index + 1) % TONES.length;
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              next = (index - 1 + TONES.length) % TONES.length;
            }
            if (next === -1) return;
            event.preventDefault();
            setTone(TONES[next].value);
            document.getElementById(`tone-${TONES[next].value}`)?.focus();
          }}
          className="caden-pill grid grid-cols-3 gap-1 border border-[#363636] bg-[#212121] p-1"
        >
          {TONES.map((t) => {
            const active = tone === t.value;
            return (
              <button
                key={t.value}
                id={`tone-${t.value}`}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                disabled={loading}
                onClick={() => setTone(t.value)}
                className={`caden-pill relative px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "text-[#161616]" : "text-[#8f8f8f] hover:text-[#f1f1f1]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tone-pill"
                    className="caden-pill absolute inset-0 bg-[#f9fe2e]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="caden-pill group relative mt-1 inline-flex w-full items-center justify-center gap-2 bg-[#f9fe2e] px-5 py-3 text-sm font-medium text-[#161616] transition-[background-color,transform] duration-200 hover:scale-[1.02] hover:bg-[#ffe042] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {loading ? (
          <>
            <span className="caden-spinner inline-block h-4 w-4 rounded-full border-2 border-[#161616]/30 border-t-[#161616]" />
            Generating…
          </>
        ) : (
          <>
            Generate my update
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        )}
      </button>

      {/* Agent progress stepper */}
      <AnimatePresence>
        {loading && (
          <motion.div
            key="stepper"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-[#363636] bg-[#1a1a1a] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8f8f8f]">
                  ( agents at work )
                </p>
                <span className="font-mono text-[11px] tabular-nums text-[#6d6d6d]">
                  {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                </span>
              </div>
              <ol className="flex flex-col gap-2.5">
                {AGENT_STEPS.map((label, i) => {
                  const done = i < step;
                  const active = i === step;
                  return (
                    <li key={label} className="flex items-center gap-3">
                      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                        {done ? (
                          <svg
                            className="h-5 w-5 text-[#f9fe2e]"
                            viewBox="0 0 20 20"
                            fill="none"
                            aria-hidden="true"
                          >
                            <circle
                              cx="10"
                              cy="10"
                              r="8.25"
                              stroke="currentColor"
                              strokeOpacity="0.35"
                              strokeWidth="1.5"
                            />
                            <path
                              d="M6.5 10.5l2.25 2.25L13.5 8"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : active ? (
                          <span className="caden-blink inline-flex h-2.5 w-2.5 bg-[#f9fe2e]" />
                        ) : (
                          <span className="inline-flex h-2 w-2 bg-[#363636]" />
                        )}
                      </span>
                      <span
                        className={`text-sm transition-colors ${
                          active
                            ? "text-[#f1f1f1]"
                            : done
                              ? "text-[#8f8f8f]"
                              : "text-[#6d6d6d]"
                        }`}
                      >
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div
                className="mt-4 h-1 overflow-hidden bg-white/[0.06]"
                aria-hidden="true"
              >
                <div className="caden-shimmer h-full w-2/5 bg-gradient-to-r from-transparent via-[#f9fe2e]/80 to-transparent" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error panel */}
      <AnimatePresence>
        {error && !loading && (
          <motion.div
            key="error"
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="rounded-xl border border-[#ff7a6e]/40 bg-[#ff7a6e]/10 px-4 py-3"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#ff7a6e]">
              ( generation failed )
            </p>
            <p className="mt-1.5 break-words text-sm leading-relaxed text-[#f1f1f1]/85">
              {error}
            </p>
          </motion.div>
        )}
        {sourceWarnings.length > 0 && !loading && (
          <motion.div
            key="source-warnings"
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="rounded-xl border border-[#363636] bg-[#1a1a1a] px-4 py-3"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#f9fe2e]">
              ( sources skipped )
            </p>
            <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-[#b5b5b5]">
              {sourceWarnings.map((w, i) => (
                <li key={i} className="break-words">
                  {w}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-[#8f8f8f]">
              Your update was still generated from everything else.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
