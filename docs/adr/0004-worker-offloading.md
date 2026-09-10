---
status: accepted
date: 2026-09-10
---

# Move parsing and compositing into a Web Worker, and throw the worker away after each load

## Context

Opening a 100MB-class PSD freezes the UI while it loads. `ag-psd`'s `readPsd` is synchronous, so the main thread stops for the whole parse. On real data (120-170MB, 70 layers) that is long enough to feel.

Three symptoms were reported around the same time, two of which are already fixed by other means.

| | Symptom | Status |
| --- | --- | --- |
| A | Degrades as loads repeat | Fixed. Stopped holding decoded pixels that had no further use |
| C | Over 120MB will not open | Fixed. `totalMemoryLimit` is now set to 4GB explicitly |
| B | **Freezes on every individual load** | **What this decision addresses** |

The deferred layer decoding considered in [ADR-0003](0003-deferred-layer-decoding.md) is a way to use less memory and does nothing for B. It moves decode time into compositing; the stall is the same length.

The [spec](../design/psd-viewer-v1.md) had put Web Workers under out of scope, on the grounds that "getting compositing right is the point, and adding a worker at the same time makes it hard to tell a wrong picture from a transfer problem". **Compositing has since been confirmed correct against real data, so that reason has lapsed.**

The scope is `lib/psd/worker.ts` (new), `workerMessage.ts` (new), `hooks/psdHooks.ts`, and the two components that receive a file.

## Decision criteria

1. **The UI stays responsive while loading** — this is the symptom being solved
2. **Nothing carries over in memory** — holding on to things is what has repeatedly hurt this project
3. Maintainable by one person

## Options considered

**The worker's lifetime**

- Create one per load and terminate on completion, failure, or replacement
- Create one on the first load and reuse it thereafter
- Reuse by default, but terminate and rebuild when a load is replaced

**How the composited result comes back**

- Transfer an `ImageBitmap`
- Transfer an RGBA `ArrayBuffer` and `putImageData` it on the main thread
- Hand the display canvas to the worker with `transferControlToOffscreen`

## Decision

**Create a worker per load and terminate it on completion, failure, or replacement. Transfer the composited result as an RGBA `ArrayBuffer` rather than an `ImageBitmap`.**

### Why throw it away

It acts directly on criterion 2. Decoded pixels die with the worker, so a leak cannot happen structurally. Cancellation is just a terminate, which is also the only way to stop a `readPsd` that is running synchronously.

Measurement bore it out too. Opening a 105MB PSD (137MB decoded) eight times in a row, steady-state RSS **fell from 1450MB to 1024MB**. Reuse would leave the previous file's remains stacking up.

The cost is paying worker startup every time. Under the same conditions, load time went from 235-360ms to 320-480ms. With the UI no longer stalling, that difference does not register.

### Why not to transfer an `ImageBitmap`

**In Chrome an `ImageBitmap` is backed by the worker's lifetime: terminate the worker and the contents are lost, even after the transfer.**

Found by implementing it and measuring. Compositing was correct inside the worker (the sampled pixel read `[140,100,60,255]`, 40000 opaque pixels), yet the bitmap received on the main thread had the right dimensions and no contents. Removing `terminate()` made it draw correctly, which isolated it.

**Throwing the worker away and transferring an `ImageBitmap` are incompatible.** An `ArrayBuffer` does not depend on a lifetime, so that is what gets transferred. The cost is a `getImageData` read-back plus a `putImageData` on the main thread.

`transferControlToOffscreen` was rejected: a canvas element can only be transferred once, which does not go together with disposable workers.

### Consequences

- Good: collapsing a group in the layer panel and switching zoom both work while a file is loading. Confirmed by measurement
- Good: steady-state RSS fell from 1450MB to 1024MB, a side effect of discarding the whole worker
- Good: dropping another file mid-load replaces the current one. Cancellation is just a terminate, so the input no longer has to be disabled
- Good: the double `requestAnimationFrame` that synchronous parsing required is gone. With the main thread free, the loading indicator paints normally
- Bad: load time went from 235-360ms to 320-480ms — worker startup, the `getImageData` read-back, and the transfer
- Bad: there is one more path. A wrong picture now needs telling apart from a transfer problem, exactly the reason the spec deferred workers
- Bad: **`ag-psd` throws inside a worker unless `initializeCanvas` is called.** Forget it and you get `"Canvas not initialized"`. Its automatic setup in the browser is conditional on `typeof document !== "undefined"`, which a worker does not satisfy
- Bad: the type of `self` does not fit. `tsconfig.json`'s `lib` includes `dom`, so it types as `Window`, and adding `webworker` collides on identifiers. It is handled by writing just the types used and re-casting once with `as`

### Unconfirmed

- Worker startup cost has not been measured on its own. The added load time (around 100ms) also contains the `getImageData` read-back and the transfer
- Whether `ImageBitmap` lifetimes behave the same outside Chrome has not been checked. Safari may keep it alive after the transfer, unverified
- How long the `getImageData` read-back takes on a huge document has not been measured. Reading back from the GPU scales with size, so near the ceiling it may not be negligible

## Notes

- Revisit when the added load time starts to register. The move then is toward reuse, which means guaranteeing that nothing carries over in memory yourself
- This decision does not overturn [ADR-0003](0003-deferred-layer-decoding.md), which stays on hold. With A and C fixed and B solved here, almost nothing is left of the motivation for deferred decoding
- Parsing and compositing in `lib/psd/` moved into the worker unmodified. Writing `composite.ts` free of the DOM — `OffscreenCanvas` and `ImageData` only — paid off exactly as intended
