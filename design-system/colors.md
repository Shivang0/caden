# Colors

Single dark theme with one accent. All values verified against the shipped CSS.

## Core palette

| Token | Hex | Use |
|---|---|---|
| bg-main | `#1a1a1a` | Page background |
| bg-alt | `#161616` | Alternate sections, form cards, dark buttons on yellow |
| bg-card | `#212121` | Input fields on dark |
| border-main | `#363636` | Input borders, hairline dividers on dark |
| border-soft | `#2a2a2a` | Subtler section dividers |
| border-secondary | `#676767` | Rare stronger strokes |
| ink | `#f1f1f1` | Primary text on dark |
| ink-secondary | `#f8f8f8` | Occasional lighter surfaces/text |
| ink-dim | `#8f8f8f` | Labels, captions, deemphasized text |
| placeholder | `#939393` / `#6d6d6d` | Input placeholders |
| accent | `#f9fe2e` | THE yellow: banner, pills, CTA section, highlights |
| accent-warm | `#ffe042` | Hover state of yellow elements |
| dark-on-yellow | `#161616` | All text and controls sitting on yellow |

## Supporting grays (from the cloned stylesheet, light contexts)

`#e5e5e5` (light border), `#afafaf` (light secondary border), `#f1f1f1` (light bg). Rarely used since the site is dark-first.

## Rules

- Yellow never carries body text. On yellow, text is `#161616`.
- Dim text (`#8f8f8f`) is for labels and metadata only, never for sentences the visitor must read.
- Dimmed word state in the scroll-brighten paragraph starts at `#565656` and animates to `#f1f1f1`.
- Grid/blueprint lines use `#393939` at around 20 percent opacity.
- Text selection: yellow background, dark text (`::selection`).
- Status colors: errors use `#ff7a6e`; success reuses accent yellow. No green, no blue anywhere.
