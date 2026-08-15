# Porting Hearth to the Yoko Space design system

**Status:** Blocked on Figma access — tracked, not started.

## Why it isn't done

This build environment cannot reach `figma.com` (blocked by the network egress
policy), and no Figma connector is enabled on the account. The embed URL alone
renders through canvas/JS, so fetching it yields no tokens. Rather than invent a
palette and call it Yoko Space, the port waits for real values.

## To unblock

Connect the official Figma connector at **claude.ai → Settings → Connectors →
Figma**. It exposes exactly what a faithful port needs:

| Tool | What it gives us |
|---|---|
| `get_variable_defs` | the real variables — color, type, spacing, radius tokens |
| `get_design_context` | structure and component composition for a selected node |
| `get_screenshot` | pixel reference to check the port against |
| `create_design_system_rules` | the system's own usage rules |

With that connected, point me at the file
(`fVrPewJapYg1xDI3xmdifa`, node `902-12356`) and the port is mechanical.

## Alternative if the connector isn't an option

Export Figma variables to JSON (Figma's own export, or the Design Tokens
plugin) and drop the file in, or paste screenshots of the color, type and
component frames. Screenshots are enough for a close port; the JSON is enough
for an exact one.

## What the port will touch

Hearth's design is already tokenized, so the surface area is small and
mechanical:

- `app/globals.css` — the `@theme` block is the single source of truth for
  color, font family, shadow, and radius. Swapping Yoko Space's values here
  restyles the whole app.
- `components/*.tsx` — utility classes reference the tokens, not literals. The
  exceptions to audit are the two member-identity colors in
  `category-rows.tsx` / `settings/page.tsx`, and the status trio (ok / warn /
  danger), which must stay colorblind-distinct after the swap.
- Re-run the palette validator on the new status colors against the new
  surface before shipping — the current trio passes CVD separation and
  contrast, and a brand swap can silently break that.

Typography is the one place a straight swap may need judgment: Hearth pairs a
serif display (Fraunces) with a UI sans and a mono for money columns. If Yoko
Space specifies a single family, the money columns still need tabular figures.
