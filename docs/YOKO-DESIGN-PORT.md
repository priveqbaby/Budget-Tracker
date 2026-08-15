# Yoko Space design system — port record

**Status:** Ported. Source: Figma file `fVrPewJapYg1xDI3xmdifa`
("Yoko Space Design System v1 (LTR) (Community)", v1.2.0), read through the
Figma MCP connector.

## What the file actually defines

This community file is the **documentation / file-component kit**, not the full
component library. It carries the foundation — brand color, neutral ramps,
typography, radii, spacing, one shadow — but no accent ramp beyond the single
brand blue, and **no semantic status palette**. Its changelog chips
(Added / Removed / Changed / Deprecated) are deliberately monochrome.

## Tokens taken verbatim (Yoko)

| Role | Variable | Value |
|---|---|---|
| Brand | `Color/Yoko` | `#021cfc` |
| Surface | `bg/neutral/1` … `bg/neutral/4` | `#ffffff` `#fcfcfc` `#f9f9f9` `#f1f1f1` |
| Inverse surface | `bg/neutral/10` | `#000000` |
| Ink | `fg/neutral/1,3,5,10` | `#000000` `#2b2b2b` `#646464` `#ffffff` |
| Borders | `border/neutral/6,7,8,9` | `#b8b8b8` `#d5d5d5` `#e3e3e3` `#f1f1f1` |
| Family | `typography/fontfamily/font` | Titillium Web |
| Sizes | `typography/size/*` | xs 12 · sm 14 · base 16 · 2xl 24 · 6xl 60 · 7xl 72 · 8xl 96 |
| Weights | `typography/weight/*` | regular 400 · semibold 600 · bold 700 |
| Line heights | `English/Caption/c1`, `English/Body/b1` | 16 · 20 |
| Radii | `rounded-none` `radius3` `rounded-2xl` `rounded-full` | 0 · 12 · 16 · 9999 |
| Spacing | `dt/space-bock/Space-00`, `space6`, raw steps | 0 · 8 · 12 · 24 · 40 · 80 |
| Shadow | `shadow/shadow-4` | `0 4px 4px -2px #18274B14, 0 2px 4px -2px #18274B1F` |

Note the shadow is blue-tinted (`#18274B`), not neutral black — carried through
verbatim.

## Values we had to supply (derived, clearly marked in `globals.css`)

The system gives one accent and no status colors, but the dashboard needs a
hover step and a three-state status palette. These are ours:

| Role | Value | Basis |
|---|---|---|
| Accent hover | `#0114c4` | darker step of `Color/Yoko` |
| Accent wash | `#e7eaff` | tint of `Color/Yoko` for chips and selected rows |
| Status ok | `#0f7a33` | validated below |
| Status watch | `#d99400` | validated below |
| Status over | `#ce1f2e` | validated below |

The status trio was run through the data-viz palette validator against Yoko's
white surface: **CVD separation ΔE 14.9** (protan, worst adjacent pair),
**normal-vision ΔE 23.5**, lightness band and chroma floor pass. The amber sits
below 3:1 contrast on white by design, which is legal only with secondary
encoding — every status in the app ships a visible text label ("on pace",
"near cap", "over"), so color never carries the meaning alone.

If Yoko Space publishes a semantic palette in another file, swapping these five
values in `app/globals.css` is the entire change.

## What the port changed

- `app/globals.css` — the `@theme` block is the single source of truth; every
  token above lives there and nothing else holds a literal.
- `app/layout.tsx` — Fraunces / Instrument Sans / Spline Sans Mono replaced by
  Titillium Web at 400/600/700. Yoko specifies one family, so the serif display
  face and the separate mono are gone; money columns keep `tabular-nums` so
  digits still align down a column.
- The paper grain and warm radial gradient were removed. Yoko is flat and
  high-contrast; the texture was the old identity, not this one.
- Member identity colors are now `#021cfc` / `#2b2b2b` (were terracotta/slate).
- Active navigation is a solid black pill with white text — the system's own
  high-contrast idiom, visible on the file's cover.
