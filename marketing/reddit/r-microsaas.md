# r/microsaas

**Mod-review verdict:** revised

**Promo policy (verified):** Direct post OK, but only as a value post: backstory + tech stack + honest insight, product named sparingly. A bare launch/link post would be removed as low-effort self-promo. This learnings-post format is exactly the allowed form, so no adaptation to a weekly thread was needed. Name the product once in the body with one link, keep all conversation in public comments, never ask anyone to DM.

**Rules summary:** The live rules.json is blocked for unauthenticated clients (Reddit 403), so rules were verified via a current third-party rules tracker for r/microsaas (~28K members, 6 published rules). Self-promotion is explicitly allowed when the post adds value: backstory, tech stack, and real insights are expected. Context-free promotional links and repetitive posting are removed, DM solicitation ("DM me") is banned and conversations must stay public, and black-hat tactics (fake reviews, scraped-email spam, astroturfing) are banned. There is no karma requirement; the bar is content depth.

---

## Title (paste-ready)

Built a micro SaaS in one weekend with AI tooling: 8 OAuth providers, a GPU worker, and what I would cut next time

## Body (paste-ready)

This weekend I ran an experiment at a hackathon: how much of a real micro SaaS can one person ship in a weekend if AI coding tools handle most of the glue. Not a landing page with a waitlist. A working product with 8 OAuth integrations, live Stripe data, and a GPU video pipeline.

Here's the stack and the honest ledger of what I'd keep and what I'd cut, because most "built in a weekend" posts skip the part where everything caught fire.

**What I built**

A founder autopilot for investor updates and build-in-public content. Connect your accounts (GitHub, Linear, Notion, Figma, Vercel, Stripe, Google, LinkedIn), pick a date range, and it reads your merged PRs, commits, and live Stripe metrics (MRR, customer count), then writes four artifacts from one source of truth: an investor update, a LinkedIn post, an X thread, and a changelog. Every claim in the update links back to a real diff. On load it prefills your name, the repos you pushed to in the last 7 days, and your Stripe numbers, and everything stays editable. There's also an org mode: point it at a GitHub org name and it scans up to 5 active repos and writes one combined update.

It's called Caden and it's live at https://cadenhq.vercel.app. The demo needs no signup. Free beta, days old, rough edges everywhere. That's the only link in this post; the rest is the build.

**The stack**

- Vercel for the app
- 8 OAuth providers, each with its own console, its own redirect rules, and its own opinions about scopes
- A GPU worker on a rented H200 for the video path: your photo plus a 45 to 70 word spoken script through an image-to-video model, your cloned voice muxed in with ffmpeg
- One-click LinkedIn publish behind an arm-then-confirm step so nothing posts by accident

**What actually broke**

1. A stale LinkedIn OAuth client secret. invalid_client for hours. The fix itself was trivial; finding it was the whole cost, because invalid_client tells you nothing about which credential-shaped thing is stale.
2. A trailing slash. /portal worked, /portal/ 404'd through a Vercel rewrite. I don't want to admit how long that one took.
3. LLM provider quota ran out mid-hackathon. Everything fell back to a backup model. That fallback existed because I was paranoid, not because I was smart.
4. The voice API started returning 402 on the video path, so a GPU-worker fallback handles that leg now.

**What I'd keep**

- AI tooling for scaffolding, OAuth glue, and ffmpeg incantations. It wrote most of the code that didn't break.
- A fallback behind every external API. Two of the four fires above were survivable only because of this.
- Arm-then-confirm on anything that publishes on a user's behalf. Auto-posting to someone's LinkedIn without a second confirmation is how you lose trust permanently.
- The "every claim links to a diff" constraint. It shaped the whole product, and it's the only reason an auto-written investor update isn't instantly worthless.

**What I'd cut**

- Six of the eight OAuth providers on day one. GitHub plus Stripe is most of the value. The other six each cost a console setup, a token refresh path, and a distinct failure mode, and I doubt anyone trying a demo ever clicks them.
- Probably the founder video feature from weekend scope. It works: record 20 seconds of your voice, it clones it, then generates a deliberately anti-cinematic selfie-style clip that looks like a phone video, not an AI ad. But it ate the GPU budget and produced two of the four fires above. Ship the boring text pipeline first, add the flashy thing in week two.

**Where I want to be wrong**

- Would you trust an auto-written investor update, even with every line linked to a real diff? And if you would, is that a standalone micro SaaS people pay for, or a feature GitHub or Stripe ships eventually?
- If you try the demo: is the org-mode combined update readable, or does 5 repos in one update turn into mush?
- Anyone who has shipped many OAuth providers: is there a sane way to manage 8 sets of client secrets across environments, or is the pain just the tax?

Happy to answer anything about the stack in the comments. It's a hackathon beta, so if you break it, telling me how is the most useful thing you can do.

---

## Extras

Suggested first comment from Shivang (post right after submitting):

