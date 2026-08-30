# r/alphaandbetausers

**Mod-review verdict:** revised

**Promo policy (verified):** Direct promo post OK. This sub exists for beta recruitment; direct signup links in the post body are welcome. Include stage tag in title, a real description, and a specific feedback ask. Limit: one post for this product per month, so this post should be the good one.

**Rules summary:** Could not fetch the live rules.json (Reddit serves a login wall to unauthenticated JSON requests from this environment; www, old.reddit, and api.reddit all blocked). Verified via WebSearch and a directory mirror of the sub's rules instead: self-promotion is the stated purpose of the subreddit, and founders are expected to post their product with a clear description and a call for testers. Conventions per the mirrored rules: tag/flair the post [Beta] or [Alpha] to show stage, explain what the product does, who it is for, what platforms it supports, and what feedback you want, and do not post the same product more than about once a month. No karma or account-age requirement was listed.

---

## Title (paste-ready)

[Beta] Caden: writes your investor update from your merged PRs and Stripe metrics. No-signup demo, blunt feedback wanted

## Body (paste-ready)

**What it is**

Caden writes your investor update and your build-in-public posts from what you actually shipped. Connect your accounts (GitHub, Linear, Notion, Figma, Vercel, Stripe, Google, LinkedIn), pick a date range, and it reads your merged PRs, commits, and live Stripe metrics (MRR, customer count). From that same data it writes four things: an investor update, a LinkedIn post, an X thread, and a changelog. Every claim in the investor update links back to a real diff, so you can check it is not inventing progress.

Web app, nothing to install. Built for founders who ship all week and then put off writing the update.

Other things it does:

- **Org mode**: give it a GitHub org name and it scans up to 5 active repos and writes one combined update.
- **Autopilot**: on load it prefills your founder name, repos pushed in the last 7 days, and your Stripe metrics. Everything stays editable.
- **Voice + video**: record 20 seconds of your voice, it clones it, then generates a casual handheld selfie-style founder video (your photo, a 45-70 word spoken script, image-to-video model on a rented H200, cloned voice muxed in with ffmpeg). Deliberately anti-cinematic. It is supposed to look like a phone video, not an AI ad.
- **One-click publish to LinkedIn**, with an arm-then-confirm step so nothing posts by accident.

**Status**

Built this weekend at a hackathon, so it is days old. Free while in beta. There are rough edges and I list them below instead of pretending otherwise. The bug list is short enough that I still read every report myself.

**Try it**

- Instant demo, no signup: https://cadenhq.vercel.app
- Full app with account connections: https://cadenhq.vercel.app/portal

**Feedback I actually want**

1. Would you trust an auto-written investor update enough to send it, or does it always need a "human wrote this" pass first?
2. If you run multiple repos: is the org-mode combined update readable, or does it blur into mush?
3. Does the diff-linking (every claim links to a real PR) actually matter to you, or is it noise?
4. The founder video: does it pass as a normal phone video, or does it hit uncanny valley?
5. Which missing integration would be a dealbreaker for you?

**Known rough edges**

- LinkedIn OAuth fought me for hours during the build (stale client secret returning invalid_client). Fixed, but tell me if connect fails for you.
- The voice API sometimes returns 402 on the video path, so a GPU-worker fallback handles it. Slower, but it works.
- My LLM provider quota ran out mid-hackathon and everything fell back to a backup model, so generation quality may wobble this week.
- /portal with a trailing slash 404'd through a Vercel rewrite for a while. Should be fixed. Should.

I will be in the comments all day. Blunt beats polite.

---

## Extras

Optional first comment from Shivang (post it yourself right after publishing): "Tech notes: the video pipeline is an image-to-video model on a rented H200 with a cloned voice track muxed in via ffmpeg. Weirdest bug of the weekend was a stale LinkedIn OAuth client secret returning invalid_client for hours while everything else in the flow was correct. Happy to go deeper on any of it."

---

## Posting notes

Pick the [Beta] flair if the sub offers flair; the [Beta] tag is already in the title as a fallback. Best time: weekday morning US (roughly 9-11am ET) when founder subs get the most traffic. In comments: answer every tester within a few hours, and when someone reports a bug, reply with what you did about it, that is the whole credibility play on this sub. Do not repost Caden here for at least a month. Risk: rules were verified via search and a mirror, not the live sidebar (Reddit blocked unauthenticated fetches), so take 30 seconds to skim the actual sidebar rules before hitting post; if the sub requires a specific flair name or title format that differs, adjust the tag only, not the body.

## What the reviewer fixed/flagged

- Live rules.json unreachable from this environment (www.reddit.com, old.reddit.com, api.reddit.com all blocked), matching the drafter's report. Verified instead via the AllDirectories mirror and web search: self-promotion is the sub's purpose, [Beta]/[Alpha] tag required, one post per product per month, no karma or account-age requirement. Drafter's promo policy claim is correct.
- Rules gap: the sub's content requirements include stating which platforms the product supports; the draft never says it is a web app. Added a one-line platform statement.
- Title ad smell: three stacked promo clauses ('Free beta, instant demo, want blunt feedback') read like ad copy. Trimmed to one useful hook plus the feedback ask.
- Landing-page copy in the opener: 'founder autopilot' and 'one source of truth' are pitch-deck phrases. Replaced with plain description; no facts changed.
- 'What testers get' is a growth-hack template header, and 'free access to everything' is redundant with a free beta. Folded its real content (free while in beta, I read every bug report) into Status and removed the header.
- Extras: 'helps seed discussion' framing in the self-comment instruction reads astroturfy; removed the framing, kept the comment.
- Fact check clean: every product claim traces to the fact sheet, no invented users, revenue, or numbers.
- Slop scan clean: zero em-dashes and zero banned phrases in the original and in the revision.

## Reviewer notes

Rules verification: could not fetch the live rules.json (Reddit blocks unauthenticated fetches from this environment on www, old, and api hosts). Cross-checked via alldirectories.org mirror and web search; both confirm the drafter's summary: self-promotion is the subreddit's purpose, [Beta]/[Alpha] title tag required, posts must state what the product does, who it is for, platforms, and feedback wanted, limit one post per product per month, no karma or account-age requirement. As a mod I would leave the revised version up. Changes were light: added the missing platform line (a stated content requirement), de-ad-ified the title, replaced 'founder autopilot' and 'one source of truth' with plain language, removed the 'What testers get' template header, and stripped the 'seed discussion' framing from the extras. All product claims trace to the fact sheet; the only non-fact-sheet lines are the poster's own commitments (reads every bug report, will be in comments), which are not product or metric claims. No em-dashes or banned phrases anywhere in the final text. Reminder for the poster: this counts as the one post for this product this month.
