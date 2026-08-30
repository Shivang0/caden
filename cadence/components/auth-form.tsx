"use client";

// Shared email/password form for /login and /signup. The two pages differ
// only in fields (name is signup-only), endpoint, and success destination.
// Everything else (labels, errors, loading, ?next= handling) lives here.

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const fieldLabel =
  "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#8f8f8f]";

const fieldInput =
  "w-full rounded-xl border border-[#363636] bg-[#212121] px-3.5 py-2.5 text-sm text-[#f1f1f1] placeholder:text-[#6d6d6d] outline-none transition-colors focus:border-[#f9fe2e]/70";

export interface AuthFormProps {
  mode: "login" | "signup";
}

// Only ever redirect within the app: a `?next=` pointing off-site (or to a
// protocol-relative `//host`) falls back to the default destination.
function safeNext(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

/** Skeleton shown while the Suspense boundary around the form resolves. */
export function AuthFormSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-16 rounded bg-[#212121]" />
        <div className="h-10 rounded-xl bg-[#212121]" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-3 w-20 rounded bg-[#212121]" />
        <div className="h-10 rounded-xl bg-[#212121]" />
      </div>
      <div className="caden-pill h-11 bg-[#212121]" />
    </div>
  );
}

export function AuthForm({ mode }: AuthFormProps) {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);

  const destination = safeNext(nextParam, mode === "login" ? "/" : "/connections");
  const nextQuery = nextParam ? `?next=${encodeURIComponent(nextParam)}` : "";
  const loginHref = `/login${nextQuery}`;
  const signupHref = `/signup${nextQuery}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError(null);
    setEmailTaken(false);
    setLoading(true);

    const endpoint = mode === "login" ? "/portal/api/auth/signin" : "/portal/api/auth/signup";
    const payload: Record<string, string> = { email: email.trim(), password };
    if (mode === "signup" && name.trim()) payload.name = name.trim();

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Full navigation so every session-aware component refetches.
        // Keep `loading` true while the browser navigates away.
        window.location.assign("/portal" + (destination === "/" ? "" : destination));
        return;
      }

      let message =
        mode === "login"
          ? "Could not log you in. Try again."
          : "Could not create your account. Try again.";
      try {
        const body = (await res.json()) as { error?: unknown };
        if (typeof body.error === "string" && body.error.length > 0) {
          message = body.error;
        }
      } catch {
        // Non-JSON error body: keep the fallback message.
      }

      if (mode === "signup" && res.status === 409) {
        setEmailTaken(true);
        message = "That email is already registered.";
      }
      setError(message);
      setLoading(false);
    } catch {
      setError("Network error. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {mode === "signup" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="auth-name" className={fieldLabel}>
            Name{" "}
            <span className="normal-case tracking-normal text-[#6d6d6d]">
              (optional)
            </span>
          </label>
          <input
            id="auth-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            disabled={loading}
            className={fieldInput}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="auth-email" className={fieldLabel}>
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={loading}
          className={fieldInput}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="auth-password" className={fieldLabel}>
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          aria-describedby={mode === "signup" ? "password-hint" : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
          disabled={loading}
          className={fieldInput}
        />
        {mode === "signup" && (
          <p id="password-hint" className="text-xs leading-relaxed text-[#6d6d6d]">
            At least 8 characters.
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#ff7a6e]/40 bg-[#ff7a6e]/10 px-4 py-3"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#ff7a6e]">
            {mode === "login" ? "( login failed )" : "( signup failed )"}
          </p>
          <p className="mt-1.5 break-words text-sm leading-relaxed text-[#f1f1f1]/85">
            {error}
            {emailTaken && (
              <>
                {" "}
                <Link
                  href={loginHref}
                  className="font-medium text-[#f1f1f1] underline underline-offset-2 hover:text-[#f9fe2e]"
                >
                  Log in instead
                </Link>
                .
              </>
            )}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="caden-pill group relative mt-1 inline-flex w-full items-center justify-center gap-2 bg-[#f9fe2e] px-5 py-3 text-sm font-medium text-[#161616] transition-[background-color,transform] duration-200 hover:scale-[1.02] hover:bg-[#ffe042] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {loading ? (
          <>
            <span className="caden-spinner inline-block h-4 w-4 rounded-full border-2 border-[#161616]/30 border-t-[#161616]" />
            {mode === "login" ? "Logging in…" : "Creating account…"}
          </>
        ) : (
          <>
            {mode === "login" ? "Log in" : "Create account"}
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

      <p className="text-center text-sm text-[#b5b5b5]">
        {mode === "login" ? (
          <>
            New to caden?{" "}
            <Link
              href={signupHref}
              className="font-medium text-[#f9fe2e] transition-colors hover:text-[#ffe042]"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href={loginHref}
              className="font-medium text-[#f9fe2e] transition-colors hover:text-[#ffe042]"
            >
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
