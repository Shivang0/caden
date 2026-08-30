// Shared page footer: mono uppercase columns, legal line, and the giant
// cropped caden wordmark bleeding off the bottom edge. The clipping is
// intentional (design-system/principles.md).

import Link from "next/link";

const columnLink =
  "caden-sweep font-mono text-[12px] uppercase tracking-[0.1em] text-[#8f8f8f] transition-colors hover:text-[#f1f1f1]";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-[#2a2a2a] bg-[#161616]">
      <div className="mx-auto w-full max-w-6xl px-6 pt-14">
        <div className="grid gap-10 sm:grid-cols-3">
          <div className="flex flex-col gap-3">
            <p className="caden-eyebrow">( product )</p>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/#generate" className={columnLink}>
                  Generator
                </Link>
              </li>
              <li>
                <Link href="/connections" className={columnLink}>
                  Connections
                </Link>
              </li>
              <li>
                <Link href="/account" className={columnLink}>
                  Account
                </Link>
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <p className="caden-eyebrow">( account )</p>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/login" className={columnLink}>
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/signup" className={columnLink}>
                  Sign up
                </Link>
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <p className="caden-eyebrow">( the loop )</p>
            <p className="font-mono text-[12px] uppercase leading-relaxed tracking-[0.1em] text-[#8f8f8f]">
              Ship first. It writes itself up.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-[#2a2a2a] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#6d6d6d]">
            &copy; caden inc. | all rights reserved 2026
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#6d6d6d]">
            Built at Hackpack 2026
          </span>
        </div>
      </div>

      {/* Cropped wordmark: bleeds off the bottom on purpose. Do not "fix". */}
      <div
        aria-hidden="true"
        className="pointer-events-none -mb-[0.36em] mt-8 select-none px-2 leading-none"
      >
        <span className="block text-[clamp(110px,22vw,400px)] font-bold leading-none tracking-[-0.04em] text-[#f1f1f1]">
          caden
        </span>
      </div>
    </footer>
  );
}
