"use client";

// /signup: create an account. Lands on /connections (or ?next=) afterwards.

import { Suspense } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { AuthForm, AuthFormSkeleton } from "@/components/auth-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#1a1a1a] font-sans text-[#f1f1f1]">
      <SiteHeader>
        <Link
          href="/login"
          className="caden-pill border border-[#363636] px-4 py-1.5 text-sm font-medium text-[#f1f1f1] transition-colors hover:border-[#676767]"
        >
          Log in
        </Link>
      </SiteHeader>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-14 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <p className="caden-eyebrow mb-4">( get started )</p>
          <h1 className="mb-3 text-5xl font-medium leading-[1.02] tracking-[-0.02em] text-[#f1f1f1]">
            Create your account.
          </h1>
          <p className="mb-8 leading-relaxed text-[#b5b5b5]">
            Free to start. Connect your tools and generate your first update
            in about a minute.
          </p>

          <div className="rounded-2xl border border-[#2a2a2a] bg-[#161616] p-6 sm:p-8">
            <Suspense fallback={<AuthFormSkeleton />}>
              <AuthForm mode="signup" />
            </Suspense>
          </div>
        </motion.div>
      </main>

      <SiteFooter />
    </div>
  );
}
