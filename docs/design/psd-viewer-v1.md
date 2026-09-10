# PSD viewer (first version)

## Overview

Open a local PSD file, composite the layers `ag-psd` parses onto a Canvas 2D, and draw them. Alongside that, show the layer tree in a read-only layer panel. There are no editing operations.

## Background

[ADR-0001](../adr/0001-psd-parser.md) settled on `ag-psd`, but no rendering code exists yet. As it stands, `app/psd-check/page.tsx` only confirms that parsing succeeds; nothing is drawn to a canvas.

The traps collected in [the ag-psd notes](../ag-psd-notes.md) — `children[0]` being the backmost layer, group opacity not being inherited by children, `hidden` meaning the opposite of what it reads like — all produce nothing worse than a picture that looks vaguely wrong. Only drawing something real tells you. That comes first.

## Goals

- Opening a local PSD draws every layer to the canvas in the same stacking order as the original
- Blend modes, layer masks, clipping masks, and group opacity are reflected in the picture
- The layer panel shows the layer tree, with name, opacity, blend mode, and visibility readable
- Where an element cannot be drawn or does not match, the UI says which node it is and what is unsupported

## Out of scope

- Editing (toggling visibility, changing opacity, reordering, renaming). The layer panel is read-only
- Zoom and pan. Scale is a toggle between fit and 100%
- Applying adjustment layer effects
- Reproducing layer effects (drop shadow, stroke, and so on)
- Exporting an image
- Opening several files at once, and artboards
- E2E with Playwright

## Specification

**Strings in this document's mock-ups and examples are written in English.** What the app renders is Japanese, per [ADR-0005](../adr/0005-repository-language.md); the wording lives in the [glossary](../glossary.md)'s Japanese column.

### Interaction and screen

Everything fits on one screen: layer panel on the left, canvas on the right.

```
┌────────────────────────────────────────────────┐
│ [Choose file] sample.psd          [fit] [100%] │
├──────────────────────┬─────────────────────────┤
│ Layers  3 unsupported│                         │
│ ─────────────────────│                         │
│ ▼ Group A       100% │   ┌───────────────┐     │
│     Layer 2 multiply │   │               │     │
│     Layer 1        ⚠ │   │    Canvas     │     │
│ Background      100% │   └───────────────┘     │
├──────────────────────┴─────────────────────────┤
│ ⚠ Could not read broken.psd: <reason>          │
└────────────────────────────────────────────────┘
```

The filename in the toolbar belongs to **the document on display**; the error along the bottom belongs to **the file most recently attempted**. Those two can disagree, so both always carry a filename. When there is no error, the bottom line is not shown.

There are exactly three operations.

1. **Open a file** — pick it with `<input type="file">` or drag and drop onto the canvas area. Opening runs parsing, compositing, and drawing, and fills the layer panel. **A load is accepted while another is running, and replaces it** (below)
2. **Switch scale** — fit shrinks the document to fit the viewport, never enlarging it. 100% is actual size, with `overflow: auto` scrolling whatever does not fit. **The canvas is always drawn at document size; only the CSS display size changes.** Nothing is redrawn
3. **See why something is unsupported** — hovering the mark on a panel row shows the reason in a tooltip

The layer panel follows Photoshop's order, **reversing** `children` so that the front is at the top. Groups can be collapsed.

### Data

What gets read from `ag-psd`. The read options are `useImageData: true`, `skipCompositeImageData: true`, and `skipThumbnail: true`, per [the ag-psd notes](../ag-psd-notes.md).

| Purpose | Source | Conversion |
| --- | --- | --- |
| Document size | `psd.width`, `psd.height` | Used for the dimension checks |
| Layer tree | Recurse through `psd.children` | A node is a group when it has `children` |
| Visibility | `layer.hidden` | Inverted into `visible: !layer.hidden` |
| Opacity | `layer.opacity` (0-1) | No conversion. **Only a `"pass through"` group's share gets multiplied in** (below) |
| Blend mode | `layer.blendMode` | Mapped onto `globalCompositeOperation` through the table |
| Clipping | `layer.clipping` | Treated as clipping to the base layer directly below |
| Layer bounds | `layer.left`, `top`, `right`, `bottom` | Document coordinates. Used as the offset when drawing |
| Pixels | `layer.imageData` | Typed `PixelData`. Sized to the layer bounds, not the document |
| Layer mask | `layer.mask` | Uses `imageData`, the rectangle, `disabled`, and `defaultColor`. The mask's rectangle does not match the layer's |
| Name | `layer.name` | When `undefined`, display the `UNNAMED_LAYER` placeholder |

