# Stack and deploy

## Stack

- **Pure static site.** No framework, no build step. One big `index.html` plus `assets/` and `models/`. Deploys anywhere that serves files.
- **Runtime libraries (all self-hosted in `assets/`):** jQuery 3.5.1, Webflow runtime + 18 lazy `webflow.achunk.*.js` chunks, GSAP 3.15 (+ ScrollTrigger, SplitText), Lenis 1.0.23, Swiper 11, Finsweet cookie consent (`fs-cc.js`), WebFont loader, and the custom Three.js/GSAP bundle `index-DM4qWrvI.js` (preloader, 3D scenes, tab imagery, scroll orchestration).
- **3D:** `models/scene.glb` (desktop) and `models/scene-mobile.glb`, fetched relative to site root, so a real HTTP server is required (no `file://`).
- **Forms:** Formspree endpoint `https://formspree.io/f/xkjnnypd`, fetch POST with `Accept: application/json`. Two forms share one delegated handler bound to `form.wl-form`.
- **No trackers.** GTM, LinkedIn Insight, Apollo, Unify, RB2B, and HubSpot were all stripped. Only the cookie-consent UI remains (it works locally).

## Local dev

```sh
cd demo-web
python3 -m http.server 8642
# http://localhost:8642/
```

## File layout

```
demo-web/
  index.html    # the caden page
  clone.html    # untouched primesec.ai mirror (design reference)
  README.md
  assets/       # css, js, fonts, images, videos (≈130 files)
  models/       # scene.glb, scene-mobile.glb
  .vercel/      # project link (projectName: caden)
```

## Vercel facts

- Project: `caden` · account `shivangworkemail-5373`
- Deploy: `cd demo-web && vercel deploy --prod --yes`
- Live domains: **https://cadenhq.vercel.app** (public) and the auto alias `https://caden-psi.vercel.app`
- `caden.vercel.app` is owned by someone else. `*.vercel.app` names are global and first come first served (`getcaden`, `caden-ai` also taken).

### Traps we hit (do not rediscover these)

1. **Raw aliases get SSO-walled.** `vercel alias set <url> name.vercel.app` attaches the alias, but deployment protection intercepts it with a `vercel.com/sso-api` redirect. Fix: register the name as a **project domain** instead. The CLI refuses `.vercel.app` via `vercel domains add`; call the API directly: `POST /v10/projects/{id}/domains {"name":"cadenhq.vercel.app"}` with the CLI token from `~/Library/Application Support/com.vercel.cli/auth.json` and `teamId` from `.vercel/project.json`.
2. **Webflow chunks must all be uploaded.** Missing `webflow.achunk.*` files kill all interactions with a ChunkLoadError.
3. **Mobile banner text lives in CSS.** The banner link label under 768px comes from a `content:` rule in an inline style block, not from markup. Change both when editing the banner.
4. **The stray mobile CTA button.** The cloned CTA section ships a second mobile-only button group; keep `#waitlist .button-group{display:none!important}` or it overlaps the form fields on phones.
5. **Formspree first submission.** A brand-new form delivers nothing until the form owner confirms the first submission from their inbox.
