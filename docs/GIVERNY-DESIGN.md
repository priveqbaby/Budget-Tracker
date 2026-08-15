# Giverny — the current visual direction

An impressionist colour field seen through liquid glass. Monet for the
atmosphere, Apple's material language for the surfaces.

## What carries over from Yoko Space

Typography and the geometry scale stay: **Titillium Web**, the 12 / 16 radii,
the 12–16–24 type sizes. Those came out of the Figma file and still hold.

## What changed

**The pond.** Five large, heavily-blurred colour blooms drift behind everything
on 44–62s loops that never quite repeat — water, wisteria, lily pad, rose,
afternoon gold. Nothing in the app has a hard background edge any more, which is
the whole point of the reference.

**Liquid glass.** Every card, menu and the sidebar is a translucent pane:
`backdrop-filter: saturate(165%) blur(20px)` over `rgba(255,255,255,.72)`, a
bright specular line inset along the top edge, a soft high-spread shadow so it
reads as floating rather than stuck down. Hovering a card sweeps a band of
light across it.

**Palette.** Deep pond ink `#16262f`, wisteria accent `#6b62c9`, and a status
trio drawn from the same painting: lily-pad green `#158a57`, Giverny gold
`#c58a1e`, water-lily rose `#c2415f`.

## Whimsy, itemised

| Where | What happens |
|---|---|
| Page load | Sections surface in sequence, un-blurring as they rise |
| Hero figure | Counts up to the real number, blooming out of a blur |
| Cards | Light sweeps across the glass on hover |
| Nav | Pills glide right; the active one is a lit gradient |
| Category rows | Slide right and lift off the pond |
| Meters | Fill liquidly; a faint highlight travels along them |
| History bars | Grow up from the waterline in sequence; lift and brighten on hover |
| Chips | A small happy wiggle |
| Wordmark | Ripples like a reflection |
| Owner initials | Pop and tilt |
| Drop zone | Breathes while a file hovers over it |

Every one is decoration. None of it carries meaning, and all of it is disabled
under `prefers-reduced-motion: reduce`.

## Two rules the decoration must not break

1. **Status colour is data.** The travelling highlight on a meter is capped at
   22% white across a narrow band — an early version at 50% bleached the fills
   until a 70%-spent bar looked identical to an empty one. Colour legibility
   beats shine.
2. **`.meter-fill` must stay `position: absolute`.** The base rule stretches it
   with `inset: 0 auto 0 0`. Setting `position: relative` (to anchor the
   highlight pseudo-element) drops it back into flow and silently collapses
   every meter in the app to zero height. An absolutely-positioned element
   already anchors its own `::after`.

## Still open

The **Base Gallery** design system (Figma `6HFDWgsBf2x0SepqEeNjzi`) has not been
read — the Figma connector dropped out of the session before it could be
queried. When it reconnects, the port is the same shape as the Yoko one: read
`get_variable_defs`, replace the token block, re-validate the status trio
against the new surface.
