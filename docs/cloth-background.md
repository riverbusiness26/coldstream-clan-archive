# Coldstream cloth background

The site ground uses `site/public/textures/coldstream-felt-tile.png`, a 2048px
edge-matched tile generated as a flat material scan. It is deliberately even;
the lighting and vignette are CSS layers so the surface remains consistent on
desktop, mobile, and pages with different content heights.

## Tokens

| Token | Value | Purpose |
| --- | --- | --- |
| `--cloth-base` | `#121416` | Warm near-obsidian fallback colour |
| `--cloth-deep` | `#080a0c` | Edge/canvas fallback behind the body |
| `--cloth-vignette` | `rgba(0,0,0,.46)` | Soft edge darkening |
| `--cloth-noise-strength` | `.12` | Intended low contrast for the tile; no animated noise |
| `--cloth-top-light` | `rgba(220,190,145,.035)` | Barely perceptible warm top light |

The tile is repeated at `1024px` on desktop and `768px` on mobile. The mobile
rule also switches the layers to `scroll` attachment, avoiding the repaint cost
of fixed backgrounds on small devices.

## CSS treatment

`site/src/styles.css` applies three GPU-cheap layers to `body`: a faint top
light, a radial vignette, and the texture image. The `.cg-home` shell is
transparent so the cloth can continue behind homepage modules; cards remain
opaque for contrast.

Gold should sit above the cloth with contact rather than glow. For new brass
labels, use:

```css
text-shadow: 0 1px 1px rgba(0,0,0,.95), 0 3px 7px rgba(0,0,0,.42);
```

Keep body copy at the existing cream/frost values (`#e8eae6` / `#c5d0d8`) and
avoid using `screen` or bright bloom on UI controls; the cloth is matte and the
brass edge is the only warm highlight.

## Texture recipe

Generate a square, seamless, edge-matched material scan with:

- warm charcoal felt/wool, approximately `#121416`
- tight fine nap and subtle tonal mottling
- matte, light-absorbing surface with tiny fibre relief
- no objects, text, logos, borders, gold/red accents, or baked vignette
- no obvious repeat, loud film grain, glossy velvet, satin, leather, carbon
  fibre, or plastic appearance

If the asset is regenerated, keep the same filename and preserve a square
2048px (or larger) tile so the CSS does not need to change.
