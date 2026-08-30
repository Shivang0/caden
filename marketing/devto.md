# Dev.to build story

**Mod-review verdict:** revised

**Promo policy (verified):** Direct post OK. Dev.to explicitly supports sharing your own projects via the showdev tag, provided the post is substantive content rather than a pitch. This post is structured as a technical build log with the product linked exactly twice (top and bottom), which is well inside community norms.

**Rules summary:** No live rules fetch was required for this channel. Dev.to's standing content policy: posts must be relevant to software development, self-promotion is allowed when the post itself delivers standalone value, and pure ads are expected to be marked as listings or promoted content. The showdev tag exists specifically for sharing things you built, and build stories with real failure detail are the accepted format. Front-matter title/tags/description are honored by the dev.to editor when pasted in markdown mode.

---

## Title (paste-ready)

How I built a founder autopilot in one weekend

## Body (paste-ready)

---
title: How I built a founder autopilot in one weekend
published: true
description: 8 OAuth providers, a stale client secret, a trailing-slash 404, and a rented H200. The build log for Caden.
tags: webdev, ai, sideproject, showdev
---

This weekend, at a hackathon, I built [Caden](https://cadenhq.vercel.app), a founder autopilot. Connect your accounts, pick a date range, and it writes four things from one source of truth: an investor update, a LinkedIn post, an X thread, and a changelog. Every claim in the update links back to a real diff, so nobody has to trust my adjectives.

This is the build log. The parts that broke are the interesting parts.

## The hard part was 8 OAuth providers, not the AI

I assumed the LLM plumbing would eat the weekend. Wrong. The hard part was connecting GitHub, Linear, Notion, Figma, Vercel, Stripe, Google, and LinkedIn.

Eight providers means eight OAuth apps, eight redirect URIs, eight scope vocabularies, and eight slightly different ideas about what a token response looks like. None of them fail the same way. A few hours in I had a wall of provider config and a new respect for anyone who maintains an integrations product full time.

## Hours of invalid_client

The low point. LinkedIn's token exchange kept returning `invalid_client`. That error tells you almost nothing. I checked the redirect URI five times. I checked scopes. I re-read the token exchange docs and rewrote the request body encoding.

The actual cause: a stale client secret. I had rotated it earlier and the deployed environment still had the old value. Locally everything worked because my local env had the new one. Hours gone to a string that was wrong in exactly one place.

Lesson I keep relearning: when auth fails mysteriously, diff your deployed env against local before you touch any code.

## The trailing-slash 404

Caden is two surfaces. The instant demo lives at the root, no signup. The full app with account connections lives under `/portal`, served through a Vercel rewrite into an app built with `basePath: '/portal'`.

`/portal` worked. `/portal/` returned a 404. Same page, one extra character. The rewrite forwarded the trailing-slash variant in a shape the basePath router did not match, which is exactly the kind of bug that hides until someone shares a link with a stray slash on the end. The fix was making the rewrite handle both forms explicitly instead of hoping.

## Autopilot means prefill, not autopost

The autopilot part is a prefill endpoint. On load, it fills in your founder name, the repos you pushed to in the last 7 days, and your live Stripe metrics (MRR and customer count). Then it stops. Everything stays editable, and publishing to LinkedIn sits behind an arm-then-confirm step, so nothing posts by accident.

I think that is the right boundary for this kind of tool. Draft everything, act on nothing without a human.

There is also an org mode: point it at a GitHub org name and it scans up to 5 active repos and writes one combined update. This is the feature I am least sure about. More on that below.

## Voice cloning and video on a rented H200

The weird feature. You record 20 seconds of your voice, Caden clones it, then generates a founder video from your photo: a 45 to 70 word spoken script over image-to-video output from a model on a rented H200. The result is deliberately anti-cinematic. It should look like a handheld phone video, not an AI ad.

Two problems here. First, the voice API started returning 402 on the video path mid-build, so a GPU-worker fallback handles that case now. Second, the video model outputs silent video, so the cloned voice track gets muxed in with ffmpeg:

```bash
ffmpeg -i video.mp4 -i voice.wav -map 0:v -map 1:a -c:v copy -shortest out.mp4
```

Boring, old, reliable. ffmpeg was the most dependable component in the whole stack.

## The quota ran out anyway

Mid-hackathon, my LLM provider quota ran out. Every generation path died at once. The only reason the demo survived is that I had already wired a fallback to a backup model, and everything degraded to it automatically.

If your product has one LLM call in the critical path, build the fallback before you need it. Not for scale. For the day your quota hits zero at the worst possible moment.

## Where it stands

Caden is a free beta, built in a weekend, days old, rough edges included. It works end to end: connect accounts, pick a range, get an investor update, a LinkedIn post, an X thread, and a changelog with every claim linked to a diff.

Things I genuinely want feedback on from developers:

1. Would you trust an auto-written investor update if every number linked back to a real commit or diff? If not, what would it take?
2. Is the org-mode combined update readable, or does merging 5 repos into one narrative turn to mush?
3. Is arm-then-confirm enough safety for one-click publishing, or would you want a full preview diff first?

Instant demo, no signup: https://cadenhq.vercel.app

If it writes something wrong about your repo, tell me. That is the most useful bug report I can get.

---

## Extras

Cover image suggestion: a screenshot of Caden's output screen showing the four generated artifacts side by side (dev.to cover is 1000x420, crop a real screenshot, no stock art). Inline image suggestion: one screenshot of the autopilot prefill state under the "Autopilot means prefill, not autopost" section, and optionally a frame from a generated founder video under the H200 section to prove the anti-cinematic look. First comment (post it yourself right after publishing): "Happy to go deeper on any of the OAuth providers if someone is fighting the same thing. LinkedIn's invalid_client in particular gives you zero signal, ask away." Tags are set in front matter: webdev, ai, sideproject, showdev.

---

## Posting notes

No flair system on dev.to; the four front-matter tags do that job (showdev is the load-bearing one). Best posting window is a weekday morning US Eastern, Tue to Thu historically does best, but posting right after the hackathon ends keeps the "built this weekend" claim fresh, so do not sit on it more than a day or two. Set published: true only when ready; dev.to treats the front matter literally. In comments, answer technical questions with specifics (which rewrite config fixed the 404, how the fallback model is selected) rather than pointing people at the app. Do not edit the title after publish, it changes the slug behavior and looks fidgety. Risk is low: this is a build log with real failures, which is exactly what showdev is for. One caution: keep any replies free of revenue or user-count claims, the post makes none and comments should not either.

## What the reviewer fixed/flagged

- Slop tell removed: 'you know this exact flavor of pain' is reader-address filler and an AI-writing pattern; replaced with a dry mechanical sentence that invents no new claims.
- Verified against the actual codebase, not just the fact sheet: cadence next.config has basePath: '/portal', demo-web/vercel.json contains explicit rewrites for both /portal and /portal/ (the 'handle both forms explicitly' fix is literally real), and modal-app/caden_video.py runs the ffmpeg mux with -map/-shortest. All war stories check out.
- Mechanical checks pass: zero em-dashes or en-dashes, zero banned phrases (no game-changer/seamless/revolutionize/excited to announce/delve/elevate/thrilled, also clean on leverage/robust/journey/empower).
- Facts audit: every claim traces to the fact sheet; no revenue, user-count, or trusted-by claims; MRR/customer-count mentions are feature descriptions, not metrics claims about Caden.
- Spam audit: product linked exactly twice, four on-topic tags, closing questions are specific and answerable, suggested first comment offers debugging help rather than pushing the link. Within showdev norms; would not remove.
- Left intentionally: the closing recap of the four artifacts repeats the intro, but it serves readers who skim to the bottom before clicking the demo; and the 'eight... eight... eight' anaphora is rhetorical but earns its place.

## Reviewer notes

Verdict is "revised" rather than "pass" solely for one surgical edit in the trailing-slash section; everything else survived a hostile read. As the mod I would leave this up: it is a legitimate showdev build log where the failures are the content and the product links are incidental. Unusually for a review like this, I could verify the war stories against the real repo (/Users/shivang/Desktop/hackathon/sweyoung): basePath '/portal' in cadence/next.config, both /portal and /portal/ rewrite rules in demo-web/vercel.json, and the ffmpeg -map/-shortest mux in modal-app/caden_video.py all exist as described. The extras are unchanged and sound; keep the cover as a real cropped screenshot, not generated art, or it will undercut the anti-slop credibility of the post itself.
