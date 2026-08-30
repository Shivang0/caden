"use client";

// /account: profile, plan, billing actions, and logout.
// Query params: ?upgraded=1 (checkout success), ?canceled=1 (checkout
// canceled), ?upgrade=1 (scroll to and emphasize the upgrade CTA).

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { EntitlementInfo, SessionUser } from "@/lib/types";

interface SessionPayload {
  user: SessionUser | null;
  entitlement: EntitlementInfo | null;
}

const BILLING_NOT_CONFIGURED =
  "Billing isn't configured in this environment.";

function AccountSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden="true">
      <div className="h-40 rounded-2xl border border-[#2a2a2a] bg-[#161616]" />
      <div className="h-36 rounded-2xl border border-[#2a2a2a] bg-[#161616]" />
    </div>
  );
}

function PlanBadge({ plan }: { plan: EntitlementInfo["plan"] }) {
  if (plan === "pro") {
    return (
      <span className="caden-pill inline-flex items-center gap-1.5 border border-[#f9fe2e]/40 bg-[#f9fe2e]/10 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#f9fe2e]">
        <span className="h-1.5 w-1.5 bg-[#f9fe2e]" />
        Pro
      </span>
    );
  }
  return (
    <span className="caden-pill inline-flex items-center border border-[#363636] bg-[#212121] px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#8f8f8f]">
      Free
    </span>
  );
}