The state the app holds, and where it lives. The approach follows [react.md](../../.claude/rules/react.md).

| State | Location | Why |
| --- | --- | --- |
| The document on display (filename, document size) | `atoms/document.ts` | Below. Kept apart from the load attempt |
| The load attempt (`idle`, `parsing`, `error`) | `atoms/document.ts` | Held as a union and branched on with `switch` |
| Parse results and intermediate buffers | Locals inside the worker | Discarded with the worker, never carried to the main thread |
| The composited RGBA | A `useRef` inside `usePsdDocument` | Huge pixel data does not go into React state |
| Layer tree (drawing parameters only, no pixels) | `atoms/layers.ts` | Both the panel and the canvas read it |
| Scale (`"fit"`, `"actual"`) | `atoms/viewport.ts` | |
| The list of unsupported elements | A derived atom | Computable from the layer tree. Not held twice |

**The document on display and the load attempt are separate atoms.** A failure leaves the previous render alone (below), so the canvas and the layer panel keep showing the previous file while the failure belongs to a different one. Mixed into a single union, there is no way to express which file the visible tree came from.

- The document on display — replaced only when a load succeeds. `null` means nothing has been opened yet. Its filename goes in the toolbar, and it says who the layer panel and canvas belong to
- The load attempt — the outcome for the file most recently opened. `parsing` holds the `File`, `error` holds a filename and a reason. It returns to `idle` once a load succeeds. A `File` is only a reference and holds no contents, so it can live in an atom

There is no `ready` state. The document on display being non-`null` is what that would mean.

Nodes in the layer tree hold no pixels. Pixels live on the ref side, and a node holds only an id into it.

**Parsing and compositing happen in a worker.** `DropZone` only writes the `File` it receives into an atom; talking to the worker and drawing are `CanvasViewport`'s job, through `usePsdDocument` (`hooks/psdHooks.ts`). The reasoning is in [ADR-0004](../adr/0004-worker-offloading.md).

Drawing is concentrated in `CanvasViewport` because a ref is per-component. Putting it in a shared parent would make `app/page.tsx` `"use client"`, which collides with [react.md](../../.claude/rules/react.md)'s rule about pushing the boundary toward the leaves.

### Failure cases

| Situation | Behavior |
| --- | --- |
| Not a PSD, or corrupt | Catch `readPsd`'s exception and show the failed filename and the error along the bottom. **The document on display is not replaced**, so the previous render and layer panel stay |
| Another file opened mid-load | Accept it and replace. Terminating the running worker is enough to cancel, so input never has to be blocked |
| Document size over the limit | Error out before compositing starts. **Both the longest edge and the area are checked** (below) |
| Too many pixels in total | `readPsd` throws `Error("Exceeded memory limit")`. `totalMemoryLimit` is a cumulative budget drawn down by every layer and mask decoded, and `parse.ts` sets **4GB** explicitly (`ag-psd` defaults to 2GB, which 100MB-class PSDs were hitting). This message alone is rewritten to say the PSD is too large to read |
| 16-bit and 32-bit PSDs | `imageData` is not an `ImageData`, so `putImageData` cannot take it. Error out for the whole file and do not open it |
| A layer with no pixels (an adjustment layer, say) | Skip drawing it, but show it in the panel. Mark it unsupported |
| A blend mode with no matching operation | Fall back to `normal` and carry on drawing. Mark it unsupported |
| A layer carrying layer effects | Draw `imageData` as it is, with the effects not reproduced. Mark it unsupported |
| `name` is `undefined` | Display the `UNNAMED_LAYER` placeholder |

Unsupported elements are surfaced at three levels.

1. A mark on the row in the panel
2. Hovering the mark shows the reason in a tooltip (an adjustment layer is not drawn; no compositing operation matches blend mode `vivid light`; and so on)
3. A one-line count in the panel header (3 unsupported)

The header count exists because on a PSD with many layers a mark can sit below the fold. **A file with unsupported elements still opens, drawn as far as it can be.** The point of this version is being able to judge whether the picture is right, so nothing is skipped silently.

## Technical design

### File layout

