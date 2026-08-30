# demo-web — caden landing page

Waitlist landing page for **caden**, the founder autopilot: connect GitHub, Linear, Notion and the rest of your stack, and a team of specialist agents (summarizer, metrics, voice matched writers) turns what you actually shipped into the founder comms you never get to: the investor update, build in public posts, and the changelog.

Built on the full design system, artwork, 3D scenes, and animation stack cloned from primesec.ai, with every piece of content rewritten for caden.

## Run

```sh
cd demo-web
python3 -m http.server 8642
# open http://localhost:8642/
```

A plain HTTP server is required (not `file://`) because the page fetches 3D models and lazy JS chunks. The folder is fully static, so it deploys to Vercel as-is.

## Files

- `index.html` — the caden page (rewritten content, waitlist form, all assets local)
- `clone.html` — untouched mirror of the original primesec.ai homepage, kept as design reference
- `assets/` — fonts, images, SVGs, GSAP + Lenis + Swiper + Webflow runtime and its lazy chunks, transparent videos
- `models/` — GLB 3D scenes (the statue) loaded by the animation bundle

## Waitlist form

The yellow CTA section (`#waitlist`) holds the form. It POSTs email + optional repo to Formspree at `https://formspree.io/f/xkjnnypd` via fetch, with an inline success state ("You are on the list.") and error fallback. Every "Join the waitlist" button on the page anchors to it.

## Notes

- All trackers from the original site (GTM, LinkedIn, Apollo, Unify, RB2B, HubSpot) are removed. The cookie consent widget still works.
- Testimonials are written as caden agent personas (Summarizer Agent, Metrics Agent, ...) rather than fake customer quotes; company logos in those cards were swapped for caden icons.
- The logo marquee under the stats still shows the cloned placeholder logos; swap or remove before any public launch.
- The marble column graffiti image still reads "PRIME" (baked into the artwork raster).
- No em or en dashes anywhere in the page source.
