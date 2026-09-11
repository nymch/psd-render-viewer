---
status: proposed
date: 2026-09-10
---

# Probe interactive recompositing on a long-lived worker that owns the canvas

> **Settled, not on hold.** Unlike [ADR-0003](0003-deferred-layer-decoding.md), nothing here is waiting on a reconsideration. The status is `proposed` because none of it is built yet.

## Context

A direction this code may take later needs something the viewer explicitly does not do: **toggle a layer's visibility and show the result immediately.** The spec puts editing under out of scope and composites once per file, and [ADR-0002](0002-blend-mode-mapping.md) ranked rendering speed last on exactly that basis, noting the ranking "can change once visibility toggles and an opacity slider are added". That is the change.

**What that direction is, and what gets built on the result, is decided elsewhere.** This ADR covers only whether the mechanism works.

Two things follow, and both cut against decisions already made here.

**Recompositing on every toggle means the decoded pixels have to stay alive.** `PixelStore` holds every decoded layer, which is the pile [ADR-0003](0003-deferred-layer-decoding.md) set out to shrink and [ADR-0004](0004-worker-offloading.md) disposed of by throwing the worker away after each load. Concretely it means deleting `pixels.clear()` at `lib/psd/worker.ts:92`, which today drops the store the moment compositing finishes.

**The result has to reach the screen without a document-sized copy per toggle.** ADR-0004 transfers an RGBA `ArrayBuffer` and calls `putImageData` on the main thread. At 4200×3600 that is about 60MB per toggle, and at the 8192×8192 area limit, 268MB.

The scope of this decision is a probe on its own route, plus the ADR you are reading. It touches no file under `lib/psd/`.

## Decision criteria

1. **Do not break the working viewer.** Stages 1 through 3 of the spec and 46 tests are tied to the current design, and a probe needs somewhere to fall back to
2. **Put no constraints on the PSD.** The files are whatever a user brings; a model that only works on certain files cannot be judged from a probe
3. **A toggle has to feel immediate**
4. **Sustained memory has to hold up**

Memory sits last **because it is what gets measured, not a constraint decided in advance.** ADR-0003's unresolved point is that the ratio between its formula and measured RSS ran anywhere from 2× to 6× with no explanation, and it still set a 1GB budget. Setting another number before measuring would repeat that.

## Options considered

**How a toggle produces a new picture**

- Keep the decoded pixels alive and recomposite from them
- Render each toggleable unit once, then stack the resulting images
- Re-parse the file on every toggle

**Where the recompositing runs**

- On the main thread, since `composite.ts` touches no DOM and needs only `OffscreenCanvas`
- In a worker

**How the picture reaches the canvas**

- Transfer an RGBA `ArrayBuffer` per toggle, as ADR-0004 does
- Hand the canvas to the worker with `transferControlToOffscreen`

**Where the probe lives**

- A separate route, as `app/psd-check/page.tsx` was for parsing
- Convert the existing viewer
- Do not probe; design from the spec alone

**Before any of the above**

- Measure what one recomposite costs, using the viewer as it stands
- Decide from the shape of the code

## What measurement showed

The cost of a recomposite was unknown, and every option above turns on it. It is measurable without building anything: a recomposite is `compositeDocument` called again, so the existing worker was made to call it twice and time both. Four real files, 58MB to 170MB:

| Document | Nodes | Masked | Cold | **Warm** | Warm per Mpx |
| --- | --- | --- | --- | --- | --- |
| 2101×3000 (6.3Mpx) | 434 | 0 | 55ms | **15ms** | 2.4ms |
| 5400×7650 (41.3Mpx) | 48 | 0 | 1110ms | **347ms** | 8.4ms |
| 2385×3830 (9.1Mpx) | 40 | 6 | 178ms | **66ms** | 7.2ms |
| 3975×4624 (18.4Mpx) | 94 | 16 | 130ms | **36ms** | 2.0ms |

**Masks cost nothing worth counting.** `buildMaskAlpha` runs a per-pixel loop for every masked layer on every composite, which looked like the obvious hazard. The file with the most masks is the cheapest per pixel. Nothing in these numbers separates masked files from unmasked ones.

**Document area does not predict the cost.** The per-pixel figure spans 2.0ms to 8.4ms, a factor of four. What does line up is node count running *against* area: the two files with few nodes are the expensive ones per pixel, and the two with many nodes are the cheap ones. That fits cost being driven by the total area actually drawn — the sum of each layer's own rectangle plus the group buffers — where few large layers cost more than many small ones. The instrumentation did not record drawn area, so this explains the numbers rather than being demonstrated by them.

**A file's own first composite predicts its toggle cost.** The cold-to-warm ratio is 3.7, 3.2, 2.7, and 3.6 — call it 3.3. Cost cannot be read off a document's dimensions, but it can be read off one measurement the app already performs while loading.

## Decision

**Keep the decoded pixels alive in a long-lived worker, give that worker the canvas through `transferControlToOffscreen`, and put the whole thing on a route of its own.** The first version toggles visibility only, for a layer or a layer group. Opacity, and grouping defined outside the PSD's own, come later.

Re-parsing per toggle was dropped immediately: a load measures 320-480ms on a 105MB file, and the measurements above put parsing at 553-2532ms.

**Compositing on the main thread is out, on the strength of one file.** `composite.ts` would run there unmodified, and for three of the four files it would be fine — 15ms, 36ms, and 66ms. The fourth costs 347ms, which is twenty dropped frames per toggle. Criterion 2 forbids answering that by ruling the file out.

