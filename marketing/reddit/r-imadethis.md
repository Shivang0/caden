# r/IMadeThis

**Mod-review verdict:** revised

**Promo policy (verified):** Direct promo post OK. Show-and-tell with a direct link is literally the purpose of the sub. Only constraint is Reddit's sitewide spam rule, so post from Shivang's real personal account (not promo-only) and engage in comments.

**Rules summary:** Fetched live via the subreddit's rules.json (through a browser session, since Reddit 403s plain fetches): r/IMadeThis has ZERO custom subreddit rules, only Reddit sitewide rules apply (spam, personal info, threats). The sidebar explicitly invites self-promo: "Reddit is full of talented, creative people. This is a place for them to show off a little... Go on Reddit, brag a little." Submission type is "any" (text, link, image all allowed) and link flair is disabled, so there is no flair to pick. ~41k subscribers.

---

## Title (paste-ready)

I made a tool that reads my commits and Stripe metrics and writes my investor update, changelog, LinkedIn post, and X thread

## Body (paste-ready)

I got tired of writing investor updates. Every month I'd dig through merged PRs, check Stripe, and try to reconstruct what actually shipped. So this weekend at a hackathon I built Caden.

You connect GitHub and Stripe (plus Linear, Notion, Figma, Vercel and a few others if you use them), pick a date range, and it writes four things: an investor update, a changelog, a LinkedIn post, and an X thread. Every claim in the investor update links back to a real diff, so you can click through and check it instead of taking the model's word for it.

Bits I'm weirdly proud of:

- Autopilot: on load it prefills your name, the repos you pushed to in the last 7 days, and your Stripe MRR and customer count. Everything stays editable.
- Org mode: give it a GitHub org name and it scans up to 5 active repos and writes one combined update.
- The cursed part: record 20 seconds of your voice, it clones it, then generates a handheld selfie-style founder video from your photo on a rented H200 GPU and muxes the cloned voice in with ffmpeg. Deliberately shaky and casual, so it looks like a phone video and not an AI ad.
- One-click publish to LinkedIn, with an arm-then-confirm step so nothing posts by accident.

What broke while building it: a stale LinkedIn OAuth client secret threw invalid_client for hours, my LLM quota ran out mid-hackathon so everything fell back to a backup model, and the voice API started returning 402 on the video path so a GPU worker fallback handles that now.

It's days old, free while in beta, and rough in places. The demo needs no signup: https://cadenhq.vercel.app (full app with account connections at https://cadenhq.vercel.app/portal).

Two things I actually want opinions on:

1. Would you trust an auto-written investor update if every claim links to a diff, or is that still too spooky to send to real investors?
2. Does the org-mode combined update read well, or does it smear 5 repos into mush?

The screenshot is the four artifacts it generated from my own repo this week.

---

## Extras

MAKER COMMENT (use as first comment only if posting as an image post without body text, otherwise skip):

Maker here. Built this at a hackathon this weekend because I hated writing investor updates by hand. Connect GitHub and Stripe, pick a date range, and it writes an investor update, changelog, LinkedIn post, and X thread from your merged PRs and live MRR. Every claim links back to a real diff so you can check it yourself. There's also a mode that clones your voice from a 20 second sample and generates a handheld selfie-style founder video on a rented H200, voice muxed in with ffmpeg. Days-old free beta, rough edges, no signup for the demo: https://cadenhq.vercel.app. Two questions: would you trust an auto-written investor update if every claim links to a diff? And is the org-mode combined update (one update across up to 5 repos) actually readable?

IMAGE SUGGESTIONS, in order of preference:
1. Composite screenshot: the four generated artifacts side by side in a 2x2 or 1x4 grid, ideally with one visible diff-link callout so the "every claim links to a diff" point lands visually.
2. GIF: page load, autopilot prefills founder name, last-7-days repos, and Stripe MRR/customer count, user hits generate, four artifacts appear.
3. If neither is ready: a single clean screenshot of the investor update with a diff link visible.

---

## Posting notes

No flair exists to pick (link flair is disabled). Recommended image: one composite screenshot of the four generated artifacts side by side (investor update, changelog, LinkedIn post, X thread) generated from Caden's own repo; second choice is a short GIF of the autopilot prefill filling in name, repos, and Stripe metrics on page load. If Reddit's composer for an image post does not allow body text, post the image with the title and paste the body as an immediate first comment (a ready-to-paste maker comment is in extras). Best window: weekday morning US time (9-11am ET). In comments: answer every reply, and spend 10 minutes upvoting/commenting on 2-3 other maker posts in the sub so the account is not promo-only (that is the only real rule in play, Reddit's sitewide spam policy). Risk is low; do not crosspost the identical text to sister subs the same day.

## What the reviewer fixed/flagged

- Rules could not be re-verified live: reddit.com 403s WebFetch/curl/api.reddit.com/jina proxy, and browser navigation permission was denied in this session. Drafter's rules summary (zero custom rules, sidebar invites self-promo, sitewide spam rule only) matches known r/IMadeThis facts, so the direct-promo form is treated as allowed. If you want hard proof, open rules.json in your own browser before posting.
- Fact error: draft said 'last weekend' and 'weekend-old'; fact sheet says built this weekend at a hackathon and days old. Fixed in body and maker comment.
- Overclaim: 'it cannot quietly make things up' is stronger than what diff links guarantee (a model can still mischaracterize a diff it links to). Rewritten as 'click through and check it instead of taking the model's word for it'.
- Startup-speak: 'one source of truth' appeared in both body and maker comment. Removed both.
- AI tell: the entire draft avoided contractions, which reads stilted and machine-written. Contractions added throughout.
- Minor hedge-fluff: 'Two things I would genuinely like opinions on' tightened to 'Two things I actually want opinions on'.
- Clean on the hard checks: no em-dashes, no banned phrases, no invented users/revenue numbers, both URLs match the fact sheet.

## Reviewer notes

Live rules verification failed on every route available in this session (Reddit 403s server-side fetches; browser navigation was permission-denied), so the promo-policy call rests on the drafter's fetched rules.json plus known sub facts, which agree: no custom rules, sidebar explicitly invites showing off, submission type "any", flair disabled. Under sitewide spam rules the post is fine as long as it goes out from Shivang's real personal account and he answers comments. Post as a text post with the screenshot attached if the sub UI allows both; use the maker comment only in the image-post fallback. Kept both URLs since /portal is informative, same domain, and the sub allows direct links. The two closing questions are the best spam repellent in the post; do not cut them in future edits.