function AccountContent() {
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded") === "1";
  const canceled = searchParams.get("canceled") === "1";
  const wantsUpgrade = searchParams.get("upgrade") === "1";

  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingNote, setBillingNote] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [emphasizeUpgrade, setEmphasizeUpgrade] = useState(false);
  const [promoCode, setPromoCode] = useState("");

  const upgradeCardRef = useRef<HTMLDivElement>(null);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/portal/api/auth/session");
      if (!res.ok) throw new Error("session unavailable");
      const data = (await res.json()) as SessionPayload;
      setSession(data);
      setLoadError(false);
      if (data.user === null) {
        // Not logged in: bounce to login and come back here afterwards.
        window.location.replace("/portal/login?next=%2Faccount");
      }
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (active) await loadSession();
    })();
    return () => {
      active = false;
    };
  }, [loadSession]);

  // ?upgrade=1: draw the eye to the upgrade CTA once the card exists.
  useEffect(() => {
    if (!wantsUpgrade) return;
    if (session?.user == null || session.entitlement?.plan !== "free") return;
    // setState via timeout (not synchronously in the effect body) to avoid a
    // cascading render, then scroll the CTA into view.
    const onId = window.setTimeout(() => setEmphasizeUpgrade(true), 0);
    const scrollId = window.setTimeout(() => {
      upgradeCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);
    const clearId = window.setTimeout(() => setEmphasizeUpgrade(false), 2800);
    return () => {
      window.clearTimeout(onId);
      window.clearTimeout(scrollId);
      window.clearTimeout(clearId);
    };
  }, [wantsUpgrade, session]);

  const startCheckout = useCallback(async () => {
    if (billingBusy) return;
    setBillingBusy(true);
    setBillingNote(null);
    try {
      const code = promoCode.trim();
      const res = await fetch("/portal/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(code ? { promoCode: code } : {}),
      });
      if (res.ok) {
        const data = (await res.json()) as { url?: unknown };
        if (typeof data.url === "string") {
          window.location.assign(data.url);
          return; // keep the button in its busy state while navigating
        }
        setBillingNote("Checkout did not return a redirect URL. Try again.");
      } else if (res.status === 422) {
        setBillingNote("That promo code isn't valid. Leave it blank to continue without one.");
      } else if (res.status === 501) {
        setBillingNote(BILLING_NOT_CONFIGURED);
      } else if (res.status === 401) {
        window.location.replace("/portal/login?next=%2Faccount");
        return;
      } else {
        setBillingNote("Could not start checkout. Try again.");
      }
    } catch {
      setBillingNote("Network error. Check your connection and try again.");
    }
    setBillingBusy(false);
  }, [billingBusy, promoCode]);

  const openPortal = useCallback(async () => {
    if (billingBusy) return;
    setBillingBusy(true);
    setBillingNote(null);
    try {
      const res = await fetch("/portal/api/billing/portal", { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { url?: unknown };
        if (typeof data.url === "string") {
          window.location.assign(data.url);
          return;
        }
        setBillingNote("The billing portal did not return a URL. Try again.");
      } else if (res.status === 501) {
        setBillingNote(BILLING_NOT_CONFIGURED);
      } else if (res.status === 404) {
        setBillingNote("No billing profile found for this account yet.");
      } else if (res.status === 401) {
        window.location.replace("/portal/login?next=%2Faccount");
        return;
      } else {
        setBillingNote("Could not open the billing portal. Try again.");
      }
    } catch {
      setBillingNote("Network error. Check your connection and try again.");
    }
    setBillingBusy(false);
  }, [billingBusy]);

  const logout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(false);
    try {
      const res = await fetch("/portal/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("logout failed");
      // Intentional full reload after sign-out: drops all client-side session
      // state so nothing from the previous user lingers.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/portal");
      return; // stay in the busy state while navigating
    } catch {
      setLogoutError(true);
      setLoggingOut(false);
    }
  }, [loggingOut]);

  // Load / error / redirecting states -------------------------------------

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-[#ff7a6e]/40 bg-[#ff7a6e]/10 p-6"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#ff7a6e]">
          ( could not load your account )
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-[#f1f1f1]/85">
          The session service did not respond. Check your dev server and try
          again.
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadError(false);
            void loadSession();
          }}
          className="caden-pill mt-4 border border-[#ff7a6e]/40 bg-[#ff7a6e]/10 px-3.5 py-1.5 text-sm font-medium text-[#ff7a6e] transition-colors hover:border-[#ff7a6e]/60"
        >
          Retry
        </button>
      </div>
    );
  }

  if (session === null) {
    return <AccountSkeleton />;
  }

  if (session.user === null) {
    // Redirect to /login is already in flight (see loadSession).
    return (
      <p role="status" className="text-sm text-[#8f8f8f]">
        Redirecting to login…
      </p>
    );
  }

  const { user, entitlement } = session;
  const plan = entitlement?.plan ?? "free";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col gap-4"
    >
      {/* Checkout outcome banners */}
      {upgraded && (
        <div
          role="status"
          className="rounded-2xl border border-[#f9fe2e]/40 bg-[#f9fe2e]/10 px-5 py-4"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#f9fe2e]">
            ( payment confirmed )
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[#f1f1f1]/90">
            Welcome to Pro. Unlimited generations and account connections are
            on.
            {plan !== "pro" && (
              <span className="text-[#f1f1f1]/60">
                {" "}
                Your plan can take a few seconds to update.
              </span>
            )}
          </p>
        </div>
      )}
      {canceled && !upgraded && (
        <div
          role="status"
          className="rounded-2xl border border-[#2a2a2a] bg-[#161616] px-5 py-4"
        >
          <p className="text-sm leading-relaxed text-[#b5b5b5]">
            Checkout canceled. Your plan is unchanged. Upgrade whenever
            you&rsquo;re ready.
          </p>
        </div>
      )}

      {/* Profile */}
      <section
        aria-labelledby="profile-heading"
        className="rounded-2xl border border-[#2a2a2a] bg-[#161616] p-6 sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="profile-heading"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8f8f8f]"
            >
              ( profile )
            </h2>
            <p className="mt-3 text-lg font-medium tracking-tight text-[#f1f1f1]">
              {user.name || user.email}
            </p>
            {user.name && <p className="mt-0.5 text-sm text-[#8f8f8f]">{user.email}</p>}
          </div>
          <PlanBadge plan={plan} />
        </div>

        {plan === "free" && entitlement && (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#8f8f8f]">Free generations used</span>
              <span className="font-mono text-xs tabular-nums text-[#b5b5b5]">
                {entitlement.freeGenerationsUsed} / {entitlement.freeGenerationLimit}
              </span>
            </div>
            <div
              className="mt-2 h-1 overflow-hidden bg-white/[0.06]"
              role="progressbar"
              aria-label="Free generations used"
              aria-valuemin={0}
              aria-valuemax={entitlement.freeGenerationLimit}
              aria-valuenow={entitlement.freeGenerationsUsed}
            >
              <div
                className="h-full bg-[#f9fe2e]"
                style={{
                  width: `${Math.min(
                    100,
                    (entitlement.freeGenerationsUsed /
                      Math.max(1, entitlement.freeGenerationLimit)) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Plan & billing */}
      <section
        ref={upgradeCardRef}
        aria-labelledby="billing-heading"
        className={`rounded-2xl border bg-[#161616] p-6 transition-shadow duration-500 sm:p-7 ${
          emphasizeUpgrade
            ? "border-[#f9fe2e]/60 shadow-[0_0_0_3px_rgba(249,254,46,0.2),0_0_40px_rgba(249,254,46,0.15)]"
            : "border-[#2a2a2a]"
        }`}
      >
        <h2
          id="billing-heading"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8f8f8f]"
        >
          ( plan &amp; billing )
        </h2>

        {plan === "free" ? (
          <>
            <p className="mt-3 text-lg font-medium tracking-tight text-[#f1f1f1]">
              Upgrade to Pro
            </p>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#b5b5b5]">
              SEK 149/month. Unlimited generations, plus account connections:
              Linear, Notion, Figma, Vercel, and Stripe feed every update
              automatically. Cancel anytime.
            </p>

            <label
              htmlFor="promo"
              className="mt-5 block font-mono text-[11px] uppercase tracking-[0.14em] text-[#8f8f8f]"
            >
              Promo code (optional)
            </label>
            <input
              id="promo"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="e.g. SWEYOUNG26"
              autoCapitalize="characters"
              className="mt-1.5 w-full max-w-xs rounded-xl border border-[#363636] bg-[#212121] px-3.5 py-2.5 font-mono text-sm uppercase tracking-wide text-[#f1f1f1] placeholder:text-[#6d6d6d] placeholder:normal-case placeholder:tracking-normal outline-none transition-colors focus:border-[#f9fe2e]/70"
            />
            <p className="mt-1.5 text-xs text-[#8f8f8f]">
              A valid code starts a 7 day free trial. Cancel before it ends and
              you pay nothing.
            </p>

            <button
              type="button"
              onClick={() => void startCheckout()}
              disabled={billingBusy}
              className="caden-pill mt-5 inline-flex items-center justify-center gap-2 bg-[#f9fe2e] px-5 py-2.5 text-sm font-medium text-[#161616] transition-[background-color,transform] duration-200 hover:scale-[1.04] hover:bg-[#ffe042] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {billingBusy ? (
                <>
                  <span className="caden-spinner inline-block h-4 w-4 rounded-full border-2 border-[#161616]/30 border-t-[#161616]" />
                  Redirecting to checkout…
                </>
              ) : (
                "Upgrade to Pro"
              )}
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-lg font-medium tracking-tight text-[#f1f1f1]">
              You&rsquo;re on Pro
            </p>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#b5b5b5]">
              Update your payment method, view invoices, or cancel anytime from
              the billing portal.
            </p>
            <button
              type="button"
              onClick={() => void openPortal()}
              disabled={billingBusy}
              className="caden-pill mt-5 inline-flex items-center justify-center gap-2 border border-[#363636] bg-[#212121] px-5 py-2.5 text-sm font-medium text-[#f1f1f1] transition-colors hover:border-[#676767] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {billingBusy ? (
                <>
                  <span className="caden-spinner inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
                  Opening billing portal…
                </>
              ) : (
                "Manage subscription"
              )}
            </button>
          </>
        )}

        {billingNote && (
          <p role="status" className="mt-3 text-sm leading-relaxed text-[#ff7a6e]">
            {billingNote}
          </p>
        )}
      </section>

      {/* Session */}
      <section
        aria-labelledby="session-heading"
        className="rounded-2xl border border-[#2a2a2a] bg-[#161616] p-6 sm:p-7"
      >
        <h2
          id="session-heading"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8f8f8f]"
        >
          ( session )
        </h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-relaxed text-[#b5b5b5]">
            Log out of caden on this browser.
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="caden-pill border border-[#363636] px-4 py-2 text-sm text-[#b5b5b5] transition-colors hover:border-[#ff7a6e]/50 hover:text-[#ff7a6e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
        {logoutError && (
          <p role="alert" className="mt-3 text-sm text-[#ff7a6e]">
            Could not log you out. Try again.
          </p>
        )}
      </section>

      <p className="text-xs leading-relaxed text-[#6d6d6d]">
        Manage your data source connections on the{" "}
        <Link
          href="/connections"
          className="font-medium text-[#8f8f8f] underline underline-offset-2 transition-colors hover:text-[#f1f1f1]"
        >
          Connections
        </Link>{" "}
        page.
      </p>
    </motion.div>
  );
}

export default function AccountPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#1a1a1a] font-sans text-[#f1f1f1]">
      <SiteHeader>
        <Link
          href="/connections"
          className="caden-sweep px-1 py-1.5 font-mono text-[12px] uppercase tracking-[0.1em] text-[#8f8f8f] transition-colors hover:text-[#f1f1f1]"
        >
          Connections
        </Link>
        <a
          href="/portal"
          className="caden-pill border border-[#363636] px-4 py-1.5 text-sm font-medium text-[#f1f1f1] transition-colors hover:border-[#676767]"
        >
          Back to generator
        </a>
      </SiteHeader>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-14 sm:py-16">
        <p className="caden-eyebrow mb-4">( account )</p>
        <h1 className="mb-3 text-5xl font-medium leading-[1.02] tracking-[-0.02em] text-[#f1f1f1]">
          Your account.
        </h1>
        <p className="mb-10 max-w-xl leading-relaxed text-[#b5b5b5]">
          Your profile, plan, and billing. All in one place.
        </p>

        <Suspense fallback={<AccountSkeleton />}>
          <AccountContent />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
