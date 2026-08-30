# r/buildinpublic

**Mod-review verdict:** revised

**Promo policy (verified):** Direct post OK. Product mentions are expected content in r/buildinpublic when framed as a transparent build log or progress update; pure ads and drive-by launches with no engagement get removed as spam. This post is the allowed form: build log first, single product link at the end, specific feedback asks, and a stated commitment to follow-up posts.

**Rules summary:** The live rules.json was unreachable (Reddit serves a 403/JS challenge to unauthenticated clients; verified with multiple user agents and old.reddit fallback). Per multiple current third-party rule databases (oneup.today and saascity.io, both 2026), r/buildinpublic expects product mentions as part of transparently sharing your build, with spam still removed; what gets removed is drive-by launching with no ongoing participation. The community rewards regular, substantive progress posts over one-off promos. Net: a journey/build-log post with a product link is squarely within the sub's norms; a bare ad is not.

---

## Title (paste-ready)

48-hour hackathon build log: a tool that writes your build-in-public updates from your commits, and everything that broke on the way

## Body (paste-ready)

This weekend I built Caden at a 48-hour hackathon. It connects to your GitHub, reads your merged PRs, commits, and live Stripe metrics, then writes four things from one source of truth: an investor update, a LinkedIn post, an X thread, and a changelog. Every claim links back to a real diff. Yes, I see the irony of hand-writing this build-in-public post about a tool that writes build-in-public posts. The tool does not get to write its own origin story.

Rough hour-by-hour, times approximate because my memory from hour 30 onward is mush:

Hours 0 to 6: scaffolding. GitHub connect, pull merged PRs and commits for a date range, first investor update generating. The claim-links-to-diff part went in first because that is the whole point. An update you can audit beats an update that sounds good.

Hours 6 to 12: the other three artifacts off the same data. Wired in live Stripe metrics so MRR and customer count come from the API, not from my optimism.

Hours 12 to 18: org mode. Point it at a GitHub org name and it scans up to 5 active repos and writes one combined update. Also autopilot prefill: on load it grabs your founder name, repos pushed in the last 7 days, and Stripe numbers. Everything stays editable.

Hours 18 to 24: LinkedIn publishing, where it all went sideways. invalid_client on the OAuth flow, for hours. The cause turned out to be a stale client secret. Hours of my 48, gone to one credential.

Somewhere in there the LLM provider quota ran out mid-hackathon and everything fell back to a backup model. Glad the fallback path existed before I needed it.

Hours 24 to 36: voice and video. You record 20 seconds of your voice, it clones it, then generates a handheld selfie-style founder video: your photo plus a 45 to 70 word spoken script through an image-to-video model on a rented H200, cloned voice muxed in with ffmpeg. Deliberately anti-cinematic. It should look like a phone video, not an AI ad. The voice API returned 402 on the video path, so a GPU-worker fallback handles that now.

Hours 36 to 44: the boring bugs. /portal worked, /portal/ returned a 404, trailing slash through a Vercel rewrite. Took embarrassingly long to spot. Also added an arm-then-confirm step on the LinkedIn publish button, because an autopilot with posting access to your real LinkedIn deserves a safety.

Hours 44 to 48: demo polish, shipping, staring at the clock.

Status: free beta, days old, rough edges everywhere. No revenue, no user numbers to brag about, just a thing that works on my repos and needs to be tested on yours.

Three things I actually want this sub's opinion on:

1. Would you trust an auto-written investor update if every claim links to the real diff, or is hand-writing it the point?
2. Org mode writes one combined update across up to 5 repos. Is that readable, or does it turn to soup?
3. The founder video is rough-looking on purpose. Useful for build-in-public content, or uncanny?

Demo is instant, no signup: https://cadenhq.vercel.app (the full app with account connections is at /portal on the same domain)

If you run it on your own repo and the update it writes is wrong or bland, tell me exactly where. That is worth more to me than an upvote. I will post a follow-up here once the beta feedback lands.

---

## Extras

