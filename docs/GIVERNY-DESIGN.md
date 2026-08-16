# Piggy Bank — the current visual direction

Crisp Apple-style glass on one solid ground, with a cast of money faces,
hearts and the household's names drifting across it. Descended from the
Giverny pass (this file's original subject), which is why the filename says
so; the impressionist colour field and every blur it depended on are gone.

## What carries over from Yoko Space

Typography and the geometry scale stay: **Titillium Web**, the 12 / 16 radii,
the 12–16–24 type sizes. Those came out of the Figma file and still hold.

## The ground

**One flat colour.** `--color-page: #e7ebf5`, a soft periwinkle grey from the
wisteria accent's family. No gradients, no noise texture, no blur — `.pond` is
a fixed layer painted that single colour, and everything that moves is a
foreground character on it rather than a tint of it.

**The cast** (`app/layout.tsx`, positions in `app/globals.css`): twelve money
faces at 20% opacity, three hearts at 30%, and eight speech bubbles alternating
Leon and Sara — two full size near the left gutter, six small ones scattered to
the edges. They ride four keyframes (`bob-a`…`bob-d`) at roughly twice the
travel and two-thirds the duration of the first pass, so the field reads as
alive rather than as wallpaper.

**Glass without blur.** Cards are high-opacity translucency plus a bright
specular top edge, a hairline ring and layered shadows. No `backdrop-filter`
anywhere, so every pixel of text and every meter edge stays sharp.

**Palette.** Deep pond ink `#16262f`, wisteria accent `#6b62c9`, and a status
trio validated on the page surface: lily-pad green `#158a57`, Giverny gold
`#c58a1e`, water-lily rose `#c2415f` (CVD ΔE 8.6, normal ΔE 19.9). Member
identity is wisteria for Leon and cyan-teal `#1a8fa8` for Sara — validated as a
two-slot categorical pair (CVD ΔE 10.3 deutan, normal ΔE 15.5).

## Whimsy, itemised

| Where | What happens |
|---|---|
| Page load | Sections settle up in sequence |
| Hero figure | Counts up to the real number |
| Money-this-month tank | Segments ease to their new widths; income and free count up |
| Cards | Light sweeps across the glass on hover |
| Nav | Pills glide right; the active one is a lit gradient |
| Category rows | Slide right and lift off the ground |
| Meters | Fill liquidly; a faint highlight travels along them |
| History bars | Grow up from the baseline in sequence; lift on hover |
| Chips | A small happy wiggle |
| Wordmark | Ripples like a reflection |
| Owner initials | Pop and tilt |
| Drop zone | Breathes while a file hovers over it |
| Quick-add "+" | Scales up under the cursor |

Every one is decoration. None of it carries meaning, and all of it is disabled
under `prefers-reduced-motion: reduce`.

## Three rules the decoration must not break

1. **Status colour is data.** The travelling highlight on a meter is capped at
   22% white across a narrow band — an early version at 50% bleached the fills
   until a 70%-spent bar looked identical to an empty one. Colour legibility
   beats shine.
2. **`.meter-fill` must stay `position: absolute`.** The base rule stretches it
   with `inset: 0 auto 0 0`. Setting `position: relative` (to anchor the
   highlight pseudo-element) drops it back into flow and silently collapses
   every meter in the app to zero height. An absolutely-positioned element
   already anchors its own `::after`.
3. **Popovers are opaque.** The card surface is `rgba(255,255,255,.90)`; a menu
   or quick-add panel painted with it lets the rows underneath show through and
   becomes unreadable. Both use flat `#fff`. Their containing card also has to
   drop `overflow-hidden`, or the panel is clipped.

## Still open

The **Base Gallery** design system (Figma `6HFDWgsBf2x0SepqEeNjzi`) has not been
read — the Figma connector dropped out of the session before it could be
queried. When it reconnects, the port is the same shape as the Yoko one: read
`get_variable_defs`, replace the token block, re-validate the status trio
against the new surface.