"If you want the full version with account connections instead of the instant demo, it's the /portal path on the same site. Same beta, same rough edges. If the org-mode combined update comes out unreadable for your repos, post a screenshot here and I'll use it to fix the summarizer."

Suggested reply if someone asks how the ffmpeg muxing works:

"The image-to-video model outputs silent video, and the voice clone comes back as a separate audio track, so the worker muxes them with ffmpeg on the H200 box before returning the file. The 402 from the voice API on the video path is why that whole leg moved onto the GPU worker as a fallback."

---

## Posting notes

Flair: not required by the published rules; if the composer shows flair options, pick the build-story or self-promo/product-share flair rather than a question flair. Timing: post after the hackathon ends, ideally Monday 8-11am ET when r/microsaas engagement peaks; avoid posting twice (repetitive posting is a removal reason). Comments: reply to every substantive comment with specifics (which model fell back, how the rewrite was fixed), never say "DM me" (explicitly banned), and do not paste the main link again in replies. A first author comment with the /portal link is prepared in extras; post it immediately after submitting so the body keeps its single-link discipline. Risk: low. The format matches the sub's stated value bar (backstory + stack + insight). Main removal risk is a mod reading it as promo; the single link, the "that is the one plug" line, and the war stories are the mitigation. Do not add revenue or user numbers in comments; there are none to claim.

## What the reviewer fixed/flagged

- RULES: drafter's promo-policy read is correct. Live rules.json returns 403 unauthenticated (verified by direct curl to www.reddit.com and old.reddit.com, which redirects to login, plus a proxy fetch). Third-party tracker gofindevo.com/subreddits/microsaas confirms 6 rules, ~28K members: value-add self-promo allowed (backstory + tech stack + insights expected), context-free links and repetitive posting removed, DM solicitation banned, black-hat tactics banned, no karma requirement. The post body complies; no rewrite to a weekly thread needed.
- RULES/SPAM: the suggested first comment pushed a second full URL (https://cadenhq.vercel.app/portal) immediately after a body claiming 'that is the one plug'. Instant self-reply with another link is classic link-pushing and contradicts the post's own promise; a mod would screenshot that. De-linked it to a plain '/portal path on the same site' reference and kept the feedback ask.
- FACTS: 'A Modal GPU worker' names a vendor that is not in the fact sheet. Fact sheet only supports 'rented H200 GPU'. Removed 'Modal'.
- FACTS: 'The fix took two minutes. Finding it took half a day' invents two time figures; the fact sheet only supports 'invalid_client for hours'. Rewrote to stay within 'hours' with no invented numbers.
- FACTS: 'integrations most demo users never click' implies user-behavior data for a days-old beta with no user-count claims allowed. Rewrote as the author's opinion ('I doubt anyone trying a demo ever clicks them').
- SPAM SMELL: 'Instant demo, no signup.' is landing-page copy pasted into a Reddit post, and 'That is the one plug, the rest of this post is the build' is a known growth-hack wink (plus a comma splice). Rewrote both to plainer sentences.
- SLOP/AUTHENTICITY: participial fragment opener 'Sharing the stack and the honest ledger...' and stiff non-contractions ('I do not want to admit', 'It is a hackathon beta', 'it is the only reason') read AI-formal. Contracted and rewrote; cut hedge word 'genuinely'.
- AUTHENTICITY: post could be pasted into r/SideProject or r/webdev unchanged. Added one r/microsaas-native question (standalone micro SaaS people pay for vs a feature GitHub/Stripe ships eventually) to anchor it to this community. No new facts introduced.
- SLOP: em-dash scan clean in original and revision; no banned phrases (game-changer, seamless, revolutionize, excited to announce, delve, elevate, thrilled) found.

## Reviewer notes

Rules verified independently: www.reddit.com/r/microsaas/about/rules.json returns 403 unauthenticated (tested via curl with browser UA, old.reddit.com redirects to /login, and r.jina.ai proxy got the same 403 block page), so the drafter's fallback to a third-party tracker was legitimate. Tracker gofindevo.com/subreddits/microsaas (plus redship.io and subredditsignals.com search corroboration) matches the drafter's summary exactly: 6 rules, value-add self-promo allowed, bare/context-free links removed, DM solicitation banned, black-hat tactics banned, no karma requirement. Verdict is revised, not do_not_post: the format is the allowed one, but the second-link first comment, the invented 'Modal' vendor fact, two invented time figures, and an implied usage-analytics claim each individually risked removal or a credibility callout. Residual risk a human should weigh: 'built in a weekend with AI' is a saturated genre in this sub and some commenters will be hostile to the AI-tooling angle on principle; the post survives that only if Shivang answers technical questions in public comments as promised. Do not post the first comment if the thread gets traction organically within minutes; it reads better as a reply to the first person who asks about the full version. Sources: https://gofindevo.com/subreddits/microsaas, https://redship.io/blog/reddit-self-promotion-rules, https://www.subredditsignals.com/blog/best-subreddits-to-promote-a-tech-product-in-2026-rules-real-examples-and-outreach-tips-that-don-t-get-you-banned
