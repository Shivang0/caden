# Typography

## Families

| Family | Role | Weights in use | Files (demo-web/assets/) |
|---|---|---|---|
| TT Interphases Pro (Trial) | Display and body. The whole site. | 400, 500, 700 | `6a3ec6f98500b066f538a054_TT_Interphases_Pro_Trial_Regular.woff2`, `6a42d298b0b7495d7da5dbf1_TT_Interphases_Pro_Trial_Medium.woff2`, `6a3ec6f9e78b60ecbc499c90_TT_Interphases_Pro_Trial_Bold.woff2` |
| TT Interphases Pro Mono Variable (Trial, upright) | Mono labels, stat digits, preloader counter, footer legal | variable 100 to 900 | `6a3ec7268500b066f538ac02_TT_Interphases_Pro_Mono_Variable_Trial_Upright.woff2` |
| CC Legendary Legerdemain | Graffiti display accent (spray-paint look, used sparingly by the original design) | 400 | `6a5e4d7bc9cb894d9c545860_CCLegendaryLegerdemain_Regular.woff2` |
| Montserrat | Loaded via Google Fonts WebFont loader, minor legacy usage from the cloned template | many | remote (Google Fonts) |

Licensing note: the TT Interphases files are trial builds that came with the cloned template. Buy a proper license (TypeType foundry) or swap the family before commercial use.

## How type is used

- **Hero headline:** medium (500), tight letter-spacing (about -0.03em), line-height near 1.0, sizes clamp from ~52px on phones to ~148px on wide screens. Two short sentences, one left, one right.
- **Section statements:** same voice as hero, slightly smaller (up to ~128px). One idea per line.
- **Big paragraph (mission):** 24 to 40px, weight 500, line-height ~1.3. Words start dim and brighten on scroll.
- **Body copy:** 16 to 21px, regular, `#cfcfcf` to `#b5b5b5` on dark, max-width ~480 to 560px.
- **Mono micro-labels:** 11 to 14px, uppercase, letter-spacing 0.04 to 0.14em, dim gray. Written inside parentheses: `( WAITLIST )`, `( 1 )`.
- **Stat digits:** mono, huge (up to ~170px), weight 500 to 600, tight tracking. Digits animate from 0 via `data-to`.
- **Footer legal:** mono, 12px, letter-spacing 0.1em, uppercase.

## The wordmark

"caden" is lowercase TT Interphases Bold with tight tracking plus a solid yellow block cursor after the final letter (blinking in the nav). The footer version is the word alone at clamp(110px, 22vw, 400px), color inherits from context (white on dark, dark on yellow), cropped by the viewport bottom.

## Rules

- Never use the graffiti font for information. Decoration only.
- Punctuation ends headlines: "Ship the work." with the period. The period is part of the voice.
- No italics anywhere. Emphasis comes from weight, size, or the accent color.
- No letter-spacing on body text; wide tracking is exclusively a mono-label device.
