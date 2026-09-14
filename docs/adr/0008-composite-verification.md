---
status: proposed
date: 2026-09-14
---

# Verify the composite by attributing pixel differences to layers, against a reference render

## Context

[ADR-0002](0002-blend-mode-mapping.md) ranked "matching what Photoshop shows" second among its criteria and did check it — by eye, against real PSDs opened beside Photoshop. That is where `linear dodge` → `lighter` came from, along with the five-condition table recording where the two agree.

**What it had no way to do was repeat the check.** Nothing records which files were compared or reproduces the result, and `blendMode.test.ts` asserts the ten unsupported modes without asserting the seventeen that map, because their expected values would come from the same table they are meant to test. So the gap is not that correctness was never examined. It is that **the examination cannot be run again, finds only what announces itself, and no longer has the renderer it was run against** — Photoshop is not available here any more.

**The reference from here is Alpaca Studio.** The spec settled that at [psd-viewer-v1.md:329](../design/psd-viewer-v1.md) for the same reason and accepted the cost: a blend mode where Alpaca and Photoshop disagree is missed. That cost is judged small — the two render far closer to each other than either does to GIMP or Paint.NET — which makes Alpaca a workable stand-in rather than merely the only thing left.

Two things block the comparison. **The fixtures do not exist**, and the obvious ones cannot be committed: real files run 120-170MB and are client material. **The comparison itself has no mechanism** — nothing takes two renders and says how they differ.

The scope is everything outside the app: how fixtures are obtained, how a comparison is run, and what a report may contain. No file under `lib/`, `components/`, `hooks/`, or `atoms/` changes.

## Decision criteria

1. **The method has to reach the cause.** "The images differ by 3%" cannot be acted on. "Layer 4, a multiply layer inside a pass-through group, accounts for the difference" can. This ranks first because verification exists to find defects, not to produce a score. It is worded as *method* rather than *report* deliberately: by eye is a method that reaches the cause on a small document, and a criterion phrased around producing a report would have eliminated it by definition instead of on merit
2. **It has to be repeatable.** The check ADR-0002 ran cannot be run again, which is the specific failure this decision exists to fix
3. **One person can maintain it.** What is being added is test infrastructure, and infrastructure nobody can repair is worse than none
4. **It can be thrown away.** If the approach turns out wrong, nothing in the app should have to be unpicked
5. **Neither rights nor confidentiality leak.** Ranked last *now*, and it rises — see the migration rule below. [ADR-0002](0002-blend-mode-mapping.md) set the precedent for a criterion whose rank is explicitly conditional on a later change

### The migration rule

Ranking confidentiality last today would be indefensible as a permanent position. It is not one.

**Real files are the medium of discovery; generated fixtures are the medium of regression.** A difference found with a real file is translated into a generated fixture that reproduces it, and at that point the real file is no longer needed *for that phenomenon*. The trigger is per-phenomenon, not a date and not a project stage, so the dependency on real material falls one finding at a time rather than waiting on a milestone that never quite arrives.

This is the shape [testing.md](../../.claude/rules/testing.md) already requires of unit tests — a bug gets a test that reproduces it, written first. The rule here extends it to compositing.

