# Design system

Read this before changing a colour, a component, or anything under `src/components/ui/`.

[← back to the README](../README.md)

The UI is built on one token layer. **Nothing outside `src/app/design/` uses a raw Tailwind palette
class** (`bg-slate-900`, `text-emerald-400`, …) — every colour comes from a semantic token defined
once in `src/app/globals.css` and surfaced in `tailwind.config.ts`. That is what makes the light and
dark themes work and what keeps the contrast guarantees true.

**Direction — "Studio".** Near-black and acid lime, with the user's own voice as the recurring
graphic. Two rules are load-bearing:

1. **Lime is a surface colour, never text.** `#C8F751` carries near-black at 15.3:1 in both themes,
   so the primary button is the same colour in light and dark. What it cannot do is sit on white —
   lime against the light canvas is 1.14:1, well under the 3:1 a control boundary needs — so the
   button carries a 2px `--c-accent-edge` border (ink in light, lime in dark). Where lime is needed
   *as text* there is a separate `--c-accent-text`: the lime itself in dark, a deep olive in light.
2. **Lime doubles as the "strong" score band**, so there is deliberately no second green. A distinct
   success green beside an acid-lime accent reads as two unrelated positives.

| Concern | Where |
|---|---|
| Colour, type, radii, shadow, motion tokens | `src/app/globals.css` |
| Token → Tailwind mapping | `tailwind.config.ts` |
| Primitives (Button, ChoiceGroup, Dialog, …) | `src/components/ui/` |
| Self-hosted fonts | `src/fonts/` |

## Accessibility commitments

These are enforced, not aspirational — re-check them before changing a token or a component:

- **WCAG 2.1 AA contrast** on every foreground/background pair, in both themes. Verified by sampling
  the pixels actually painted under each text node, not computed styles — the background glow and
  film grain sit behind content, so a computed-style check would miss them.
- **Every option group is a real radio group** — one tab stop, arrow-key navigation, `aria-checked`,
  and arrows that follow visual order in RTL.
- **Selection and status are never signalled by colour alone.** Score tiles state their band in
  words; selected options carry a check as well as a colour.
- **`<html lang>` and `<html dir>` follow the practice language** (`src/components/DocumentLanguage.tsx`).
  Without this a screen reader narrates Farsi and German in an English voice.
- **Motion means something.** The waveform is driven by real microphone level, is a static shape when
  idle, and never animates under `prefers-reduced-motion`; the confetti is skipped entirely there.
- **Minimum 24px hit targets**, and a visible focus ring on every interactive element — the ring's
  offset is painted in the canvas colour so it stays visible on the lime button itself.

## Preview routes — remove before release

`/design` and `/design/directions` are development aids that ship as real routes. Delete
`src/app/design/` (and the two display fonts only it uses) before a public deployment.
