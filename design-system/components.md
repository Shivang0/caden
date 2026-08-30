# Components

Patterns as they exist in `demo-web/index.html`. Class names are the shipped ones.

## Announcement banner
Thin yellow strip above the nav. One sentence + underlined link to `#waitlist`.
Mobile gotcha: below 768px an inline CSS rule hides the desktop link text and injects the link label via `content:` on a pseudo-element. If you change the banner CTA text, change it in BOTH the markup and that `@media (max-width: 767px)` rule, or mobile will show stale text.

## Nav (`.nav`, sticky pill)
- Pill container, radius 100px, translucent dark with backdrop blur, thin border appears after scrolling.
- Left: `caden` wordmark + blinking yellow block cursor (pure CSS `@keyframes blink`).
- Center links anchor to in-page sections: `#loop`, `#artifacts`, `#founders`, `#how`, `#waitlist`. The "What you get" item is a dropdown listing the five artifacts.
- Right: text link "Early access" + yellow pill "Join the waitlist".
- Mobile: collapses to hamburger (Webflow runtime handles it).

## Buttons (`.button-066` and `.wl-form button`)
- Pill shape always (radius 100px).
- Yellow variant: `#f9fe2e` bg, `#161616` text, hover shifts to `#ffe042` with a slight scale.
- Dark variant (on yellow surfaces): `#161616` bg with yellow or white text.
- The Webflow buttons have layered `__bg` spans that animate on hover; do not strip the inner spans.

## Section label
`<p class="mono">( LABEL )</p>` in 11 to 14px uppercase mono, dim gray, above every section heading.

## Stats band
Three cells divided by hairlines. Each: giant mono digit (`.num`, counts from 0 to `data-to` on scroll) + small dim description. Suffixes via `data-suffix` (empty or `%`).
Current values: 60 seconds from repo to a finished draft · 3 artifacts from every sprint · 12 investor updates a year, sent on time.

## Logo marquee
Infinite horizontal loop of SVG logos under the stats. Currently still the cloned placeholder logos. Replace or remove before public use.

## Scroll tabs (`#artifacts`, `.tabs-ui`)
Five tab contents (`data-tab="0..4"`), each: three-line stacked heading (`.tab-title__inner` per line), short description, waitlist button, plus product-style imagery. Bottom strip of tab labels with an underline fill showing progress. Scroll advances tabs; the section is pinned meanwhile.
Tabs: Investor Updates · Build in Public Posts · Changelog and Release Notes · The Agent Team · The Loop.

## Testimonial slider (`#founders`, Swiper)
Cards with quote, name, role, and icon. Voice: caden's own agents speak (Summarizer Agent, Metrics Agent, Voice Writer, Compiler, Scheduler, Ghostwriter, Changelog, Runner). No fake human customers. Card avatars and company logos use the yellow featured-icon SVGs.

## Numbered accordion (`#how`, next to the graffiti column art)
Items `( 1 ) Connect your tools`, `( 2 ) Agents read the work`, `( 3 ) You hit send`, plus `Grounded in real diffs` and `Voice matched writing`. One open item at a time, scroll-driven highlight.

## Waitlist forms (two instances, class `.wl-form`)
- Hero card (`.wl-form--hero`): absolutely positioned inside `#heroCopy`, right-aligned (offset `clamp(48px, 5.8vw, 88px)` to compensate container padding), width min(400px, 92vw). Dark translucent card with blur. Static full-width below 991px.
- CTA form (inside `#waitlist`): dark card on the yellow section, two-column fields collapsing to one below 700px.
- Fields: email (required) + `github_repo` (optional) + hidden `source`.
- Endpoint: POST `https://formspree.io/f/xkjnnypd` via fetch with `Accept: application/json`; on success the form swaps to a "You are on the list." message; errors print uppercase into `.wl-status`.
- The CTA section's original Webflow button groups are force-hidden (`#waitlist .button-group{display:none}`): a mobile-only duplicate otherwise overlaps the email input.

## Yellow CTA section (`#waitlist`)
Full-bleed `#f9fe2e`. Headline "Never write an investor update again." + sub + form + reclining-statue artwork + faint inverted grid. The statue's laptop glows on hover.

## Footer
Link columns (mono uppercase headings), then the giant cropped `caden` wordmark behind the lounging-statue artwork, then legal line `© CADEN INC. | ALL RIGHTS RESERVED 2026` + "Manage Cookies" (Finsweet consent). Compliance badges from the clone are hidden with CSS, not deleted.
