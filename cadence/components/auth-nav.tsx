"use client";

// Session-aware nav controls for the home page header.
// Logged out: Log in + Sign up. Logged in: email + Account link.

import { useEffect, useState } from "react";
import Link from "next/link";

import type { SessionUser } from "@/lib/types";

const quietLink =
  "caden-sweep px-1 py-1.5 font-mono text-[12px] uppercase tracking-[0.1em] text-[#8f8f8f] transition-colors hover:text-[#f1f1f1]";

const ctaLink =
  "caden-pill bg-[#f9fe2e] px-4 py-1.5 text-sm font-medium text-[#161616] transition-[background-color,transform] duration-200 hover:scale-[1.04] hover:bg-[#ffe042]";

export function AuthNav() {
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/portal/api/auth/session");
        if (!res.ok) throw new Error("session unavailable");
        const data = (await res.json()) as { user: SessionUser | null };
        if (active) setUser(data.user);
      } catch {
        // Treat an unreachable session endpoint as logged out.
      } finally {
        if (active) setLoaded(true);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) {
    return (
      <span
        className="caden-pill h-8 w-28 animate-pulse bg-[#212121]"
        aria-hidden="true"
      />
    );
  }

  if (user) {
    return (
      <>
        <span
          className="hidden max-w-[180px] truncate font-mono text-[12px] text-[#8f8f8f] sm:block"
          title={user.email}
        >
          {user.email}
        </span>
        <Link href="/account" className={ctaLink}>
          Account
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className={quietLink}>
        Log in
      </Link>
      <Link href="/signup" className={ctaLink}>
        Sign up
      </Link>
    </>
  );
}
