---
status: accepted
date: 2026-09-07
---

# Support the 17 blend modes Canvas 2D can express and fall back to normal for the rest

## Context

[ADR-0001](0001-psd-parser.md) chose `ag-psd` because it can handle blend modes and per-group visibility, and left one thing open: "how far blend modes map onto Canvas 2D's `globalCompositeOperation` is decided separately". This decides it.

The scope is the mapping table in `lib/psd/blendMode.ts` and how `lib/psd/composite.ts` uses it. The spec is [the PSD viewer's first version](../design/psd-viewer-v1.md).

`ag-psd`'s `BlendMode` type has 31 members, but **only 28 come back on a PSD layer** (`toBlendMode` in `node_modules/ag-psd/dist/helpers.js`). The other three — `linear height`, `height`, `subtraction` — only ever arrive through a descriptor (a layer effect or a vector stroke), so they never appear on `layer.blendMode`.

Removing `pass through` from those 28 — it describes group structure, not a compositing operation — leaves 27, of which **16 have an operation of the same name** in Canvas 2D's `globalCompositeOperation`. What to do with the remaining 11 is what gets decided here.

| | Members |
| --- | --- |
| 16 that match by name | `normal`, `darken`, `multiply`, `color burn`, `lighten`, `screen`, `color dodge`, `overlay`, `soft light`, `hard light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity` |
| 1 that maps under a different name | `linear dodge` → `lighter` (below) |
| 10 with no mapping | `dissolve`, `linear burn`, `darker color`, `lighter color`, `vivid light`, `linear light`, `pin light`, `hard mix`, `subtract`, `divide` |

## Decision criteria

This is a personal project, so what comes first is:

1. **Whether one person can maintain it** — how much code it is, and whether it is still readable in six months
2. Matching what Photoshop shows
3. Rendering speed

Speed comes last because this version **draws once when a file is opened** and never redraws per frame. That ranking can change once visibility toggles and an opacity slider are added.

## Options considered

- Map what maps onto `globalCompositeOperation`, fall back to `normal` for the rest, and mark those as unsupported
- Add to the 16 by implementing the simple formulas (`linear burn`, `linear dodge`, `subtract`, `divide`, and so on) as pixel math
- Drop Canvas compositing entirely and implement all 27 as pixel math
- Do not decide yet. Treat everything as `normal` in v1 and push the mapping to a later version

The fallback target was compared separately across three options: everything to `normal`, to the nearest related mode, or hide the layer entirely.

## Decision

**Map the 17 that can be mapped onto `globalCompositeOperation`, fall back to `normal` for the remaining 10, and mark those as unsupported.**

It wins clearly on the top criterion, whether one person can maintain it. The mapping is a single `Record<BlendMode, GlobalCompositeOperation | null>`, and `composite.ts`'s pipeline stays what it already is: `drawImage` a layer's buffer into its parent.

The two pixel-math options were rejected for **changing the shape of the compositing pipeline**. Canvas compositing takes the backdrop into account implicitly; pixel math needs it explicitly, which means reading the parent buffer back with `getImageData`, compositing in JS, and writing it back with `putImageData`. The partial version also leaves two systems side by side, Canvas-driven and hand-written, plus a line you have to draw yourself around what counts as a "simple formula".

"Do not decide yet" would leave stage 2 of the [spec](../design/psd-viewer-v1.md)'s definition of done entirely empty. Since ADR-0001 chose `ag-psd` *because* of blend modes, it would also mean carrying on without ever testing the premise of that choice.

The fallback is `normal` **so that unsupported stays visibly unsupported.** Falling back to a related mode looks closer to Photoshop, but then a visible difference needs telling apart: bad choice of fallback, or a compositing bug? The point of this version is to be able to judge whether the picture is correct, so being able to tell those apart wins. It also avoids having to justify the choice of fallback, which suits the top criterion.

### Mapping `linear dodge` to `lighter`

**`lighter` is not a blend mode but additive compositing (Porter-Duff PLUS), and it agrees exactly with linear dodge when the backdrop is opaque.** Measured in Chrome:

| Condition | Result |
| --- | --- |
| Backdrop and source both opaque | Color and alpha both match |
| Combinations where the sum saturates at 255 | Match |
| Semi-transparent source, opaque backdrop | Match |
| Transparent backdrop | Match |
| **Semi-transparent backdrop** | **Alpha is summed too, coming out more opaque than it should** (255 where source-over gives 191) |

The only divergence is a semi-transparent backdrop, which in practice means the areas inside a group that lower layers do not cover, and antialiased edges. Falling back to `normal` would be wrong everywhere, so this is clearly closer.

**This mapping is treated as a different thing from "fall back to a related mode".** That was rejected because a visible difference would need telling apart from a compositing bug. `lighter` is not an approximation — it agrees exactly, under a condition. So no unsupported mark is shown for it. Marking something that matches in most cases teaches the reader to ignore the mark.

No other blend mode admits the same trick. The remaining 10 have no corresponding operation in Canvas 2D.

### Consequences

- Good: the mapping is a single piece of data. The compositing pipeline stays one system, with no `getImageData` read-back. The 17 that map ride on `globalCompositeOperation`'s implementation, so the formulas need no verification of their own
- Good: with unsupported fixed at 10, the UI mark and its tooltip can say something specific
- Bad: **a PSD using any of the 10 looks different from Photoshop.** `linear burn` especially, which is used to tighten shadows and contrast, comes out lighter under `normal`
- Bad: the mark appears but the difference stays. "Everything without a mark matches" now also requires hiding those layers on the Photoshop side to check
- Bad: all 10 have simple formulas and could be computed (`dissolve`'s dither pattern aside). It is a decision to **not do something doable**, which invites re-litigating it every time it bites in practice
- Bad: `linear dodge` comes out more opaque than it should over a semi-transparent backdrop. Since no mark is shown, that difference is indistinguishable on screen

### Confirmed

Checked against real PSDs side by side with Photoshop.

- `soft light` and the non-separable modes (`hue`, `saturation`, `color`, `luminosity`) match Photoshop. Whether Canvas 2D uses the same formulas was not guaranteed by the spec, but nothing went wrong on real files
- The mode hit most often in practical PSDs was `linear dodge`. That is what led to adopting `lighter`

### Unconfirmed

- How often each of the remaining 10 actually shows up in real PSDs has not been counted. "`linear burn` is common" rests on general impression
- Whether `linear dodge`'s divergence over a semi-transparent backdrop is visible at all in a real PSD has not been checked

## Notes

- Revisit when a practical PSD repeatedly hits one of the remaining 10. At that point the move is to the second option, filling in only the simple formulas. That rewrite touches `blendMode.ts` and the layer-compositing part of `composite.ts`, and reaches neither `tree.ts` nor the mask handling
- **This revisit has already fired once.** `linear dodge` originally fell back to `normal`, and real PSDs hit it repeatedly. Reworking it surfaced `lighter`, an option missed in the first round, which avoided moving to pixel math. Next time, check again whether a Canvas compositing operation can stand in before writing any
- `pass through` is not in the mapping. It decides whether a group is isolated; it is not a compositing operation. Its handling is in the [spec](../design/psd-viewer-v1.md)'s compositing algorithm
- When the mapping holds `null`, record the layer as unsupported and carry on drawing with `source-over`. That check is a pure function in `lib/`, so it is unit tested ([testing conventions](../../.claude/rules/testing.md))
