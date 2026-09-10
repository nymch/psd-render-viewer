---
status: accepted
date: 2026-09-07
---

# Use ag-psd as the PSD parser

## Context

Read a PSD in the browser, show its layer tree, and draw it to a canvas. Per-layer visibility, opacity, and blend mode are to be operable from the UI.

`@webtoon/psd` was picked first and taken as far as a working integration. That established that **the published v0.4.0 does not have the properties a basic viewer needs**, so the choice is being made again.

## Options considered

- `@webtoon/psd` 0.4.0
- `ag-psd` 31.0.2
- Parse the PSD format directly

## Decision criteria

This is a personal project, so the order is:

1. **Whether it can do the job** — blend modes and per-group visibility are the core of the feature and cannot be bolted on later
2. **Whether it is still being developed** — maintained by one person, so a stalled library is a dead end
3. **Speed and size** — considered only where they affect how the app feels

## Decision

`ag-psd` is chosen. **`@webtoon/psd` cannot implement blend modes or per-group visibility, and there is no sign of that changing.**

Measured against the same PSD (400×800, 14 layers, 293KB):

| | @webtoon/psd 0.4.0 | ag-psd 31.0.2 |
| --- | --- | --- |
| Speed | parse 11.6ms + decode 6.0ms = 17.6ms | 25.9ms |
| dist (gzip) | 30KB | 273KB |
| `blendMode` | Unavailable (`undefined`) | `"normal"` |
| Group visibility | Unavailable (`Group` has no `isHidden`) | `hidden: false` |
| `clipping` | Unavailable | `false` |
| `opacity` | 0-255 | 0-1 (normalized) |
| Text layers | — | Available |

The maintenance gap is just as wide.

| | @webtoon/psd | ag-psd |
| --- | --- | --- |
| Latest release | 0.4.0 — 2023-06-27 (3 years 2 months ago) | 31.0.2 — 2026-07-02 (2 months ago) |
| Last commit | 2024-02-05 (2 years 7 months ago) | 2026-07-02 |
| Open issues | 45 | 53 |

`@webtoon/psd`'s main branch does have `blendMode` and `Group.isHidden`, but nothing has been released in two and a half years. Waiting for it is not on the table.

### Consequences

- Good: blend modes, per-group visibility, clipping, and text layers are all workable. `opacity` comes back as 0-1, so no conversion is needed. The library is still being updated
- Bad: 8ms slower on this PSD. The dist is 243KB larger gzipped. It carries write support for what is a read-only use
- Bad: outside the browser, canvas has to be initialized through `initializeCanvas`. It trips you up when writing tests or a batch script

### Unconfirmed

The numbers were measured under these conditions. None of it is enough to overturn the decision, but re-measure if the premises change.

- The `ag-psd` figures were taken under Node with a canvas stub in place. Running in a browser may give different numbers
- 273KB is the whole dist without tree shaking. The real bundle size with write support dropped has not been measured
- Only one small PSD was measured. On large files the gap may widen in favor of `@webtoon/psd`, which has a WASM decoder

## Notes

- "Parse it directly" was dropped early: the PSD format is vast enough to be beyond what a personal project can carry
- `ag-psd` is MIT licensed
- `ag-psd`'s `useImageData: true` hands back `ImageData` directly. `skipCompositeImageData` and `skipThumbnail` skip work that is not needed here
- How far blend modes map onto Canvas 2D's `globalCompositeOperation` is decided separately — Photoshop has modes with no matching compositing operation
