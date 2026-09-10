---
status: proposed
date: 2026-09-08
---

# Decode layers one at a time, and budget memory by what is alive at once

> **On hold. Not implemented.** Arguing against the finished document showed that the decision criteria did not match the symptoms actually observed, and that a cheaper option had been missed. See "Put on hold after the counter-argument". Try the cheap fixes first, then decide again against whatever symptoms are left.

## Context

Opening 100MB-class PSDs one after another really did make the app sluggish and unresponsive during loading.

`ag-psd` **decodes every layer at `readPsd` time and holds all of them until compositing finishes**. The compositing side (`lib/psd/composite.ts`) draws one at a time and frees as it goes, so it does not multiply, but the pile of decoded layers stays.

Part of the cause is already fixed. `hooks/psdHooks.ts` was holding on to decoded pixels it had no further use for, which kept two documents' worth in memory for the whole time the next file was loading. Dropping them brought the peak on every load after the first down substantially.

What is left is the one document's worth of decoded pixels, and reducing that means deferring the decode itself. `ag-psd` can stop decoding with `useRawData: true` and then decode one layer at a time with `decodeLayerPixels`.

The catch is that **taking that route disables `totalMemoryLimit`** (2GB by default), because decoding moves to `decodeLayerPixels`, which the budget is never handed to. How to hold a ceiling instead is what gets decided here. The scope is `lib/psd/parse.ts`, `tree.ts`, `composite.ts`, and `limits.ts`. The spec is [the PSD viewer's first version](../design/psd-viewer-v1.md).

## Decision criteria

"Do not crash" comes first. Anything that cannot be opened should **stop with a clean error**. A killed tab takes the previously open document with it, which makes the spec's rule that a failure leaves the previous render intact worthless.

Second is opening more files. That is the motivation for the change in the first place — PSDs over 120MB cannot currently be opened.

## Options considered

**Whether to defer decoding**

- Decode one layer at a time
- Keep decoding everything up front
- **Pass a larger `totalMemoryLimit` to `readPsd`** (added later, see below)
- **Move compositing to a Web Worker** (added later, see below)
- Survey a few PSDs on hand before deciding

The last two came out of arguing against the finished document. **Neither was in the original round.**

`totalMemoryLimit` is in `ReadOptions` and can be passed by the caller (2GB by default; passing `undefined` explicitly disables it). **The benefit "PSDs over 120MB become openable" is available from that one-line change too.** It is not something only deferred decoding provides.

A worker acts directly on the "unresponsive while loading" symptom. Deferred decoding only moves decode time into compositing; it does not shorten the freeze.

**How to hold the ceiling**

- Estimate what is alive at once, before decoding, and reject
- Estimate the decoded total and reject (reproducing what `totalMemoryLimit` means, by hand)
- Hold no ceiling and catch allocation failures with `try`/`catch`

**What to do when the budget is exceeded**

- Refuse to open, with an error
- Show the estimate and let the user decide whether to open it
- Open it with layers thinned out to fit the budget

## Decision

**Decode one layer at a time. Hold the ceiling by estimating what is alive at once, before decoding, and error out without opening when it is exceeded. The budget is 1GB as the formula measures it.**

### Why deferred decoding

Measurement bore it out. On a PSD of 50 full-canvas layers (572MB decoded), the load peak fell from +1270MB to +352MB. The rendered result was identical, with masks, blend modes, and group opacity all matching.

It also makes PSDs over 120MB, which were hitting `totalMemoryLimit`, openable.

### Why the ceiling watches what is alive at once

**Deferred decoding never holds the decoded total at once.** Judging on the total would reject files that in fact open. That looks like failing safe, but it is a different failure from the top criterion, not an instance of it.

Layer rectangles are available as soon as the file is read with `useRawData: true` (confirmed against real data). **The size can be judged before any memory is spent**, which stops things earlier than `ag-psd`'s incremental budget does.

"Catch allocation failures" was rejected: running out of memory in a browser does not always raise — it can take the tab down — which fails the top criterion. **The option has a fair point, though.** The threshold is guesswork either way, and the same PSD behaves differently depending on free memory, which a fixed number knows nothing about. That weakness carries forward into "Unconfirmed" below.

### The estimation formula

Computed to match what `composite.ts` actually does.

```
compressed data (roughly the file size)
  + isolated group buffers (the largest total along any root-to-leaf path;
    each one covers the union of its descendants, clipped to the document)
  + the largest single decoded layer
  + one document's worth × 2 (the root buffer doubling as the ImageBitmap, and the display canvas)
```

**The root buffer and the ImageBitmap are not alive at the same time.** `transferToImageBitmap` transfers rather than copies; measured, the source canvas reads `[0,0,0,0]` afterwards, its contents having moved into the ImageBitmap. The formula originally said × 3, one document too many. The estimate for real data is **407MB**, not 465MB.

**Group buffers must not be measured as document area × depth.** On real data (4200×3600, 17 groups, 7 levels at most) the naive figure is 404MB where computing what the implementation does gives 120MB. A 3.4× overestimate, falling on the side of rejecting files that would open.

### Why the budget is 1GB

The estimate for real data is 407MB, which clears it with more than 2× of headroom. At 500MB the headroom is only 93MB, and a few more layers would make the file unopenable.

Given how coarse the formula is (below), a tight number means nothing. **Its job is to stop outrageous files, nothing more.**

### Consequences

- Good: the load peak drops on 100MB-class PSDs. About 230MB less on real data
- Good: PSDs over 120MB, which were hitting `totalMemoryLimit`, become openable
- Good: the check happens before memory is spent. Unlike `ag-psd`'s incremental budget, nothing is discovered only after allocating
- Good: the estimate is a pure function in `lib/`, so it can be unit tested
- Bad: **it gives up `totalMemoryLimit` as a safety net.** The backstop that watched the total is gone, leaving only the hand-written estimate. Nothing stops anything if the formula is wrong
- Bad: **the formula's number and measured RSS do not agree.** RSS measures 2-6× the formula, and the ratio is not stable. 1GB does not predict what RSS will be in gigabytes
- Bad: **the effect on real data is only about 1.5×**, nowhere near the 3.6× seen on a synthetic PSD. That is a small return for a change that reaches across three files
- Bad: decode time moves into compositing. The total is unchanged, but parsing gets faster and compositing slower, which changes how progress appears
- Bad: the implementation mutates `ag-psd`'s Layer objects to discard decoded results. It reaches into the library's internal state

### Unconfirmed

- **Why the ratio between the formula and measured RSS sits anywhere from 2× to 6× has not been pinned down.** Allocator behavior, scratch space during decoding, and RSS counting freed memory are all candidates, but none has been isolated. Making the budget number defensible requires understanding that ratio
- Only one real file has been surveyed. How typical it is for 1 layer in 46 to be full-canvas is unknown. **The size of the saving depends heavily on how the file was made**
- The threshold knows nothing about the user's free memory. `navigator.deviceMemory` is coarse and is not the same as what is actually available. The same PSD opening on one machine and crashing on another remains possible
- Whether `ag-psd` applies some other ceiling along the one-layer-at-a-time decode path has not been checked

## Put on hold after the counter-argument

Running [devils-advocate](../../.claude/skills/devils-advocate/SKILL.md) over the finished document found problems in what the decision rests on, so it is on hold.

### The criteria do not match what was observed

"Do not crash" was made the top criterion because "a killed tab takes the previous document with it" — but **there is no report or measurement of a tab being killed.** What actually happened was these three:

| | Symptom | What helps | Status |
| --- | --- | --- | --- |
| A | Degrades as loads repeat | Use less memory | Very likely handled by the `pixelsRef` fix |
| B | Freezes on every individual load | A worker | Unhandled. **Deferred decoding does not reduce it** |
| C | Over 120MB will not open | Raise `totalMemoryLimit` | Unhandled. One line solves it |

That A took the form "it degrades as you repeat it" is the clue. If the freeze were a constant length, the first load and the eighth would feel the same; degradation is what memory pressure looks like. Holding two documents' worth across a load was exactly that, and it is already fixed.

**This decision only helps A, and A may already be handled.** Realigning the criteria with the facts puts the worker (B) and `totalMemoryLimit` (C) first instead.

### The formula adds up memory of different kinds

The estimate sums decoded pixels (typed arrays) and canvas bytes as if they were the same resource. But **creating an 8192×4096 canvas (128MB worth) and filling it raised RSS by only 9MB.** A canvas's backing store does not show up the way a typed array does.

That means the RSS measurements so far were mostly catching decoded pixels, and the canvas terms of the formula have no measurement behind them. **Only one side of the formula has been checked.**

### There was no reason given for rejecting "hold off and gather data"

It was listed as an option, but no reason was written for not choosing it — while "Unconfirmed" says only one real file has been surveyed. **Admitting the data is thin while rejecting the option to gather more does not hold together.** Surveying can be done safely from metadata alone, and in the event it took a few minutes.

### Cost of backing out

Four files — `parse.ts`, `tree.ts`, `composite.ts`, `limits.ts` — plus the spec's failure-case section. `tree.ts` changes what `PixelStore` holds from `PixelSource` to `Layer`, so backing out means rewriting from the types down.

### The `ag-psd` version is not pinned

This decision rests on `decodeLayerPixels` not receiving a budget, on the timing of `delete layer.rawData`, and on the semantics of `useRawData`. None of those is a documented contract; all were read out of the implementation. `package.json` allows minor updates with `^31.0.2`, so **it can break in a way that silently disables the ceiling.** Adopting it means either pinning the version or holding the ceiling down with a test.

## Notes

- Revisit when a file hits the budget and will not open, or when something inside the budget crashes anyway. The first means the formula overestimates, the second that it underestimates, and both lead back to the ratio problem
- This decision does not overturn [ADR-0001](0001-psd-parser.md). `ag-psd` stays; only how its read options are used changes
- Implementing it would require rewriting the spec's failure cases. The row about "too many pixels in total" assumes `totalMemoryLimit`'s behavior and would become untrue as written