**Some phenomena will not migrate, and the rule has to say so rather than pretend otherwise.** `writePsd` cannot express everything Photoshop writes — it cannot produce a layer with an absent name, which is what [issue #30](https://github.com/nymch/psd-render-viewer/issues/30) was about. When a difference depends on a structure that cannot be generated, the phenomenon stays tied to a real file permanently. Those cases are recorded as such, with what could not be expressed, so the residue is a known list rather than a slow leak of exceptions.

**Which generated fixtures are needed is a question about the real corpus, not a fixed list.** The files on hand are thought to span masks, `linear dodge`, groups, and a range of layer counts, which would cover much of the matrix on their own. That belief is checkable by the same metadata the report uses: parsing the corpus and tabulating blend modes, mask presence, nesting depth, layer counts, and `unsupported` kinds produces a coverage inventory. It needs no reference render and no comparison — only a parse — so it is the cheapest thing here to run first, and its output is already in the shareable form.

**The fixtures worth generating are the gaps that inventory exposes**, which is likely to be fewer than the ten the spec enumerates, and possibly different ones.

## Options considered

- **Drive the real app in a browser, diff against a reference render, attribute per layer.** Playwright opens the running app, the composited canvas is read back with `getImageData`, and the difference is attributed to layers using the metadata `buildLayerTree` already produces
- **Commit hand-authored Photoshop fixtures as binaries**, with their expected PNGs, and compare the same way. Content authored in Photoshop by the project — rectangles and gradients — carries no third-party rights
- **Render headlessly with a Node canvas** (`node-canvas`, `skia-canvas`) and skip the browser
- **Compare only against this repository's own previous render.** No reference renderer, no export, no threshold
- **Decide after the coverage inventory.** Tabulate what the files on hand contain, and pick a mechanism once the shape of the problem is known
- **Do not build it.** Keep comparing by eye, two windows side by side

### Rendering in Node does not compare anything

`lib/psd/composite.ts` delegates blending to `globalCompositeOperation`, so **the blend math belongs to the browser, not to this repository.** A Node canvas is a different implementation of that math. When its output disagreed with Alpaca Studio, nothing would say whether this code, the polyfill, or the mapping table was at fault — and the mapping table is the thing under test. It is rejected for failing criterion 1 outright, not for being slow or awkward.

### Regression-only is the cheapest thing that works, and does not answer the question

Comparing a render against this repository's own previous render needs no reference renderer, no export settings, and no tolerance — the measurement below puts its threshold at zero. It would catch any change in rendering, it can run unattended, and it sidesteps every open question about Alpaca Studio.

It is rejected as the *decision* because it can only detect change, never error. A composite that has been wrong since the day it was written stays wrong and stays silent, and ADR-0002's ten unsupported modes and the `linear dodge` alpha divergence are exactly that class of defect. **It is adopted as a component instead**: the regression comparison is the part that automates now, and the reference comparison is the part that says whether the baseline deserved to be trusted.

### Deciding after the inventory postpones nothing that matters

The coverage inventory comes first either way, and it is cheap enough that nothing rides on sequencing it. What deciding later would buy is knowing the corpus before picking a mechanism; what it costs is that the inventory itself is the first consumer of the metadata schema this decision fixes. Choosing the report shape now is what makes the inventory more than a one-off script.

### The case for not building it

Worth stating properly, because it is stronger than it looks. **The question being asked is ultimately "does this picture look right", and that is a human judgment.** A numeric report invites the opposite failure from the one it prevents: a run that reports 0.4% difference reads as a pass, when the 0.4% is the entire clipping mask being ignored in a corner. Eyes catch that immediately; a threshold does not. Against a solo project with no CI to run any of it, "open both and look" is close to free and has no machinery to maintain.

It is rejected for the class of defect it misses, not for the size of file it can handle. ADR-0002 ran it on real PSDs — seventy layers, not a handful — and it worked, because what it was looking for was a whole layer coming out the wrong color. **A mask clipped a few pixels short, or a group's opacity applied twice on one nested branch, does not announce itself that way.** Those are found by knowing where to look, which is what attribution supplies and eyes do not. The by-eye check is kept — see the consequences — rather than replaced.

## Decision

**Build one script that drives the real app in a browser, reads back the composited pixels, and attributes their difference from a baseline to layers. It takes the baseline in two modes.**

| Mode | Baseline | Threshold | Answers |
| --- | --- | --- | --- |
| Regression | this repository's own previous render | zero, measured | did the composite change |
| Reference | an Alpaca Studio export | to be calibrated | is the composite wrong |

**One script, not two.** Reading pixels out of the app, computing the delta map, attributing it by layer, and formatting the report are identical in both; only where the baseline comes from differs. Splitting them would duplicate all of it to vary one argument.

By eye and regression-only both reach the cause, so criterion 1 does not separate them. **Criterion 2 is what settles it, and it does so unevenly enough to state plainly:** by eye cannot be re-run at all, regression re-runs exactly, and the reference mode sits between them — it depends on an export produced by hand, which is why its format is pinned below rather than left to the day it is used. The reference mode is the one that answers the question, and it is the less repeatable half. Fixing that as far as it can be fixed means pinning everything about the export that is under anyone's control.

Rendering in Node would satisfy criterion 2 and still fail criterion 1, because the browser is where the blending actually happens: a disagreement there is a disagreement about this repository's code rather than about a substitute renderer.

Four things were confirmed by building it rather than assumed.

**Pixels come out of the running app.** Playwright opens a PSD through the file input and `getImageData` returns the composited RGBA — 160x120 giving 76,800 bytes on the sample used.

**Attribution works, and the obvious metric is the wrong one.** With a difference injected inside exactly one layer's rectangle, the layer is identified — but only by share of its own region. Share of the total difference named the full-canvas backdrop just as strongly, because any difference anywhere falls inside a layer that covers everything. **The metric has to be normalized by the layer's own area.**

**The layer index already exists.** `buildLayerTree` assigns `node-0`, `node-1`, … in traversal order (`lib/psd/tree.ts:103`), and `tree.test.ts:38` holds the order fixed. A report can therefore identify layers without carrying names.

**`writePsd` can build the hard fixtures.** Clipping over a multiply base, and a mask rectangle smaller than its layer with `defaultColor: 255`, both survive a write-and-read round trip, in 4KB.

### The export format, pinned

An expected image produced under settings nobody wrote down is not a baseline, it is one afternoon's output. The requirements follow from what the app itself produces: `compositeDocument` starts from a bare `OffscreenCanvas` (`lib/psd/composite.ts:40`) and never paints a background, so **the composite carries alpha**, and anything flattened onto white differs from it across every transparent pixel.

| Setting | Required | Why |
| --- | --- | --- |
| Format | PNG | Lossless. JPEG artifacts would sit at the same magnitude as the differences being looked for |
| Alpha | Preserved, not composited onto a background | The app's output is transparent where the PSD is |
| Bit depth | 8 per channel | What `getImageData` returns. 16-bit would need a downconversion that introduces its own rounding |
| Color profile | sRGB, or none | The canvas is untagged sRGB. An embedded profile means converting before comparing, or comparing the wrong numbers |
| Scale | 100%, exactly the document size | Any resampling makes a per-pixel comparison meaningless |

**Semi-transparent pixels will not match exactly even when everything is right.** A canvas stores color premultiplied by alpha and `getImageData` divides it back out, so low-alpha pixels lose precision in the read-back that a PNG never had. This is a floor on the reference threshold rather than a defect, and it is one more reason the floor has to be measured instead of assumed to be zero.

### What a report contains

Geometry is an input to the attribution, not an output of it. Dropping names and rectangles from the output leaves per-layer detail that is safe to share:

```json
{"index": 2, "blendMode": "normal", "opacity": 1, "clipping": false,
 "hasMask": false, "unsupported": [], "shareOfRegion": 71.43}
```

**`unsupported` is what turns a difference into a finding.** A layer whose blend mode fell back to normal under ADR-0002 is *expected* to diverge from the reference, so a difference inside its region is explained. A difference outside every such region is not, and that is what earns a look — **unexplained, which is not the same as wrong.** It may still turn out to belong to the reference renderer or to whatever wrote the PSD, per Unconfirmed. This matters more than any single percentage, because a PSD with unsupported elements can never reach a clean overall score — the global number is uninterpretable from the start, and the split is not.

### The threshold

**For regression comparison it is zero, measured.** Rendering two PSDs three times each, in separate browser sessions, produced `maxChannelDelta: 0` and `differingPixels: 0` every time. Comparing a render against this repository's own previous render therefore needs no tolerance: one changed pixel is a real change.

**For comparison against Alpaca Studio no number can be set yet**, and inventing one here would be worse than recording its absence. Two independent renderers differ through anti-aliasing, color management, and premultiplied-alpha rounding, none of which has been measured because no Alpaca export has been obtained. The calibration procedure is the decidable part: **measure the noise floor on generated fixtures whose answer is known** — a plain three-layer stack should come out near zero — and set the tolerance from that floor, not from taste.

The asymmetry is the useful result. Regression detection is exact and can be automated now; reference comparison needs calibration and stays manual.

### Consequences

- Good: a failing comparison names a layer and its treatment, instead of producing a score
- Good: regression detection needs no tolerance **at the sizes measured**, so a change in rendering cannot hide under a threshold. The measurement covers small canvases only, and the zero is a finding about those — see Unconfirmed
- Good: reports carry no artwork, so a run against a client file leaves a record that can be kept
- Good: the fixture migration has a trigger that can actually fire, rather than an intention to tidy up later
- Bad: **criterion 1 is not fully met for the files the discovery phase relies on.** Where a PSD was exported from another editor, a difference may belong to this app, to Alpaca Studio, or to the export, and the report cannot say which. It narrows the search to a layer; it does not establish whose fault that layer is
- Bad: the reference mode is the half that answers the question and the half that is least repeatable, because it needs an export made by hand. Pinning the format removes the variation that can be removed and leaves the rest
- Bad: **this brings in Playwright ahead of the plan.** [testing.md](../../.claude/rules/testing.md) records E2E as not set up and the spec puts it out of scope for v1. The comparison also needs a dev server running, so it is not a plain `npm test`
- Bad: attribution by rectangle is approximate. A layer's rectangle includes its transparent parts, and overlapping layers all show a difference that only one of them caused. Ablation — rendering once per hidden layer to get each layer's true contribution — would fix it at N+1 renders and a code path that bypasses the read-only panel, and is deliberately deferred
- Bad: **criterion 4 holds only for the approximate version.** Nothing in the app changes while attribution is by rectangle, but ablation needs a way to hide a layer, which the read-only panel does not offer. If rectangle attribution proves unreadable at seventy layers — which Unconfirmed rates as likely enough to name — the cheap exit disappears with it
- Bad: a report keyed by index is reproducible only while the PSD is unchanged, and a report of a run against a client file cannot be re-derived by anyone who lacks that file. Committing one preserves the finding, not the ability to check it
- Bad: differences propagate upward through the stack, so the topmost layer showing a difference is usually not the cause. **Read a report from the bottom up.** This is a convention, not something the tool enforces
- Bad: the layer index is stable only within one file. Adding a layer and re-exporting shifts every index after it, so reports do not survive an edit to the PSD
- Bad: a report still describes structure — layer count, depth, the distribution of blend modes. No artwork leaks, but it is not perfectly colorless
- Bad: the by-eye check stays necessary. The tool answers "where do they differ", never "is this right"

### Unconfirmed

- **Everything involving Alpaca Studio.** No export has been obtained, so its color management, alpha handling, and export settings are unknown. If it applies an ICC profile the browser canvas does not, the noise floor could be large enough to swamp real differences, and the comparison would need color conversion before it means anything
- **That "what Photoshop shows" is the right target at all.** Some of the files in circulation were authored in Clip Studio Paint and exported to PSD as a courtesy, so Photoshop reads them as one consumer among several rather than as their origin. For those files **a difference has three possible sources — this app, the reference renderer, or the export itself — and nothing here separates them.** How much strictness is worth demanding is deliberately left open: it is a question better answered against real differences than in advance, and answering it early would mean picking a standard of correctness for files whose authors never had one either. The consequence to carry meanwhile is that an unexplained difference means "not accounted for by this app's known gaps", not "this app is wrong"
- **That Alpaca Studio is close enough to Photoshop to stand in for it.** The judgment is that the two are far nearer each other than either is to GIMP or Paint.NET, which is an assessment from use, not a measurement — and with Photoshop unavailable it cannot be turned into one here. Every finding this produces inherits it: a difference against Alpaca is evidence about Photoshop only as far as that closeness holds, and the modes where it is likeliest to fail are the ones ADR-0002 already marks unsupported
- **Whether Alpaca Studio exports the same PSD to the same bytes twice.** The format above pins what a person chooses; it says nothing about whether the renderer behind it is deterministic. If it is not, the baseline moves between exports and the reference threshold has to absorb that as well. Two exports of one file, compared byte for byte, settle it, and that is worth doing before any expected image is stored
- **Determinism was measured on two small generated PSDs, in one Chromium build, on one machine.** A 100MB-class file, a different browser, or GPU-accelerated compositing could all break the zero. If it does, the regression threshold stops being zero and needs the same calibration as the reference comparison
- **Whether rectangle attribution is precise enough on a real file.** It was demonstrated on five layers with disjoint rectangles. Seventy overlapping layers is the case that matters and has not been tried; if it proves unreadable, ablation stops being optional
- **Whether the files on hand cover the matrix.** The plan leans on them for discovery, on the understanding that they vary in masks, `linear dodge`, grouping, and layer count. Nobody has tabulated it. The coverage inventory settles it cheaply, and if the corpus turns out narrower than believed — all one depth, say, or no clipping masks anywhere — more has to be generated up front and the discovery phase covers less than this decision assumes
- **Whether `writePsd` can express every fixture the spec lists.** Clipping, masks, blend modes, groups, effects, and adjustment layers were confirmed. It is already known that it *cannot* write a layer with an absent name — the format always stores one — which is what [issue #30](https://github.com/nymch/psd-render-viewer/issues/30) was about, so other gaps of that kind should be expected rather than assumed away

## Notes

- [Issue #20](https://github.com/nymch/psd-render-viewer/issues/20) is what this unblocks, and it needs revising twice over: its "done when" asks for ten fixture files under `test/fixtures/`, where under this decision the generator is what gets committed, and the count itself becomes an output of the coverage inventory rather than a number fixed in advance
- The coverage inventory is the first thing to build. It is a parse and a tally, it answers whether the files on hand already cover the matrix, and nothing else here can be scoped until it has run
- [ADR-0002](0002-blend-mode-mapping.md) is the decision this exists to check. Its `unsupported` classification is also what separates an explained difference from an alarming one
- Revisit when the first Alpaca export is compared. That is when the threshold stops being unmeasurable, and when the color management question is answered either way