```
lib/psd/
├─ parse.ts       ← wraps readPsd, fixing the options
├─ tree.ts        ← ag-psd Layer → the app's LayerNode. Inverts visible, propagates pass-through opacity, flags unsupported
├─ blendMode.ts   ← the blend mode table and the fallback
├─ mask.ts        ← moves a mask's R channel into alpha
├─ limits.ts      ← the edge and area checks
└─ composite.ts   ← recursive compositing, isolated model

lib/psd/worker.ts        ← the worker itself. Parsing and compositing
lib/psd/workerMessage.ts ← the types of the messages exchanged

hooks/
└─ psdHooks.ts    ← usePsdDocument. Talks to the worker and draws

components/
├─ file-import/DropZone.tsx     ← only writes the File into an atom
├─ viewer/CanvasViewport.tsx    ← calls usePsdDocument and does the drawing
├─ viewer/ZoomToggle.tsx
├─ layers/LayerPanel.tsx
├─ layers/LayerRow.tsx
└─ ui/Tooltip.tsx

atoms/
├─ document.ts
├─ layers.ts
└─ viewport.ts
```

`app/page.tsx` only assembles these. `app/psd-check/page.tsx` gets deleted once this version is finished — a comment at the top of that file says so.

### Data flow

```
DropZone            sets the load attempt to {status:"parsing", file}
 → CanvasViewport   usePsdDocument creates a worker and transfers the ArrayBuffer
   ┌─ Worker ────────────────────────────────────────┐
   │ initializeCanvas  hand it an OffscreenCanvas (required) │
   │ → parse.ts        readPsd (synchronous; stalling here is fine) │
   │ → limits.ts       the edge and area checks       │
   │ → tree.ts         LayerNode[] + the pixel table  │
   │ → composite.ts    recursive compositing into an OffscreenCanvas │
   │ → getImageData    take out the RGBA and transfer it │
   └──────────────────────────────────────────────────┘
 → CanvasViewport   draw once with putImageData. Terminate the worker
   → replace the document on display, return the load attempt to idle
```

On a failure anywhere along the way, the load attempt is set to `error` and the document on display is left alone.

`LayerPanel` only reads `atoms/layers.ts`; it takes part in neither parsing nor drawing.

`tree.ts` and `composite.ts` are separate to suit the [testing conventions](../../.claude/rules/testing.md). Computing drawing parameters is concentrated in pure functions on the `tree.ts` side, keeping the canvas writes thin.

### Compositing algorithm (isolated model)

Walk nodes in `children` order, back to front, drawing by these rules.

- **A layer** — `putImageData` its `imageData` into its own `OffscreenCanvas`, then apply the layer mask by the procedure below if there is one. `drawImage` the resulting buffer into the parent buffer with `blendMode` and `opacity` applied. `imageData` is typed `PixelData`, a different thing from `ImageData`, so narrow with `data instanceof Uint8ClampedArray` before handing it to `putImageData` (see [the ag-psd notes](../ag-psd-notes.md))
- **A group whose `blendMode` is not `"pass through"`** — make its own `OffscreenCanvas` and draw the children into it recursively. Apply the group's mask to that buffer, then `drawImage` it into the parent with the group's `blendMode` and `opacity`
- **A `"pass through"` group** — draw the children **straight into the parent's buffer**. The group's `opacity` is multiplied into the children's and passed down
- **A layer with `clipping: true`** — below
- **A node whose `visible` is `false`** — skipped, groups and all

`opacity` is expressed through the canvas's `globalAlpha` and `blendMode` through `globalCompositeOperation`. `imageData` is sized to the layer bounds, so it is placed with an offset into document coordinates.

#### Where group opacity gets applied

**A group's `opacity` must not be applied in both `tree.ts` and `composite.ts`.** Where it goes depends on the kind of group.

| Kind of group | Where it is applied | Why |
| --- | --- | --- |
| `"pass through"` | `tree.ts` multiplies it into the children's `opacity` | It has no buffer of its own, so the children are the only thing to apply it to |
| Anything else (isolated) | `composite.ts` applies it with `globalAlpha` when drawing into the parent | Compositing into one buffer and then applying it is what Photoshop does. Multiplying it into the children makes the places where children overlap come out darker |

An isolated group's `opacity` stays on the group node in `tree.ts`. Applied in both places, a 100% layer inside a 50% group ends up at 25%.

The line in [the ag-psd notes](../ag-psd-notes.md) — "`ag-psd` does not hand back an opacity accumulated down from the ancestors" — **does not mean `tree.ts` should always do the multiplying.** In the isolated model, `composite.ts` takes on the isolated groups' share.

