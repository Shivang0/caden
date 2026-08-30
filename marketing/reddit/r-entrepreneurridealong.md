# r/EntrepreneurRideAlong

**Mod-review verdict:** revised

**Promo policy (verified):** Direct post OK, in value-post form. A text post that leads with the founder story and honest numbers, with the link included in the body, is the native format here (the sub exists for ride-along build documentation). A bare launch/link post is not possible (no link posts) and a promo-only text post risks discretionary removal.

**Rules summary:** The subreddit has three official rules as of today: Be Respectful and Kind (no harassment or personal attacks), Follow Reddit's Global Rules, and Engage with Good Intent. Formatting-wise it is text posts only, link posts are not allowed, and no flair is required. There is no explicit written self-promotion ban, but moderators remove pure promo at their discretion and Reddit's sitewide spam filter still applies, so a story-first post that mentions the product inside the text is the accepted form. Roughly 97% of sampled posts survive, with most removals being civility related.

---

## Title (paste-ready)

Day 0 ride along: launched my investor update autopilot today. Current users: zero

## Body (paste-ready)

Starting a ride along at the least impressive possible moment: launched today, nobody has used it.

**The numbers**

- Users: 0
- Revenue: $0
- Age of product: built this weekend at a hackathon, went live today
- Rough edges: many

**Why I built it**

I hate writing investor updates. Not the metrics part, the archaeology part. Scrolling back through merged PRs, Linear tickets, and Stripe, trying to reconstruct what actually happened over the last month. So the update slips a week. Then two. And a late update reads like bad news even when the month was fine. Silence is the worst signal you can send someone who wired you money.

Build-in-public content has the same problem. The work already happened. Writing it up four different ways (investor email, LinkedIn post, X thread, changelog) is a tax on the same information.

**What I built**

It is called Caden. You connect your accounts (GitHub, Linear, Notion, Figma, Vercel, Stripe, Google, LinkedIn) and pick a date range. It reads your merged PRs, commits, and live Stripe metrics (MRR, customer count), then writes four things from that one pile of evidence: an investor update, a LinkedIn post, an X thread, and a changelog. Every claim in the update links back to a real diff, so an investor can click through and check it is not making things up.

Other bits: point it at a GitHub org name and it scans up to 5 active repos and writes one combined update. On load it prefills your name, repos pushed in the last 7 days, and Stripe numbers, all editable. One-click publish to LinkedIn sits behind an arm-then-confirm step so nothing posts by accident.

The weird one: record 20 seconds of your voice, it clones it and generates a handheld selfie-style founder video. Deliberately anti-cinematic. It is supposed to look like a phone video, not an AI ad.

**What launch day actually looked like**

A stale LinkedIn OAuth client secret threw invalid_client for hours. A trailing slash on /portal/ 404ed through a Vercel rewrite. Our LLM provider quota ran out mid-hackathon and everything fell back to a backup model. The voice API started returning 402 on the video path, so a GPU worker fallback handles that now. Glamorous stuff.

**Three things I want opinions on**

1. Would you trust an auto-drafted investor update, or is hand-writing it part of the signal you send investors?
2. If you run multiple repos or products: is one combined org-level update readable and useful, or do investors want per-product detail?
3. Is the selfie-style founder video a real distribution edge or a gimmick I should cut?

If you want to break it: cadenhq.vercel.app is an instant demo, no signup. /portal on the same domain is the full app with account connections. Free beta. It will fail somewhere and I want to know where.

I will post updates here as the numbers move, or as they refuse to. Day 0: zero users, tired.

---

## Extras

Do NOT pre-schedule or pre-post any comment. Only if someone actually asks how the video feature works, reply to their comment from the same account with: "It takes your photo plus a 45-70 word script, runs an image-to-video model on a rented H200, then muxes the cloned voice track in with ffmpeg. The hard part was making it look worse on purpose. Handheld, casual, like you filmed it walking out of a coffee shop. Polished AI video reads as an ad and people scroll past it."

