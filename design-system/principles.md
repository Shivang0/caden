# Design principles

The one-line direction: **industrial editorial on near-black, with one electric yellow, huge type, and classical statues doing modern work.**

## The core tensions that make it work

1. **Classical vs modern.** Marble statues wear Google Glass, hold laptops, sip cocktails. The brand joke in one image: ancient patience, modern tooling. Any new artwork should keep this collision.
2. **Massive type vs empty space.** Headlines run 100px or larger and sections are mostly dark air. Never fill the space. The emptiness is what makes the yellow and the type land.
3. **One loud color.** Yellow `#f9fe2e` appears as a thin banner, small pills, one full-bleed CTA section, and tiny accents. Because it is rationed, the yellow CTA section feels like an event.
4. **Blueprint texture.** Faint grid lines, corner crosses, and diagonal rules sit at very low contrast behind everything. They read as an engineering drawing, which matches "grounded in real diffs".

## Layout rules

- Split composition in the hero: statement top-left ("Ship the work."), answer bottom-right ("Send the update."). Diagonal eye travel, never centered.
- Sections alternate density: huge sparse statement, then a dense functional block (stats, tabs, cards), then sparse again.
- Numbered structure everywhere: `( 1 )`, `01`, mono uppercase labels like `( WAITLIST )`. The page reads like a spec document.
- Pinned scroll sections: long vertical scroll drives state changes (tab switches, line reveals) instead of clicks. Scrolling is the primary interaction.
- Full-bleed moments only twice: the yellow CTA and the footer wordmark. Everything else lives inside a padded container (~40px each side at desktop).
- The footer wordmark bleeds off the bottom edge intentionally. Do not "fix" the clipping.

## Do / do not

- Do use mono uppercase micro-labels to introduce sections.
- Do keep body copy narrow (max ~480px) against wide dark space.
- Do let hover states be small: slight scale on pills, yellow underline sweep on rows.
- Do not introduce a second accent color. Gray steps + yellow only.
- Do not center headlines. Left or right, never middle.
- Do not use rounded cards everywhere: radius is reserved for pills (100px) and form cards (12 to 20px).
- Do not brighten the grid textures. They live at roughly 10 to 20 percent visibility.