### The size of intermediate buffers

**Buffers are not allocated at document size. Use the union of the descendant layers' bounds, clamped to the document rectangle.** A group whose union is empty is skipped, drawing and all.

At document size, the 16384px edge limit would make each one about 1GB. Isolated groups are alive simultaneously to the depth of the nesting, so depth 5 is 5GB. Even a practical PSD falls apart once groups nest 10 deep.

A child's buffer is freed as soon as it has been drawn into its parent, so siblings at the same depth are never alive at once.

### The blend mode table

The approach is settled in [ADR-0002](../adr/0002-blend-mode-mapping.md). **Support the 17 that map onto Canvas 2D's `globalCompositeOperation`, fall back to `normal` for the remaining 10, and mark those unsupported.** No pixel math of our own.

What can actually appear on `layer.blendMode` is the 28 values `ag-psd`'s `toBlendMode` returns. `pass through` decides whether a group is isolated and is not a compositing operation, so it is not in the table. The remaining 27 break down as:

| | Members |
| --- | --- |
| 16 that match by name | `normal`, `darken`, `multiply`, `color burn`, `lighten`, `screen`, `color dodge`, `overlay`, `soft light`, `hard light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity` |
| 1 that maps under a different name | `linear dodge` → `lighter` (additive compositing; agrees when the backdrop is opaque) |
| 10 with no mapping | `dissolve`, `linear burn`, `darker color`, `lighter color`, `vivid light`, `linear light`, `pin light`, `hard mix`, `subtract`, `divide` |

`blendMode.ts` holds a `Record<BlendMode, GlobalCompositeOperation | null>`; on `null` it records the layer as unsupported and carries on drawing with `source-over`.

`soft light` and the non-separable modes (`hue`, `saturation`, `color`, `luminosity`) are confirmed to match on real PSDs. `linear dodge` comes out more opaque than it should only over a semi-transparent backdrop, and shows no mark (the reasoning is in ADR-0002).

### Loading indicator and cancellation

`readPsd` is synchronous, but it runs in a worker, so the main thread does not stall. The loading indicator paints normally, and collapsing a group or switching scale keeps working during a load.

**A file arriving mid-load is accepted and replaces the current one.** `terminate()` on the running worker is enough to cancel, so input never has to be disabled. There is no other way to stop a `readPsd` running synchronously.

Parsing used to happen on the main thread, which required waiting two `requestAnimationFrame`s just to get the loading indicator painted once. **Moving to a worker made that workaround unnecessary.**

### Document size limits

**The longest edge is not enough on its own. Check both the edge and the area.** A browser canvas is constrained on both, and Chrome's area limit is 268,435,456px (exactly 16384×16384). Testing only for a 16384px edge lets a 16384×16384 PSD through into the area limit.

The area limit is derived from memory. What gets allocated at document size is three surfaces — the display canvas, the root buffer, and the RGBA being transferred — split across the worker and the main thread.

| Limit | Provisional value | Basis |
| --- | --- | --- |
| Longest edge | 16384px | Matches Chrome's and Firefox's edge limit |
| Area | 67,108,864px (8192×8192 equivalent) | 268MB each, about 800MB for three. That sits on top of `ag-psd`'s decoding (up to 2GB) |

Both values are provisional and get adjusted by measurement. The check runs after `readPsd`, so `ag-psd`'s decoding memory is already allocated by then. **The area limit governs what can be stacked on top of that.**

### Applying a layer mask

**`mask.imageData` must not be applied with `"destination-in"` as it is.** `ag-psd` copies the mask's value into each RGB channel and returns alpha at 255 everywhere. `destination-in` looks at the source's alpha, so applied directly it ignores the gradations and produces nothing but a rectangular cut at the mask's bounds.

`lib/psd/mask.ts` holds this procedure as a pure function.

1. Make an `ImageData` the same size as the layer buffer
2. Fill its alpha everywhere with `mask.defaultColor` (0 or 255, the value outside the mask rectangle)
3. At the mask rectangle's position, write the R channel of `mask.imageData` in as alpha
4. `putImageData` the result into a scratch buffer and apply it to the layer buffer with `globalCompositeOperation = "destination-in"`

Step 2 is needed because `destination-in` affects the whole destination, including the area outside what was drawn. When the mask rectangle is smaller than the layer and `defaultColor` is 255 — meaning the area outside is visible — skipping that step erases it.

