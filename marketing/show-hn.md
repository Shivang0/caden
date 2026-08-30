# Hacker News (Show HN)

**Mod-review verdict:** revised

**Promo policy (verified):** Direct post OK. Show HN is the sanctioned venue for promoting your own project, provided it is interactive and tryable (Caden qualifies: instant demo, no signup). No upvote/comment solicitation, and the submitter is expected to stick around and answer questions.

**Rules summary:** Show HN is for "something you've made that other people can play with," worked on personally, with the submitter around to discuss it in comments. Make it easy to try, "ideally without barriers such as signups or emails." Blog posts, sign-up pages, landing pages, newsletters, and minor version bumps are off-topic; early-stage, unpolished work is explicitly welcome. Asking friends to upvote or comment violates community policy.

---

## Title (paste-ready)

Show HN: Caden - Turns merged PRs and Stripe data into investor updates

## Body (paste-ready)

I built Caden this weekend at a hackathon, so expect rough edges.

I never write investor updates or build-in-public posts, because writing one means re-reading a month of PRs and dashboards first. Caden does the re-reading. You connect your accounts (GitHub, Linear, Notion, Figma, Vercel, Stripe, Google, LinkedIn), pick a date range, and it reads your merged PRs and commits plus live Stripe metrics (MRR, customer count). From that it writes four things: an investor update, a LinkedIn post, an X thread, and a changelog. Every claim in the update links back to a real diff, so you can check it's not making things up.

Other bits:

- Org mode: point it at a GitHub org name and it scans up to 5 active repos and writes one combined update.

- Autopilot: on load it prefills your name, repos pushed in the last 7 days, and Stripe metrics. Everything stays editable.

- Voice + video: record 20 seconds of your voice, it clones it, then generates a handheld selfie-style founder video from a photo of you. Deliberately anti-cinematic; it's supposed to look like a phone video, not an AI ad. Pipeline details in my first comment.

- One-click publish to LinkedIn, with an arm-then-confirm step so nothing posts by accident.

Try it without signing up: https://cadenhq.vercel.app. The full app with account connections is at https://cadenhq.vercel.app/portal.

Status: free beta, weekend-old, no revenue, and it broke in several instructive ways while I was building it (war stories in my first comment).

Two things I want feedback on:

1. Would you trust an auto-written investor update enough to send it, given every claim links to a diff?

2. If you run a multi-repo org, is the combined org-mode update readable, or does it turn into mush?

---

## Extras

PREPARED FIRST COMMENT (post immediately after submitting, from the same account):

Author here. Some technical detail that didn't fit the post.

Grounding: the generator doesn't get freeform "summarize my repo" access. The pipeline pulls merged PRs and commits for the chosen date range, plus Stripe MRR and customer count, into one structured context. All four outputs (investor update, LinkedIn post, X thread, changelog) are generated from that same context, and each claim in the investor update carries a link back to the specific diff it came from. If a sentence can't be traced to a PR or a metric, that's a bug and I want to hear about it.

The video pipeline is the jankiest and most fun part:

1. You record 20 seconds of your voice. That gets cloned.

2. It writes a 45-70 word spoken script from the same shipped-work context.

3. A photo of you plus that script goes to an image-to-video model running on a rented H200.

4. ffmpeg muxes the cloned voice track into the video output.

The look is deliberately anti-cinematic: handheld selfie framing, not a polished AI ad. Polished AI video reads as an ad and people scroll past it.

Things that broke during the hackathon, for anyone who collects war stories:

- A stale LinkedIn OAuth client secret gave me invalid_client for hours. The secret in my env was old. I debugged everything except the secret.

- A trailing-slash bug: /portal/ 404'd through a Vercel rewrite while /portal worked fine.

- The LLM provider quota ran out mid-hackathon and everything fell back to a backup model.

- The voice API started returning 402 on the video path, so there's now a GPU-worker fallback that handles it.

The LinkedIn publish has an arm-then-confirm step because auto-posting to someone's real profile with zero confirmation seemed like a great way to ruin their week.

Happy to answer anything about the grounding approach or the video pipeline.

---

## Posting notes

No flair on HN. Submit with BOTH the URL (https://cadenhq.vercel.app) and the body text; HN allows url+text for Show HN. Best window: Tuesday-Thursday, roughly 6-9am Pacific (9am-12pm Eastern). Post the prepared first comment within a minute of submitting, then stay in the thread for several hours; the guidelines expect the author to be around to discuss. Do NOT ask anyone to upvote or comment, that is explicitly against policy and voting-ring detection will bury the post. Risks: (1) voice cloning + AI founder video will draw deepfake/authenticity criticism, answer honestly and note the video is of yourself, opt-in, from your own voice sample; (2) skepticism about AI-written investor updates, lean on the diff-linking answer rather than arguing; (3) traffic spike on a Vercel free-tier app, check quotas before posting. If it gets no traction, HN tolerates one re-submission a few days later, ideally after fixing something a commenter flagged.

## What the reviewer fixed/flagged

- No-contraction prose throughout read as AI-drafted ('It is days old', 'it is not making things up', 'that is a bug', 'does not get'); rewrote with contractions so it sounds like a person.
- Marketing/LLM jargon: 'From that one source of truth' and 'four artifacts' in the body; replaced with plain wording ('From that it writes four things'). Same fix in the comment ('outputs').
- Performative framing: 'Honest status:' label (announcing your own honesty is a tell) cut to 'Status:'; hedge-word 'actually' cut from 'Two things I actually want feedback on'.
- Redundancy: the full video pipeline appeared in both the post bullet and the prepared comment, which reads like padded generated text; trimmed the post bullet and pointed to the first comment for details.
- Opening line said both 'this weekend' and 'It is days old'; merged into one sentence.
- Rules check (live page fetched): promo policy claim is accurate. Interactive, no-signup demo satisfies 'easy to try'; no upvote/comment solicitation; text posts with a prepared author comment are standard practice. No removal grounds.
- Facts: every claim traced to the fact sheet; no invented users/numbers. 'No revenue' is a truthful status statement, not a revenue claim, and stays.
- Slop scan: zero em-dashes in draft and final (title dash is a plain hyphen), no banned phrases (game-changer/seamless/revolutionize/excited to announce/delve/elevate/thrilled).

## Reviewer notes

Verified against the live Show HN guidelines (news.ycombinator.com/showhn.html): direct self-promotion is sanctioned here since the thing is interactive and tryable with no signup; the drafter read the policy correctly. Changes were tone-level only, no facts added or removed. Two operational notes: (1) post the prepared comment immediately after submitting, since the body promises "war stories in my first comment"; (2) expect HN hostility toward the voice-clone/AI-founder-video and auto-generated LinkedIn content parts of the product itself. That is engagement, not a rules problem, but do not get defensive in the thread; the two feedback questions are good lightning rods. Do not ask anyone to upvote or comment.
