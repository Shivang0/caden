import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// caden's real type: TT Interphases Pro (display + body) and its Mono (labels,
// digits). Files staged in app/fonts/ from the design-system inventory.
const interphases = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "./fonts/TTInterphases-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/TTInterphases-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/TTInterphases-Bold.woff2", weight: "700", style: "normal" },
  ],
});

const interphasesMono = localFont({
  variable: "--font-mono",
  display: "swap",
  src: [{ path: "./fonts/TTInterphasesMono.woff2", weight: "100 900", style: "normal" }],
});

export const metadata: Metadata = {
  title: "caden. Ship the work. Send the update.",
  description:
    "caden turns your real GitHub activity into your investor update, build-in-public posts, and a changelog. Grounded in real diffs, not vibes.",
};

export const viewport: Viewport = {
  themeColor: "#1a1a1a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${interphases.variable} ${interphasesMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#1a1a1a] text-[#f1f1f1]">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