Any of the RGB channels would do; R is used consistently. A mask whose `disabled` is `true` is not applied.

A group's mask follows the same procedure, applied to the group's buffer.

### Compositing a clipping mask

A layer with `clipping: true` is treated as one run together with the nearest non-clipping layer below it (the base). A buffer is made for the run and processed in this order.

1. Draw the base into the buffer with `normal` and opacity 1
2. Stack the clipping layers on top, each with its own `blendMode` and `opacity`
3. Apply `"destination-in"` with the base's alpha, dropping everything outside the base's opaque area
4. Composite the whole run into the parent buffer **with the base's `blendMode` and `opacity`**

The base's `blendMode` and `opacity` are used in step 4 rather than step 1 to match Photoshop's behavior when "blend clipped layers as group" is on. If the base is multiply and the multiply were applied in step 1, the clipping layers would sit on top of an already-multiplied base and the picture would change.

`ag-psd` exposes that setting as `layer.blendClippendElements` (**spelled exactly that way, not `blendClipped`**). It is `undefined` when the PSD has no such block, and since Photoshop's default is on, `undefined` is treated as `true`. **An explicit `false` does not fit this rule, so the layer is marked unsupported and drawn by the `true` rule anyway.** The `false` branch is not implemented.

`composite.ts` touches no DOM and works entirely through `OffscreenCanvas` and `ImageData`. That paid off: moving to a worker in [ADR-0004](../adr/0004-worker-offloading.md) took no changes to `lib/psd/`.

### Releasing resources

Intermediate compositing buffers stay inside the worker and are discarded with it. All the main thread holds is the composited RGBA, replaced when a new file is opened. A single PSD can be hundreds of megabytes of pixel data, so a leak leads straight to exhaustion.

**Do not transfer an `ImageBitmap` out of the worker.** In Chrome it is backed by the worker's lifetime, and terminating after the transfer loses the contents ([ADR-0004](../adr/0004-worker-offloading.md)).

An intermediate buffer is freed the moment it has been drawn into its parent, not carried through to cleanup.

The only thing that triggers a redraw in this version is opening a file, so no **frame coalescing** through `requestAnimationFrame` is added. It comes in with visibility toggles and an opacity slider.

## Alternatives considered

- **Always flatten groups** — the simplest to implement, but with group opacity below 100% and children overlapping, the overlap comes out darker and the picture differs from Photoshop. Intermediate buffers are needed for masks anyway, so the difference in implementation cost against the isolated model is small
- **Split into a Web Worker from the start** — it keeps the UI from freezing on large PSDs, but adds work in telling a compositing bug apart from something broken in transfer. `OffscreenCanvas` works on the main thread too, so writing `composite.ts` free of the DOM keeps the migration cheap. **This was later overturned.** With compositing confirmed correct, the worry about telling failures apart went away, and [ADR-0004](../adr/0004-worker-offloading.md) moved it into a worker. `lib/psd/` moved unmodified
- **Skip blend modes and composite everything normally** — blend modes are the very reason [ADR-0001](../adr/0001-psd-parser.md) chose `ag-psd`, so dropping them collapses the premise of that choice
- **Add zoom and pan** — genuinely wanted in a viewer, but the zoom-center math, clamping at the edges, and wheel event handling are all work, and a different job from getting compositing right

## Open questions

- **What to do about `realMask`** — a second mask slot alongside `mask`. How real data fills it in has not been checked
- **What to do about vector masks** — `vectorMask` holds path data only, with no rasterized pixels. Drawing the path would be on us, so the leaning is to leave it out this time, but that is not settled
- **A `"pass through"` group carrying opacity or a mask** — Photoshop appears to isolate it, but this has not been checked against real data. Start with the spec's rule, drawing pass-through groups straight into the parent buffer, and switch to isolating if the picture does not match
- **The actual limit values** — 16384px on the edge and 67,108,864px of area are both provisional and get adjusted by measurement, since browsers differ. The shape of the check — both edge and area — and the division of responsibility are settled. `ag-psd`'s decoding is watched cumulatively by `totalMemoryLimit`, so `limits.ts` covers **the canvas dimension and area limits, and the memory of the buffers stacked on top**
- **`fillOpacity`** — readable as 0-1 at `layer.fillOpacity`, and a different thing from `opacity`. Not handled this time; whether a value below 1 should raise an unsupported mark is undecided

## How to verify

### Unit tests (Vitest)