**Stacking pre-rendered units loses on criterion 2.** It is exact only when a toggleable unit is *isolated* — contiguous in draw order, and free of any blend mode that expects to mix with what lies outside the unit. Rendering a multiply layer on its own multiplies it against transparency instead of the backdrop, which is a different picture. Restricting to whole layer groups does not rescue it, and neither does restricting to single layers. It would mean constraining which blend modes may appear inside a switchable unit, and whether that constraint is tolerable cannot be judged without real files of the kind this is aimed at. **It stays as the fallback**, and the measurements give it a trigger: a document whose cold composite exceeds roughly a second has a toggle cost over 300ms and wants pre-rendering.

**`transferControlToOffscreen` was rejected once, conditionally.** ADR-0004 turned it down because "a canvas element can only be transferred once, which does not go together with disposable workers". The worker here is not disposable, so the reason does not apply. Transferring the canvas once removes the per-toggle copy entirely.

**A separate route wins on criterion 1.** It also makes the existing viewer usable as a reference: the same PSD opened in both, showing the same layers, has to produce the same picture.

**[ADR-0004](0004-worker-offloading.md) is not superseded.** Its decision remains right for a viewer that composites once and shows a picture. What changes is that its reasoning turns out to be scoped to that case, which nothing in it said.

### Criterion 3 is only partly met, and that is accepted

A worker keeps the main thread free. It does not make the picture arrive sooner. On the 41Mpx file the image still changes 347ms after the click, and no amount of moving work off the main thread shortens that.

Accepted because visibility toggling is a discrete click rather than a drag, three of four files land between 15ms and 66ms, and the fallback for the fourth is named above. **A slider would not survive this**, which is one reason opacity is deferred.

### What the probe still has to answer

1. **Can a worker draw into a canvas received through `transferControlToOffscreen`?** The one pass-or-fail item, and the first to settle. `ag-psd` already runs against an `OffscreenCanvas` inside the worker, but a transferred canvas is a separate question
2. Does a toggle produce the same picture as the current viewer showing the same layers? **The viewer has no way to hide a layer** — `LayerRow` renders `visible` as styling and its only control collapses a group, and the spec keeps editing out of scope. So each compared state needs a PSD authored with that state baked in, which is the same work as `test/fixtures/` in #20. The comparison is exact, but it is not free
3. How far does sustained RSS climb across a session on real data? **Recorded, not judged against a threshold set now**

Cost per toggle is no longer an open question.

Out of the probe: anything built on top of it — exporting a result, the UI for defining switchable units, and whatever consumes either.

### Consequences

- Good: nothing under `lib/psd/` changes. `parse.ts`, `tree.ts`, `composite.ts`, `mask.ts`, and `blendMode.ts` are already free of the DOM and already express visibility as a field `drawNodes` skips on, so toggling is a rebuilt tree and another `compositeDocument` call. Tree rebuilding measured 0-1ms, so the cost of a toggle is the composite and nothing else
- Good: the per-toggle transfer disappears rather than being optimized
- Good: correctness gets a reference implementation instead of a human comparison
- Good: the viewer keeps working throughout, and a failed probe costs one route
- Bad: **two worker protocols exist side by side.** They share `lib/psd/` but not their message types or lifetimes, so a change to what the worker returns may have to be made twice
- Bad: **a transferred canvas cannot be touched from the main thread again.** Sizing and clearing become the worker's job, and switching documents needs either a canvas the worker resizes or a remounted element. Which one is not decided here
- Bad: **decoded pixels live for a whole session.** Peak memory is unchanged, since `readPsd` already decodes everything up front and holds it until compositing ends — what changes is how long it is held, and that is the risk the probe exists to size
- Bad: **the worst measured file takes 347ms per toggle even in a worker.** Criterion 3 is met for three files in four
- Bad: the reference is a viewer verified only against Alpaca Studio, so a fault shared by both routes stays invisible
- Bad: **no spec, so the route is documented by a comment.** `app/psd-check/page.tsx` set that precedent and is still here, having been slated for deletion since the spec was written. A probe outliving its purpose is the failure mode

## Notes

- Revisit when criterion 4 fails, or when a file's cold composite exceeds about a second. Either way the move is to pre-rendered units, which brings back the isolation constraint and needs real files of the intended kind to judge
- **A size limit is the wrong control for this.** `limits.ts` gates on longest edge and area, and area is precisely what fails to predict toggle cost here — the 18.4Mpx file has twice the area of the 9.1Mpx one and still costs less per toggle, 36ms against 66ms. Anything gating interactive mode should measure the first composite rather than the dimensions
- **[ADR-0003](0003-deferred-layer-decoding.md) may come back.** ADR-0004 concluded that "almost nothing is left of the motivation for deferred decoding" — true under a disposable worker. Holding one document alive for a session restores exactly the motivation it had
- The claim that peak memory is unchanged rests on `parse.ts`'s current read options, under which `readPsd` decodes everything up front. Reviving ADR-0003 would make it false
- Switchable units defined outside the PSD's own grouping stay possible under the pre-rendered model, provided each unit is isolated in the sense above. A unit does not have to match a layer group
- Opacity toggling is deferred, not rejected. `renderOpacity` is computed in `buildLayerTree`, with a pass-through group's share multiplied into its children, so an override has to recompute it down the subtree rather than set a field
- **Nothing here decides what a successful probe licenses.** Whether this becomes the basis for later work is a separate decision, and ADR-0003 is the reminder of what happens when one runs ahead of its evidence
- Each of the four criteria decided exactly one thing, and criterion 4 decided nothing. They were written after the options were already understood, so they have not yet had to break a tie
- Writing this ADR started from a different question — whether `usePsdDocument` should shed its Jotai dependency to become reusable. It should not: Jotai is one of four couplings, and the hook's shape changes anyway once the worker outlives a single load. The two-jobs problem in that hook resolves on its own here, since handing the canvas to the worker removes the drawing effect from the main thread
