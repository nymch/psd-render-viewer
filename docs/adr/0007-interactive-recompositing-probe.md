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

**Recompositing on every toggle means the decoded pixels have to stay alive.** `PixelStore` holds every decoded layer, which is the pile [ADR-0003](0003-deferred-layer-decoding.md) set out to shrink and [ADR-0004](0004-worker-offloading.md) disposed of by throwing the worker away after each load.

**The result has to reach the screen without a document-sized copy per toggle.** ADR-0004 transfers an RGBA `ArrayBuffer` and calls `putImageData` on the main thread. At 4200×3600 that is about 60MB per toggle, and at the 8192×8192 area limit, 268MB.

The scope of this decision is a probe on its own route, plus the ADR you are reading. It touches no file under `lib/psd/`.

## Decision criteria

1. **Do not break the working viewer.** Stages 1 through 3 of the spec and 46 tests are tied to the current design, and a probe needs somewhere to fall back to
2. **Put no constraints on the PSD.** The files are whatever a user brings; a model that only works on certain files cannot be judged from a probe
3. **A toggle has to feel immediate**
4. **Sustained memory has to hold up**

Memory sits last **because it is what gets measured here, not a constraint decided in advance.** ADR-0003's unresolved point is that the ratio between its formula and measured RSS ran anywhere from 2× to 6× with no explanation, and it still set a 1GB budget. Setting another number before measuring would repeat that.

## Options considered

**How a toggle produces a new picture**

- Keep the decoded pixels alive and recomposite from them
- Render each toggleable unit once, then stack the resulting images
- Re-parse the file on every toggle

**How the picture reaches the canvas**

- Transfer an RGBA `ArrayBuffer` per toggle, as ADR-0004 does
- Hand the canvas to the worker with `transferControlToOffscreen`

**Where the probe lives**

- A separate route, as `app/psd-check/page.tsx` was for parsing
- Convert the existing viewer
- Do not probe; design from the spec alone

## Decision

**Keep the decoded pixels alive in a long-lived worker, give that worker the canvas through `transferControlToOffscreen`, and put the whole thing on a route of its own.** The first version toggles visibility only, for a layer or a layer group. Opacity, and grouping defined outside the PSD's own, come later.

Re-parsing per toggle was dropped immediately: a load measures 320-480ms on a 105MB file.

**Stacking pre-rendered units loses on criterion 2.** It is exact only when a toggleable unit is *isolated* — contiguous in draw order, and free of any blend mode that expects to mix with what lies outside the unit. Rendering a multiply layer on its own multiplies it against transparency instead of the backdrop, which is a different picture. Restricting to whole layer groups does not rescue it, and neither does restricting to single layers. It would mean constraining which blend modes may appear inside a switchable unit, and whether that constraint is tolerable cannot be judged without real files of the kind this is aimed at. **It stays as the fallback if memory does not hold.**

**`transferControlToOffscreen` was rejected once, conditionally.** ADR-0004 turned it down because "a canvas element can only be transferred once, which does not go together with disposable workers". The worker here is not disposable, so the reason does not apply. Transferring the canvas once removes the per-toggle copy entirely.

**A separate route wins on criterion 1**, and it buys something else: the existing viewer becomes the reference for correctness. The same PSD opened in both, with the same layers visible, has to produce the same picture — a machine-checkable oracle, which the side-by-side comparison against Alpaca Studio is not.

**[ADR-0004](0004-worker-offloading.md) is not superseded.** Its decision remains right for a viewer that composites once and shows a picture. What changes is that its reasoning turns out to be scoped to that case, which nothing in it said.

### What the probe has to answer

1. **Can a worker draw into a canvas received through `transferControlToOffscreen`?** The one pass-or-fail item, and the first to settle. `ag-psd` already runs against an `OffscreenCanvas` inside the worker, but a transferred canvas is a separate question
2. Does a toggle produce the same picture as the current viewer with the same layers hidden?
3. How long does one toggle take? **Recorded, not judged against a threshold set now**
4. How far does sustained RSS climb across a session on real data? **Recorded, not judged against a threshold set now**

Out of the probe: anything built on top of it — exporting a result, the UI for defining switchable units, and whatever consumes either.

### Consequences

- Good: nothing under `lib/psd/` changes. `parse.ts`, `tree.ts`, `composite.ts`, `mask.ts`, and `blendMode.ts` are already free of the DOM and already express visibility as a field `drawNodes` skips on, so toggling is a rebuilt tree and another `compositeDocument` call
- Good: the per-toggle transfer disappears rather than being optimized
- Good: correctness gets an oracle instead of a human comparison
- Good: the viewer keeps working throughout, and a failed probe costs one route
- Bad: **two worker protocols exist side by side.** They share `lib/psd/` but not their message types or lifetimes, so a change to what the worker returns may have to be made twice
- Bad: **a transferred canvas cannot be touched from the main thread again.** Sizing and clearing become the worker's job, and switching documents needs either a canvas the worker resizes or a remounted element. Which one is not decided here
- Bad: **decoded pixels live for a whole session.** Peak memory is unchanged, since `readPsd` already decodes everything up front and holds it until compositing ends — what changes is how long it is held, and that is the risk the probe exists to size
- Bad: the oracle is a viewer verified only against Alpaca Studio, so a fault shared by both routes stays invisible
- Bad: **no spec, so the route is documented by a comment.** `app/psd-check/page.tsx` set that precedent and is still here, having been slated for deletion since the spec was written. A probe outliving its purpose is the failure mode

## Notes

- Revisit when criterion 4 fails. The move then is to pre-rendered units, which brings back the isolation constraint and needs real files of the intended kind to judge
- **[ADR-0003](0003-deferred-layer-decoding.md) may come back.** ADR-0004 concluded that "almost nothing is left of the motivation for deferred decoding" — true under a disposable worker. Holding one document alive for a session restores exactly the motivation it had
- Switchable units defined outside the PSD's own grouping stay possible under the pre-rendered model, provided each unit is isolated in the sense above. A unit does not have to match a layer group
- Opacity toggling is deferred, not rejected. `renderOpacity` is computed in `buildLayerTree`, with a pass-through group's share multiplied into its children, so an override has to recompute it down the subtree rather than set a field
- Writing this ADR started from a different question — whether `usePsdDocument` should shed its Jotai dependency to become reusable. It should not: Jotai is one of four couplings, and the hook's shape changes anyway once the worker outlives a single load. The two-jobs problem in that hook resolves on its own here, since handing the canvas to the worker removes the drawing effect from the main thread