Bring in Vitest and test the pure functions in `lib/` per the [testing conventions](../../.claude/rules/testing.md). `test/setup.ts` supplies the `initializeCanvas` stub.

- `tree.ts` — `children[0]` is treated as backmost / **a `"pass through"` group's opacity is multiplied into its children** / **an isolated group's opacity is not, and stays on the group node** / a node with `hidden: true` becomes `visible: false` / an `undefined` `name` becomes the default
- `blendMode.ts` — a mode with no matching operation falls back to `normal` and is recorded unsupported / no value of `BlendMode` throws. **Do not write a copy of the table itself into the tests.** Asserting that `"multiply"` maps to `multiply` cannot catch an error in the table, because the expected value comes from the same place the table does. Whether the mapping is right is judged by the side-by-side comparison (stage 2)
- `mask.ts` — the mask's R channel moves into alpha / outside the mask rectangle is filled with `defaultColor` / a mask with `disabled: true` is not applied
- `limits.ts` — a document over the edge limit is rejected / a document within the edge limit but over the area limit is rejected (16384×16384 being the case in point) / both pass when exactly at the limit

### Side-by-side comparison

Put verification PSDs in `test/fixtures/` and compare against **Alpaca Studio**. Photoshop is not available here, so the reference is another app that displays PSDs roughly faithfully. What each file is for goes in `test/fixtures/README.md` (not written yet).

**Before comparing, turn the unsupported elements off on the other side too.** Hide adjustment layers and uncheck layer styles. With the same things removed from both, every remaining difference can be judged a compositing bug.

Without that step the comparison does not hold up. An adjustment layer changes the color of everything below it, and a layer effect draws outside the layer bounds, so **not applying them makes the difference show up on layers that carry no unsupported mark.** The rule "everything without a mark matches" cannot be used as it stands.

**That the reference is not Photoshop itself is accepted.** The difference between Alpaca Studio and Photoshop cannot be checked here, so a blend mode where those two disagree would be missed.

| Fixture | Stage | What it checks |
| --- | --- | --- |
| A simple stack (3 layers, all normal) | 1 | The stacking order is not reversed |
| Nested isolated groups (`blendMode` `"normal"`) with group opacity 50%, two overlapping layers inside | 1 | Group opacity reaches the children. The overlap does not darken. Opacity is not applied twice, landing at 25% |
| A `"pass through"` group with opacity 50%, two overlapping layers inside | 1 | How a pass-through group's opacity behaves. If the reference isolates, this matches the row above; otherwise the overlap darkens. Used to settle the open question |
| Some layers and groups hidden | 1 | `hidden`'s inversion is not backwards. A hidden group disappears with its contents |
| Multiply and screen layers | 2 | Blend modes take effect |
| A multiply layer inside a `"normal"` group | 2 | The multiply does not leak outside the group (it is isolated) |
| A multiply layer inside a `"pass through"` group | 2 | The multiply reaches the background outside the group |
| A layer with a mask, the mask rectangle made smaller than the layer | 3 | The mask clips. Outside the mask rectangle does not disappear |
| A clipping mask with the base set to multiply | 3 | It shows only over the opaque part of the layer below. The base's multiply takes effect |
| Something containing an adjustment layer and layer effects | 1 | The mark and tooltip appear. The file still opens |

### Definition of done

Cut into three stages. Each depends on the one below it, but **whatever stage the work stops at, something that runs is left behind.**

| Stage | Covers | Done when |
| --- | --- | --- |
| 1 | Opening a file, the layer tree, stacking order, visibility, the unsupported UI. Includes **the skeleton of the isolated model** — per-group buffers, group opacity, the `"pass through"` branch. Every blend mode treated as `normal` | The stage 1 fixtures match |
| 2 | The blend mode table | The stage 2 fixtures match |
| 3 | Layer masks and clipping masks | The stage 3 fixtures match |

**The isolated model's skeleton goes in stage 1, not stage 2.** Getting group opacity right requires per-group buffers. Multiplying into the children and drawing into one surface darkens the overlaps, which fails what the stage 1 fixture checks ("the overlap does not darken"). All stage 2 adds is the `blendMode` table.

The unsupported UI — mark, tooltip, count — goes in stage 1. It can be built independently of how compositing progresses, and stages 2 and 3 need it to make their own judgments. At stage 1 there is no table yet, so the only things marked are adjustment layers and layer effects.

This version is finished when stage 3 passes and `npm test` passes.