---

## Posting notes

Flair: none required and none exists for this sub, post as a plain text post (link posts are disabled, so do not use the link post type). Timing: best observed windows are Thursday around 8pm UTC (strongest) and Wednesday around 2am UTC; if posting today (Friday), morning US Eastern is fine, or hold until next Wednesday/Thursday window if a day's delay is acceptable. Comments: reply to every comment within the first 2 hours, answer the three feedback questions people engage with, and do not re-paste the link in replies unless someone asks for it directly. Risk: no explicit promo ban, but mods remove promo at discretion and the sitewide spam filter can eat posts from accounts with low karma; the link is written as plain text (not markdown hyperlink) to reduce spam-filter risk, keep it that way. If the post is removed, message the mods politely and offer to strip the URLs, the story stands without them. Follow through on the "I will post updates here" promise, a Day 7 or Day 30 numbers post is the highest-value follow-up in this sub.

## What the reviewer fixed/flagged

- RULES (verified live via rules.json in a real browser; curl and WebFetch were blocked by Reddit): exactly three rules confirmed: Be Respectful and Kind, Follow Reddit's Global Rules, Engage with Good Intent. No written self-promotion or link rule. Drafter's summary and promo policy claim are accurate; a story-first text post with the link in the body is the compliant form. No rule violation in the draft.
- SPAM TELL: 'Long-time lurker' is the single most common astroturf opener; mods pattern-match on it instantly. Removed.
- SPAM TELL: 'This sub is built on people documenting a business from day 0' and 'since this sub respects honesty' explain and flatter the sub to itself, which is what marketers do and regulars never do. Removed.
- AD COPY: 'Founder autopilot for investor updates and build-in-public content.' is the landing-page tagline pasted verbatim as a sentence fragment. Rewrote as plain description of what it does.
- AD COPY: the eight-bullet feature list reads like a pricing page. Compressed to prose, kept the two genuinely interesting details (verifiable diff links, anti-cinematic video) prominent.
- SPAM TELL: 'Not asking anyone to sign up' immediately followed by two URLs and 'Free beta' is the classic fake-disclaimer pattern. Replaced with a plain 'if you want to break it' link paragraph and reduced the second URL to '/portal on the same domain'.
- EXTRAS / ENGAGEMENT SEEDING: pre-scheduling a self-comment 'post 5-10 minutes after the thread goes live' that opens with 'since someone will ask' is manufactured engagement; if a mod notices the pattern the account gets flagged. Changed to reply-only-if-actually-asked, kept the technical content, which is good.
- FACTS: every product claim checked against the fact sheet and matches (integrations list, four artifacts, diff links, org mode 5 repos, prefill, 20-second voice clone, H200/ffmpeg pipeline, arm-then-confirm, both URLs, all four war stories). Users: 0 and Revenue: $0 are the honest floor, not invented traction. No violations.
- SLOP: zero em-dashes and zero banned phrases in the original; kept it that way in the revision. Cut 'genuinely' (hedge-fluff) and 'some texture' (writerly filler).

## Reviewer notes

Verified the live rules by loading https://www.reddit.com/r/EntrepreneurRideAlong/about/rules.json in a Playwright browser (Reddit 403s curl and WebFetch). The sub has only the three civility-style rules the drafter described, plus sitewide spam policy, so the story-first text post with in-body links is the correct compliant form; no do_not_post needed. The draft's facts all check out against the fact sheet and it contains no em-dashes or banned phrases. What earned the revision: astroturf tells (the 'long-time lurker' opener, flattering the sub to itself, the 'not asking anyone to sign up' disclaimer directly above two links), the verbatim marketing tagline, a landing-page-shaped feature bullet list, and a pre-scheduled 'since someone will ask' self-comment in the extras, which is manufactured engagement a mod would hold against the account. The revision keeps the strongest material untouched: the zero-numbers table, the launch-day war stories, the three specific questions, and the tired sign-off.
