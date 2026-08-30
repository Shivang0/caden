# Assets inventory

Everything lives in `demo-web/assets/` (filenames keep their original hashed prefixes) and `demo-web/models/`.

## Fonts (woff2)

| File | Family / weight |
|---|---|
| `6a3ec6f98500b066f538a054_TT_Interphases_Pro_Trial_Regular.woff2` | TT Interphases Pro 400 |
| `6a42d298b0b7495d7da5dbf1_TT_Interphases_Pro_Trial_Medium.woff2` | TT Interphases Pro 500 |
| `6a3ec6f9e78b60ecbc499c90_TT_Interphases_Pro_Trial_Bold.woff2` | TT Interphases Pro 700 |
| `6a3ec7268500b066f538ac02_TT_Interphases_Pro_Mono_Variable_Trial_Upright.woff2` | TT Interphases Mono variable |
| `6a5e4d7bc9cb894d9c545860_CCLegendaryLegerdemain_Regular.woff2` | Graffiti accent font |

## Core styles and scripts

- `p-security.webflow.shared.eadd92270.min.css` (the whole stylesheet, font URLs rewritten local)
- `webflow.aebcbe65.66a5662f7f087cf5.js` + 18 × `webflow.achunk.*.js`
- `gsap.min.js`, `ScrollTrigger.min.js`, `SplitText.min.js`, `lenis.min.js`
- `swiper-bundle.min.css`, `swiper-bundle.min.js`
- `index-DM4qWrvI.js` (custom Three.js + GSAP orchestration; contains the tab image URLs and `./models/...` paths)
- `fs-cc.js` (cookie consent), `webfont.js`, `jquery-3.5.1.min.dc5e7f18c8.js`

## 3D and video

- `models/scene.glb` (2.4MB, desktop statue scenes) · `models/scene-mobile.glb` (1.3MB)
- `video-green-transparent.webm` + `video-g-transparent-alpha.mov` (transparent glow overlays; the mov is the Safari hvc1 alpha fallback)

## Backgrounds and UI svgs

- `6a45168c7316606c592707d9_grid.svg` (blueprint grid, used by preloader and waitlist bg)
- `6a481b7483772ba3f1caf6bd_lines-grid.svg` (hero grid; the baked "context layer" label path was removed)
- `6a58cbffd2a4e7bcf494e708_..._footer-grid-bg.svg` (footer/CTA grid; label path removed here too)
- `6a50c87ee79f8c9ff5362bba_grid-bg-medium.svg`, `6a50bcb96cc088e305195b1c_grid-small-square.svg`
- `6a4c0df200e5f767e24ad26d_arrow-right.svg`, checks, `6a71ea7af1236d5539efb78c_featured-icon.svg`, `6a71eba52f9c1feef6c267d6_FeaturedIcon-2.svg` (yellow icons used as testimonial avatars/logos)

## Imagery

- Column graffiti art: `..._column-graffiti.avif` + responsive `-p-500/800/1080` variants and mobile webp variants. Note: the raster itself still reads "PRIME"; replace for a real launch.
- Tab visuals: `..._01-tab.webp` through `..._05-tab.webp` (+ responsive variants, + `05-tab-light.svg`), referenced from both HTML and `index-DM4qWrvI.js`.
- `6a454b0242772e1e71ea6ddb_code-tile.png`, `..._3601883_67251.webp`, `..._maturity.webp`, badges (`badge-1/2/3`, hidden in footer), favicons.
- Marquee logos: `*-logo-v2.svg` set (elastic, bumble, snap, thoughtspot, qualtrics, redox, mx, paypal, cibt, oscar, eon, smartbear). Placeholder branding from the clone; swap before public use.

## Known dead weight

- `testimonial-rock-*.avif` references 403 upstream on the original CDN and are absent here; the swiper works without them.
- `logo-*.svg` testimonial card logos are no longer referenced (replaced by featured icons) but still sit in assets.

## Regenerating or extending

To pull any fresh asset from the original CDN pattern: `https://cdn.prod.website-files.com/6a3e64ff64a92f2281e8e82a/<hashed-filename>` with a browser User-Agent. Percent-encoded names (spaces, parentheses) must be URL-encoded in the request and renamed locally with underscores.
