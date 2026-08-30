# LinkedIn launch post (Shivang's voice)

Post from your personal account. Attach a screenshot as the visual (best pick: the portal showing the four generated artifacts side by side, or the autopilot prefill with real repo names redacted as needed).

---

I spent 48 hours teaching an AI to do the founder task everyone quietly hates: the investor update.

Not "write me a post" slop.
The real thing, grounded in what actually shipped.

Here's how Caden works:

→ Connect GitHub, Linear, Notion, Stripe, LinkedIn (8 providers, OAuth was 80% of the pain)
→ Pick a date range
→ It reads every merged PR plus live Stripe MRR
→ Out come four artifacts from one source of truth: investor update, LinkedIn post, X thread, changelog

Every claim links back to a real diff.
If it's not in the commit history, it doesn't go in the update.

The part that nearly killed me wasn't the AI.
It was a stale OAuth client secret throwing `invalid_client` at 2am while my model quota ran out mid-demo.

The part I'm weirdly proud of: record 20 seconds of your voice, upload a selfie, and it renders a handheld founder video on a rented H200, your cloned voice muxed in with `ffmpeg`. Deliberately anti-cinematic. It should look like a phone video, not an AI ad.

My take after this weekend: the best build-in-public content isn't written. It's extracted from the work.

Free beta, demo needs no signup: cadenhq.vercel.app

Would you trust an auto-written investor update if every line linked to the diff behind it? Where's your line?

#buildinpublic #AIagents

---

## Alternate first lines

1. "My weekend project reads my merged PRs so I never write an investor update again."
2. "Investor updates are the homework of founding. I automated mine in 48 hours."

## Notes

- Reply to every comment in the first 2 hours, that window decides reach.
- No em-dashes anywhere (house rule), arrows and periods only.
- If the w_member_social approval lands in time, post this THROUGH Caden and say so in the first comment. That is the best possible proof.
