"use client";

// Connections portal: one-click account linking for data sources.
// Renders live from /api/connect/status: providers light up automatically
// as their OAuth apps are configured in env. Gating:
//   - not logged in            -> "log in" card, no provider list
//   - logged in, free + billed -> upgrade card, Connect buttons locked
//   - canConnect               -> working Connect / Disconnect

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { VoiceCard } from "@/components/voice-card";
import type { Plan, SessionUser } from "@/lib/types";

interface ProviderStatus {
  id: string;
  label: string;
  configured: boolean;
  connected: boolean;
  note?: string;
}

interface ConnectStatus {
  providers: ProviderStatus[];
  authenticated: boolean;
  plan: Plan | null;
  canConnect: boolean;
  billingConfigured: boolean;
}

const PROVIDER_ICONS: Record<string, string> = {
  github: "⌥",
  linear: "◫",
  notion: "▦",
  figma: "❖",
  vercel: "▲",
  stripe: "≋",
};

const PROVIDER_BLURBS: Record<string, string> = {
  github: "Every repo in your org, watched. Updates write themselves from real diffs.",
  linear: "Completed issues become planning bullets in your update.",
  notion: "Docs edited in the period join the story.",
  figma: "Design files that moved. Design work gets credit too.",
  vercel: "Production deploys in the period, straight from the source.",
  stripe: "MRR, new customers, cash collected: your Metrics section writes itself.",
};

// Providers whose Connect is a one-click POST to /manual instead of an OAuth
// redirect. Stripe binds the founder's key; GitHub binds the org token.
const ONE_CLICK = new Set(["stripe", "github"]);

