// Shared sticky page header: the caden pill nav.
// Right-side controls are passed as children so each page stays in charge
// of its own links.

import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6 sm:pt-4">
      <nav className="caden-pill mx-auto flex h-14 w-full max-w-6xl items-center justify-between border border-[#363636]/70 bg-[#161616]/75 px-5 backdrop-blur-md sm:px-6">
        <a
          href="/"
          className="caden-pill flex items-center text-xl font-bold leading-none tracking-[-0.03em] text-[#f1f1f1]"
        >
          caden
          <span className="caden-cursor" aria-hidden="true" />
        </a>
        <div className="flex items-center gap-2 sm:gap-4">{children}</div>
      </nav>
    </header>
  );
}
