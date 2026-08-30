# Voice and copy rules

The writing is half the design. These rules are non-negotiable for anything shipped under caden.

## Hard rules

1. **No em dashes, no en dashes. Ever.** Not in headlines, body, alt text, code comments, or CSS. Use periods, commas, colons, or parentheses. Verify before shipping with a check that matches U+2014 and U+2013, for example: `python3 -c "t=open('index.html').read(); print(t.count(chr(0x2014)), t.count(chr(0x2013)))"`.
2. **No AI-slop vocabulary.** Banned: unlock, seamless, seamlessly, supercharge, effortless, elevate, empower, game-changing, revolutionize, cutting-edge, "in today's fast-paced world", leverage (as a verb), robust, streamline, journey, delve.
3. **Every claim must be defensible.** The brand promise is "grounded in what you actually shipped", so the copy itself cannot bluff. No invented customers, no fake compliance badges, no made-up traction.
4. **Brand name is lowercase: caden.** Even at the start of a sentence.

## Tone

- Founder to founder. Terse, confident, a little dry.
- Short declarative sentences. Two short sentences beat one long one.
- Concrete nouns from the actual workflow: merged PRs, closed tickets, shipped docs, date range, default branch, partner meeting.
- Feelings are named plainly (dread, postponing, blank page) and answered with mechanics, not adjectives.

## Reusable patterns

- **Split headline:** two imperative-ish sentences, statement then payoff. "Ship the work." / "Send the update."
- **Triplet lines:** "Pull the diffs. / Write the story. / Send it monthly."
- **The hero wedge sentence:** "Never write an investor update again."
- **You/it rhythm:** "You review. You hit send." "You do not chase the draft. caden does."
- **Grounding tagline:** "grounded in real diffs, not vibes."
- **Mono labels:** parentheses + uppercase: `( WAITLIST )`, `( THE LOOP )`, `( 1 )`.
- **Stat + blunt caption:** number first, then a plain phrase: "0 blank pages. Every sentence traces back to a real diff."

## Testimonial device

Quotes come from the product's own agents (Summarizer Agent, Metrics Agent, Voice Writer, Scheduler Agent...), each speaking about its job in first person. Honest, on-theme, and funnier than fake humans. Keep roles as micro-titles: "Reads every diff", "Keeps the cadence".

## Microcopy inventory (shipped)

- Banner: "Your commits already wrote this month's investor update." + "Join the waitlist"
- Form success: "You are on the list. Watch your inbox. Your next update writes itself."
- Form fields: "you@yourstartup.com", "github.com/you/product ( optional )"
- Footer: "SHIP FIRST. IT WRITES ITSELF UP." (if reused, keep mono uppercase)