Suggested first comment (post immediately after submitting, keeps the thread technical): "Stack notes for anyone curious: Next.js on Vercel, GitHub/Stripe/LinkedIn APIs, image-to-video on a rented H200, ffmpeg for muxing the cloned voice track. Happy to go deeper on any of the failure modes, the OAuth one still stings." Image suggestion: one screenshot of a generated investor update showing a claim with its diff link visible, captioned "every line links to the commit it came from". No promo thread needed; direct post is the allowed form here.

---

## Posting notes

Flair: pick a progress/update-style flair if one is offered on submit (the sub's flairs vary; anything like "Progress update" or "Sharing my project" fits; skip flair if none matches rather than mislabeling). Timing: post after the hackathon actually ends (deadline is Sun Aug 30, 10:00) so "built this weekend" is literally true; Sunday afternoon or Monday morning US Eastern is fine, this sub is active on weekends. Comments: reply to every substantive comment within the first 2-3 hours, especially bug reports; treat "it wrote something bland for my repo" replies as gold and say what you will fix. Risk: the sub removes drive-by launches, so the follow-up post promised in the last line is not optional; plan a genuine week-2 update. Caveat: live rules.json could not be fetched (Reddit returns 403 to unauthenticated clients), so re-skim the sidebar rules once while logged in before posting.

## What the reviewer fixed/flagged

- Rules verification: live rules.json is unreachable unauthenticated (reproduced Reddit's JS-challenge block page via www, old.reddit, and api.reddit with browser user agents), confirming the drafter's claim. Secondary source (redditagency.com r/buildinpublic community guide) confirms the policy: 'No Self-Promotion Without Context' (progress + lessons + feedback asks allowed), 'No Spam' (link-spam and unsolicited ads removed), transparency about paid/free tools. Draft is the allowed form; promo-policy claim upheld, no restructuring needed.
- Slop: 'The founder video is intentionally rough-looking on purpose' was redundant (intentionally + on purpose). Fixed to 'rough-looking on purpose'.
- Slop: three stacked aphorisms ('An update you can audit beats an update that sounds good', 'Fallbacks are not optional. They are the plan.', 'worth more to me than an upvote') is a generated-text tell. Flattened the weakest ('Fallbacks are not optional. They are the plan.') into a plain factual sentence; kept the other two.
- Style: 'stale client secret' followed by 'one stale credential' two sentences later repeated an unusual adjective; second instance simplified to 'one credential'.
- Fact check: all claims traced to the fact sheet (four artifacts, diff-linked claims, org mode 5 repos, autopilot prefill, 20s voice clone, 45-70 word script, H200, ffmpeg, 402 GPU-worker fallback, stale OAuth secret, trailing-slash bug, arm-then-confirm, free beta, no traction claims). No invented numbers, users, or revenue. Hour buckets are hedged narrative framing around fact-sheet events.
- Link check: curl-verified https://cadenhq.vercel.app (200), /portal (200), and /portal/ (200), the trailing-slash fix described in the post is live, so the story survives a mod clicking the links.
- Em-dash scan: zero em-dashes in title, body, and extras. No banned phrases found.
- Name flag: fact sheet and domain say Caden/cadenhq, but drafter's own project memory says 'Cadence'. Poster should confirm the landing-page name matches the post before submitting; kept 'Caden' per the authoritative fact sheet.

## Reviewer notes

Verdict is revised, not pass, only because of three small copy edits; structure, title, link placement, and extras are unchanged. As the mod I could not find removal grounds: the post is a progress log with lessons and specific feedback asks, matching r/buildinpublic's 'No Self-Promotion Without Context' allowance per the redditagency.com community guide (live rules.json confirmed blocked to unauthenticated clients, as the drafter reported). Edits made: removed the 'intentionally...on purpose' redundancy in question 3, replaced the aphorism 'Fallbacks are not optional. They are the plan.' with a plain sentence to break up the three-zinger pattern, and de-duplicated 'stale' (now 'one credential'). All facts verified against the fact sheet; no invented metrics. URLs verified live: root, /portal, and /portal/ all return 200. One pre-post check for Shivang: fact sheet says 'Caden' but project memory says 'Cadence'; confirm the name on the landing page matches the post.
