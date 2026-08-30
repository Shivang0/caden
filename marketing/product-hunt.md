# Product Hunt

**Mod-review verdict:** revised

**Promo policy (verified):** Direct promo post OK. This is the one channel where self-promotion is the entire point. Constraints: personal account only, self-hunt is fine, never ask anyone to upvote (ask them to visit and leave a comment instead), launch at 12:01 am PT for a full 24-hour window.

**Rules summary:** Fetched live from producthunt.com/launch: launching your own product is exactly what the platform is for and is 100% free. You must post from a personal account (company accounts are prohibited), and hunting your own product is fine ("no discernible advantage to using a third-party hunter"). Direct upvote solicitation is banned; you may ask people to "visit and comment" instead. Recommended start time is 12:01 am Pacific, but "the best day to launch is the day on which you're most prepared."

---

## Title (paste-ready)

Caden

## Body (paste-ready)

TAGLINE (58/60 chars):
Turn your merged PRs and Stripe data into investor updates

DESCRIPTION (259/260 chars):
Connect GitHub, Stripe, Linear and more. Pick a date range. Caden reads merged PRs and live MRR, then writes an investor update, a LinkedIn post, an X thread, and a changelog from one source of truth. Every claim in the update links to a real diff. Free beta.

LINKS:
Website: https://cadenhq.vercel.app (instant demo, no signup)
Full app: https://cadenhq.vercel.app/portal

MAKER FIRST COMMENT (post immediately after launch goes live):

Hey Product Hunt, Shivang here.

I built Caden this weekend at a hackathon, on not much sleep, so fair warning up front: it is days old and has rough edges.

The itch: every investor update I write is me re-deriving things my tools already know. GitHub knows what shipped. Stripe knows MRR and customer count. So Caden connects your accounts (GitHub, Linear, Notion, Figma, Vercel, Stripe, Google, LinkedIn), you pick a date range, and it writes four artifacts from one source of truth: an investor update, a LinkedIn post, an X thread, and a changelog. Every claim in the update links back to a real diff, so you can audit what it says before you send it.

Other bits:
- Org mode: point it at a GitHub org name and it scans up to 5 active repos and writes one combined update.
- Autopilot: on load it prefills your founder name, repos pushed in the last 7 days, and your Stripe metrics. Everything stays editable.
- Voice + video: record 20 seconds of your voice, it clones it, then generates a handheld selfie-style founder video (your photo, a 45-70 word spoken script, image-to-video on a rented H200). Deliberately anti-cinematic. It should look like a phone video, not an AI ad.
- One-click publish to LinkedIn, with an arm-then-confirm step so nothing posts by accident.

War stories from the weekend: a stale LinkedIn OAuth client secret threw invalid_client for hours. A trailing slash on /portal/ 404'd through a Vercel rewrite. Our LLM quota ran out mid-hackathon and everything fell back to a backup model. The voice API returned 402 on the video path, so a GPU-worker fallback handles that now. And muxing a cloned voice track into image-to-video output with ffmpeg was my strangest 2am this year.

You can try it with zero signup at cadenhq.vercel.app. The full app with account connections is at /portal.

What I actually want feedback on:
1. Would you trust an auto-written investor update enough to send it? If not, what is missing?
2. Is the org-mode combined update readable, or does 5 repos in one update turn to mush?
3. Is the selfie-style video useful, or just uncanny?

It is a free beta. No pricing, no growth numbers, it barely existed 48 hours ago. Honest comments beat anything else you could give me today.

---

## Extras

TOPIC TAGS (pick 4-6, all are real PH topics):
1. Artificial Intelligence
2. Developer Tools
3. SaaS
4. Productivity
5. GitHub
6. Marketing