function SkeletonCard() {
  return (
    <div className="flex animate-pulse items-center gap-4 rounded-2xl border border-[#2a2a2a] bg-[#161616] p-5">
      <div className="h-10 w-10 shrink-0 rounded-xl bg-[#212121]" />
      <div className="flex-1 space-y-2.5">
        <div className="h-3.5 w-28 rounded bg-[#212121]" />
        <div className="h-3 w-3/4 max-w-xs rounded bg-[#212121]" />
      </div>
      <div className="caden-pill hidden h-8 w-24 bg-[#212121] sm:block" />
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect
        x="3.25"
        y="7.25"
        width="9.5"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5.5 7V5.5a2.5 2.5 0 015 0V7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function ConnectionsPage() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [oneClickError, setOneClickError] = useState<{ id: string; message: string } | null>(null);
  // OAuth callback outcome, read from the query string the callback redirects
  // back with (connected=<id> on success, connect_error=<id>&reason=<code> on
  // failure). Rendered once, then the URL is cleaned so refreshes stay quiet.
  const [callbackNotice, setCallbackNotice] = useState<
    { kind: "ok"; id: string } | { kind: "error"; id: string; reason: string } | null
  >(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const failed = params.get("connect_error");
    if (connected) setCallbackNotice({ kind: "ok", id: connected });
    else if (failed)
      setCallbackNotice({ kind: "error", id: failed, reason: params.get("reason") ?? "unknown" });
    if (connected || failed) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [statusRes, sessionRes] = await Promise.all([
        fetch("/portal/api/connect/status"),
        fetch("/portal/api/auth/session"),
      ]);
      if (statusRes.ok) {
        const data = (await statusRes.json()) as ConnectStatus;
        setStatus(data);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
      if (sessionRes.ok) {
        const data = (await sessionRes.json()) as { user: SessionUser | null };
        setUser(data.user);
      }
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (active) await refresh();
    };
    void load();
    return () => {
      active = false;
    };
  }, [refresh]);

  async function connectOneClick(id: string) {
    setBusy(id);
    setOneClickError(null);
    try {
      const res = await fetch(`/portal/api/connect/${id}/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setOneClickError({ id, message: data.error ?? "Connect failed." });
      } else {
        await refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  const disconnect = useCallback(
    async (id: string) => {
      setBusy(id);
      try {
        await fetch(`/portal/api/connect/${id}/disconnect`, { method: "POST" });
        await refresh();
      } catch {
        // Network failure: surface it in the load-error banner rather than
        // leaving an unhandled rejection.
        setLoadError(true);
      } finally {
        setBusy(null);
      }
    },
    [refresh]
  );

  const loading = status === null && !loadError;
  const authenticated = status?.authenticated ?? false;
  const canConnect = status?.canConnect ?? false;
  const providers = status?.providers ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-[#1a1a1a] font-sans text-[#f1f1f1]">
      {/* Nav: mirrors the home page header */}
      <SiteHeader>
        <a
          href="/portal"
          className="caden-pill border border-[#363636] px-4 py-1.5 text-sm font-medium text-[#f1f1f1] transition-colors hover:border-[#676767]"
        >
          Back to generator
        </a>
      </SiteHeader>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14 sm:py-16">
        <p className="caden-eyebrow mb-4">( connections )</p>
        <h1 className="mb-3 text-5xl font-medium leading-[1.02] tracking-[-0.02em] text-[#f1f1f1]">
          Connect your accounts.
        </h1>
        <p className="mb-10 max-w-xl leading-relaxed text-[#b5b5b5]">
          One click per tool. Tokens are encrypted at rest and scoped to your
          account. Every update you generate automatically uses everything
          connected here.
        </p>

        {authenticated && user && (
          <p className="mb-8 text-sm text-[#b5b5b5]">
            Signed in as{" "}
            <span className="font-medium text-[#f1f1f1]">
              {user.name || user.email}
            </span>{" "}
            {user.name && <span className="text-[#8f8f8f]">({user.email})</span>}
          </p>
        )}

        {callbackNotice && (
          <div
            role={callbackNotice.kind === "error" ? "alert" : "status"}
            className={`mb-6 rounded-2xl border p-5 ${
              callbackNotice.kind === "error"
                ? "border-[#ff7a6e]/40 bg-[#ff7a6e]/10"
                : "border-[#f9fe2e]/40 bg-[#f9fe2e]/10"
            }`}
          >
            <p
              className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
                callbackNotice.kind === "error" ? "text-[#ff7a6e]" : "text-[#f9fe2e]"
              }`}
            >
              {callbackNotice.kind === "error"
                ? `( ${callbackNotice.id} connect failed )`
                : `( ${callbackNotice.id} connected )`}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[#f1f1f1]/85">
              {callbackNotice.kind === "error" ? (
                <>
                  The provider said no at the last step. Code:{" "}
                  <span className="font-mono text-[#f1f1f1]">{callbackNotice.reason}</span>. Try
                  again; if it repeats, the code above is exactly what to report.
                </>
              ) : (
                "Token stored, encrypted, scoped to your account. It feeds every update you generate."
              )}
            </p>
          </div>
        )}

        <div className="grid gap-4" aria-busy={loading}>
          {loading && (
            <>
              <span className="sr-only" role="status">
                Loading providers
              </span>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {loadError && status === null && (
            <div
              role="alert"
              className="rounded-2xl border border-[#ff7a6e]/40 bg-[#ff7a6e]/10 p-6"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#ff7a6e]">
                ( could not load providers )
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[#f1f1f1]/85">
                The connections service did not respond. Check your dev server
                and try again.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoadError(false);
                  void refresh();
                }}
                className="caden-pill mt-4 border border-[#ff7a6e]/40 bg-[#ff7a6e]/10 px-3.5 py-1.5 text-sm font-medium text-[#ff7a6e] transition-colors hover:border-[#ff7a6e]/60"
              >
                Retry
              </button>
            </div>
          )}

          {/* Logged out: no provider cards, just the door in. */}
          {status !== null && !authenticated && (
            <div className="rounded-2xl border border-[#2a2a2a] bg-[#161616] p-8 sm:p-10">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#363636] bg-[#212121] text-[#f9fe2e]"
                aria-hidden="true"
              >
                <LockIcon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-medium tracking-tight text-[#f1f1f1]">
                Log in to connect your accounts
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#b5b5b5]">
                Connections are saved to your caden account so every update
                you generate can use them.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/login?next=/connections"
                  className="caden-pill bg-[#f9fe2e] px-5 py-2 text-sm font-medium text-[#161616] transition-[background-color,transform] duration-200 hover:scale-[1.04] hover:bg-[#ffe042]"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="caden-pill border border-[#363636] px-5 py-2 text-sm text-[#f1f1f1] transition-colors hover:border-[#676767]"
                >
                  Sign up
                </Link>
              </div>
            </div>
          )}

          {/* Free plan while billing is live: pitch Pro, lock the buttons. */}
          {status !== null && authenticated && !canConnect && (
            <div className="rounded-2xl border border-[#f9fe2e]/30 bg-[#161616] p-6 sm:p-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#f9fe2e]">
                ( pro feature )
              </p>
              <h2 className="mt-2 text-lg font-medium tracking-tight text-[#f1f1f1]">
                Upgrade to Pro to connect accounts
              </h2>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#b5b5b5]">
                Account connections are part of the Pro plan. Upgrade to feed
                Linear, Notion, Figma, Vercel, and Stripe into every update.
              </p>
              <Link
                href="/account?upgrade=1"
                className="caden-pill mt-5 inline-block bg-[#f9fe2e] px-5 py-2 text-sm font-medium text-[#161616] transition-[background-color,transform] duration-200 hover:scale-[1.04] hover:bg-[#ffe042]"
              >
                Upgrade to Pro
              </Link>
            </div>
          )}

          {status !== null &&
            authenticated &&
            providers !== null &&
            providers.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#363636] bg-[#161616] p-8 text-center text-sm text-[#b5b5b5]">
                No providers are available yet. Add OAuth credentials in
                .env.local to light these up. See CONNECT-SETUP.md.
              </div>
            )}

          {authenticated &&
            providers?.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-4 rounded-2xl border border-[#2a2a2a] bg-[#161616] p-5 transition-colors hover:border-[#363636] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#363636] bg-[#212121] text-lg text-[#f9fe2e]"
                    aria-hidden="true"
                  >
                    {PROVIDER_ICONS[p.id] ?? "•"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[#f1f1f1]">{p.label}</span>
                      {p.connected && (
                        <span className="caden-pill inline-flex items-center gap-1.5 border border-[#f9fe2e]/40 bg-[#f9fe2e]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#f9fe2e]">
                          <span className="h-1.5 w-1.5 bg-[#f9fe2e]" />
                          Connected
                        </span>
                      )}
                      {!p.configured && (
                        <span className="caden-pill border border-[#363636] bg-[#212121] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#8f8f8f]">
                          Setup needed
                        </span>
                      )}
                    </div>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-[#b5b5b5]">
                      {PROVIDER_BLURBS[p.id] ?? ""}
                      {p.note ? <span className="text-[#8f8f8f]"> {p.note}</span> : null}
                    </p>
                    {oneClickError && oneClickError.id === p.id ? (
                      <p className="mt-1 text-xs text-[#ff7a6e]">{oneClickError.message}</p>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 pl-14 sm:pl-0">
                  {p.connected ? (
                    <button
                      type="button"
                      onClick={() => void disconnect(p.id)}
                      disabled={busy === p.id}
                      className="caden-pill border border-[#363636] px-4 py-2 text-sm text-[#b5b5b5] transition-colors hover:border-[#676767] hover:text-[#f1f1f1] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === p.id ? "Disconnecting…" : "Disconnect"}
                    </button>
                  ) : ONE_CLICK.has(p.id) && p.configured && canConnect ? (
                    <button
                      type="button"
                      onClick={() => void connectOneClick(p.id)}
                      disabled={busy === p.id}
                      className="caden-pill bg-[#f9fe2e] px-4 py-2 text-sm font-medium text-[#161616] transition-[background-color,transform] duration-200 hover:scale-[1.04] hover:bg-[#ffe042] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === p.id ? "Connecting…" : "Connect"}
                    </button>
                  ) : p.configured ? (
                    canConnect ? (
                      <a
                        href={`/portal/api/connect/${p.id}/start`}
                        className="caden-pill inline-block bg-[#f9fe2e] px-4 py-2 text-sm font-medium text-[#161616] transition-[background-color,transform] duration-200 hover:scale-[1.04] hover:bg-[#ffe042]"
                      >
                        Connect
                      </a>
                    ) : (
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        <button
                          type="button"
                          disabled
                          title="Upgrade to Pro to connect accounts"
                          className="caden-pill inline-flex cursor-not-allowed items-center gap-1.5 border border-[#2a2a2a] bg-[#212121] px-4 py-2 text-sm text-[#6d6d6d]"
                        >
                          <LockIcon className="h-3.5 w-3.5" />
                          Connect
                        </button>
                        <span className="text-[11px] text-[#6d6d6d]">
                          Pro plan required
                        </span>
                      </div>
                    )
                  ) : (
                    <span
                      className="caden-pill inline-block cursor-not-allowed border border-[#2a2a2a] bg-[#212121] px-4 py-2 text-sm text-[#6d6d6d]"
                      title="Add this provider's OAuth app credentials to .env.local. See CONNECT-SETUP.md"
                    >
                      Connect
                    </span>
                  )}
                </div>
              </div>
            ))}
          {authenticated && <VoiceCard />}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-[#6d6d6d]">
          Press &amp; web mentions (via Linkup) are pulled automatically, no
          connection needed. Setup guide for these buttons:{" "}
          <span className="font-mono text-[#8f8f8f]">CONNECT-SETUP.md</span>.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
