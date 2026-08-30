# Motion

Stack: GSAP 3.15 + ScrollTrigger + SplitText, Lenis smooth scroll, Swiper, and a custom Three.js bundle (`assets/index-DM4qWrvI.js`) for the 3D statue scenes. All local, no CDN.

## Signature moments

1. **Preloader.** Full-screen dark panel on the blueprint grid, a huge mono percentage counting 0 to 100, then a wipe reveals the page. Fast (about 2s). Never let it block: if you build a loader, add a hard `setTimeout` fallback that kills it regardless.
2. **Hero intro.** Headline lines reveal from clipped containers (`.hero-clip`), copy fades up, the 3D statue scene fades in behind.
3. **3D statue scenes.** `models/scene.glb` (desktop) / `models/scene-mobile.glb`, loaded by the custom bundle from the site root. Statues animate as you scroll (glasses, wireframe morphs). The transparent overlay videos (`video-green-transparent.webm`, `.mov` for Safari hvc1 alpha) add glow accents.
4. **Stat counters.** Digits tween 0 to `data-to` when the band enters the viewport.
5. **Word-scrub brighten.** The mission paragraph splits into words; a scrubbed ScrollTrigger animates color from `#565656` to `#f1f1f1` as you read. Reading speed = scroll speed.
6. **Pinned tab theater.** The use-case section pins while scroll advances five tabs, headings swapping line by line.
7. **Micro-interactions.** Pill buttons scale ~1.04 on hover, artifact rows sweep a yellow underline, the nav cursor blinks, marquee loops linearly.

## Timing rules

- Reveals: 0.8 to 0.9s, `power2.out` or `power3.out`, staggered ~0.09s per line.
- Scrubbed animations have no duration; they map to scroll distance.
- Hovers: 0.2 to 0.25s. Nothing bounces except button presses (slight spring cubic-bezier).
- Marquee: ~28s per loop, linear, infinite.

## Hard-won gotchas

- **`gsap.ticker.lagSmoothing(0)` matters.** Default lag smoothing freezes animation time when frames are sparse (background tabs, automation, low-power). With it off, animations jump to the correct wall-clock state on the next frame. We shipped a loader stuck at 128 without this.
- **Reduced motion:** respect `prefers-reduced-motion`; the site disables marquee and cursor blink and skips entrance animations.
- **Webflow interactions live in lazy chunks.** The runtime (`webflow.*.js`) loads 18 `webflow.achunk.*.js` files on demand; all must exist locally or interactions silently die with a ChunkLoadError.
- **Lenis + anchors:** anchor clicks must go through `lenis.scrollTo`, otherwise the smooth scroller fights native jumps.
- **Scroll state persists across reloads** (the site restores position). When testing "the top of the page", force `window.scrollTo(0,0)` and wait a beat.