GALLERY IMAGE SUGGESTIONS (PH recommends 1270x760 px, first image is the thumbnail-adjacent hero):
1. Hero: the four output tabs (investor update, LinkedIn post, X thread, changelog) generated from one date range, with the investor update in front and one sentence highlighted showing its link back to a real GitHub diff. Caption: "One source of truth, four artifacts. Every claim in the update links to a diff."
2. Org mode: a GitHub org name typed in, 5 active repos detected, and the single combined update it produced. Caption: "Point it at your org. It reads up to 5 active repos."
3. Voice + video: the 20-second voice recording UI next to a still frame from the generated selfie-style founder video. Caption: "20 seconds of your voice becomes a handheld founder video. Phone video, not AI ad."

If a fourth slot is wanted: the arm-then-confirm LinkedIn publish step, captioned "Nothing posts by accident."

POSTING CONSTRAINTS (verified live against producthunt.com/launch on 2026-08-29): post from Shivang's personal account (company accounts prohibited), self-hunt the launch (no advantage to a third-party hunter), never ask anyone to upvote (asking people to visit and comment is the allowed form), launch at 12:01 am Pacific for the full 24-hour window, or on whatever day you are most prepared.

---

## Posting notes

No flair system on PH; instead pick the 4-6 topics listed in extras. Hunt it yourself from Shivang's personal account (rules say company accounts are prohibited and third-party hunters give no advantage). Launch at 12:01 am PT to get the full 24-hour window. Timing tradeoff: Sunday Aug 30 matches the hackathon deadline and has thin competition, so ranking top 10 takes fewer votes, but total traffic and press attention are low; Tuesday-Thursday gets the most eyeballs but the toughest leaderboard. Recommendation: if the goal is a live PH page for the hackathon demo, launch Sunday 12:01 am PT; if the goal is maximum beta signups, wait for Tuesday Sep 1. Do not ask anyone to upvote anywhere (DMs, X, LinkedIn); ask them to visit and comment, which the rules explicitly endorse. Post the maker comment within minutes of going live and reply to every comment personally in the first 4-6 hours, ideally referencing the three feedback questions. Risk: the voice-clone video will draw deepfake questions in comments; have a plain answer ready (it only clones your own voice, from your own 20-second recording, for your own video).

## What the reviewer fixed/flagged

- Description factual overreach: 'Every claim links to a real diff' implied all four artifacts are diff-linked; the fact sheet only supports this for the investor update. Rewrote to 'Every claim in the update links to a real diff' and trimmed elsewhere to fit (259/260 chars).
- 'War stories from the weekend, since this crowd appreciates them' is audience-flattery filler that reads as engineered casualness; cut the clause, kept the war stories.
- Gallery caption 3 used an 'X → Y' arrow construction, a recognizable AI-slop pattern; replaced with plain words.
- Rules verified against the live producthunt.com/launch page: drafter's promo policy claim is accurate (free, personal account only, self-hunting fine, upvote solicitation banned, visit-and-comment allowed, 12:01 am PT recommended). The maker comment already complies: it asks for honest comments and never for upvotes. No changes needed on compliance.
- Checked and passed: zero em-dashes or en-dashes, zero banned phrases (grep-verified), no invented numbers/users/revenue, all war stories and specs match the fact sheet, tagline 58/60.

## Reviewer notes

Verdict is revised, not pass, for three small fixes: (1) the description claimed every claim in all four artifacts links to a diff, but the fact sheet only supports diff-linking for the investor update, so the description was tightened to match (now 259/260 chars); (2) removed the pandering clause 'since this crowd appreciates them'; (3) replaced the arrow construction in gallery caption 3 with plain words, and aligned the hero caption with the corrected diff-link claim. Compliance verified against the live rules page via WebFetch: the drafter's promo policy claim was accurate and the maker comment already followed it (asks for comments, never upvotes). Grep confirmed zero em-dashes/en-dashes and zero banned phrases. Every remaining claim traces to the fact sheet; no invented numbers, users, or revenue. As a mod I would leave the revised version up: it is a real free product with a no-signup demo, specific verifiable technical detail, and the sanctioned form of engagement ask.
