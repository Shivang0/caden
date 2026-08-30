# caden design system · index

Reference docs for the caden landing page (`demo-web/`), live at https://cadenhq.vercel.app.
Everything the site does visually, verbally, and technically is written down here so it can be reused or extended without reverse-engineering the page.

Provenance note: the visual language is derived from a clone of primesec.ai made as a hackathon design scaffold (`demo-web/clone.html` is the untouched reference). All copy and naming is original to caden. Swap remaining borrowed artwork (logo marquee, column graffiti raster) before any serious public use.

## Directory

| File | What is inside |
|---|---|
| [principles.md](principles.md) | The aesthetic direction and the layout rules that make the page feel the way it does |
| [colors.md](colors.md) | Every color token with hex values and usage rules |
| [typography.md](typography.md) | Fonts, weights, files, sizes, and how type is composed |
| [components.md](components.md) | Nav, banner, buttons, forms, stats, tabs, cards, accordion, footer patterns |
| [motion.md](motion.md) | Preloader, scroll animations, 3D scenes, smooth scroll, and the timing gotchas |
| [voice-and-copy.md](voice-and-copy.md) | Writing rules: tone, banned words, headline patterns, the no-dash rule |
| [product-narrative.md](product-narrative.md) | What caden is, the loop, the three artifacts, positioning lines |
| [stack-and-deploy.md](stack-and-deploy.md) | Tech stack, file layout, Formspree wiring, Vercel deploy facts and traps |
| [assets-inventory.md](assets-inventory.md) | Where every font, SVG, image, video, and 3D model lives |

## Fast answers

- Accent yellow: `#f9fe2e` · dark base: `#1a1a1a` · off-white: `#f1f1f1`
- Display and body font: TT Interphases Pro · labels and digits: TT Interphases Pro Mono
- Waitlist endpoint: `https://formspree.io/f/xkjnnypd` (two forms, hero + yellow CTA)
- Deploy: `cd demo-web && vercel deploy --prod --yes` (project `caden`)
- Hard rule in all copy: no em dashes, no en dashes, no marketing slop words
