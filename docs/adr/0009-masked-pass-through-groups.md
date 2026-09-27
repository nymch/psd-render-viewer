---
status: proposed
date: 2026-09-15
---

# Seed a masked pass-through group's buffer with the backdrop, so its children keep theirs

## Context

A `"pass through"` group carrying a mask draws the wrong picture. `lib/psd/composite.ts:67` sends it down the isolated path, because a mask needs a surface to apply to, and the buffer it gets there is empty — so its children blend against nothing.

Measured on a fixture where the answer is arithmetic: a backdrop of 128 under a `"pass through"` group holding one `multiply` layer of 128 should read `128 × 128 / 255 = 64`. Without a mask it does. With a **fully opaque** mask, one that hides nothing, it reads 128. The multiply is not wrong, it is absent.

```
expected                            64
pass-through group, no mask      [ 64,  64,  64, 255]
pass-through group, opaque mask  [128, 128, 128, 255]
```

This is [issue #37](https://github.com/nymch/psd-render-viewer/issues/37), found by the comparison [ADR-0008](0008-composite-verification.md) built, and it is what [the spec](../design/psd-viewer-v1.md) listed among its open questions — a pass-through group carrying a mask, with the note that Photoshop appears to isolate it and that this had not been checked against real data. **It has been now, and the answer is the opposite of the guess: the mask does not make isolation correct.**

The scope is one branch in `lib/psd/composite.ts` and what `renderNode` needs in order to take it. A pass-through group carrying *opacity* rather than a mask is the spec's other half of the same open question and is not decided here — no measurement covers it yet.

## Decision criteria

1. **The picture has to be right.** This is a wrong-picture defect, not an approximation that could be tightened later. A blend mode disappearing outright is the worst class of error this renderer can produce, because nothing on screen says it happened
2. **One person can maintain it.** [ADR-0002](0002-blend-mode-mapping.md) put this first and rejected two options for adding a second compositing system beside the Canvas one. That concern still governs; it is ranked second here only because the defect is this severe
3. **The correctness can be demonstrated.** A fix that cannot be shown to work is a guess with more code

## Options considered

- **Seed the group's buffer with the parent's current content** before drawing the children, then mask and composite back
- **Push the group's mask down onto its children**, keeping the true pass-through path and needing no buffer
- **Mark it unsupported.** Change nothing, add an `UnsupportedReason`, show the ⚠ mark and say why
- **Do not decide yet.** Count how often the structure occurs in real files first

### The shape this needs already exists

The objection that reaches for ADR-0002 — that this changes the shape of the compositing pipeline — does not survive reading `drawClipRun` at `lib/psd/composite.ts:122-152`. It already does exactly the sequence proposed here:

1. lay the base down with `source-over` at opacity 1 — a seeded buffer
2. stack the other layers, each with its own blend mode
3. `destination-in` to clip to the base's alpha — a mask
4. composite the whole buffer back into the parent

So seeding is not a new mechanism, it is the existing one applied to a second case, and the pixel-math systems ADR-0002 rejected are not in question.

### The case for marking it unsupported

Worth putting properly, because it is the option most consistent with what this repository has already decided. ADR-0002 chose to fall back to `normal` and mark the result **so that unsupported stays visibly unsupported**, and the spec's stated purpose for this version is being able to judge whether the picture is correct. A mark serves that purpose exactly, costs nothing, and keeps `renderNode` ignorant of its caller — which it is today, and which seeding gives up.

It is rejected on criterion 1. ADR-0002's fallback is an approximation that a viewer can see and reason about; this is a blend mode vanishing. And the mark would sit on a group whose *children* are wrong, which is not where a reader would look.

### Pushing the mask down is cheaper and not equivalent

Combining the group's mask into each child's own mask needs no buffer and no backdrop. It agrees with seeding wherever the mask is fully opaque or fully transparent — including the case measured above, so the fixture cannot tell the two apart.

They diverge where the mask is partial **and** children overlap each other: pushing down masks each child before it blends, so a later child blends against an already-attenuated earlier one, where seeding attenuates only the finished result. Seeding is the one that matches what a group mask means. It is rejected for being a second, subtly different masking model living beside the existing one, which is the maintenance cost criterion 2 exists to weigh.

## Decision

**Seed the buffer with the backdrop.** Before a masked pass-through group draws its children, the parent's current pixels for that extent are copied into the group's buffer; the children blend against them as they would have blended against the parent; the mask is applied as it already is; and the result is composited back.

It is the only option that satisfies criterion 1 without introducing a second model of what a mask means, and criterion 2 is satisfied by the sequence already existing in `drawClipRun`.

**Writing back is exact, including for a partial mask.** A pass-through group composites with `source-over` (`blendMode.ts:75`) at `renderOpacity` 1 (`tree.ts:149`, which forces it to 1 and multiplies the group's own opacity into the children instead). So for a mask alpha of `a`, the result is `a × (backdrop with children composited) + (1 − a) × backdrop`, which is the mask applied to the group's effect and nothing else. At `a = 1` it is the children over the backdrop; at `a = 0` the backdrop is untouched.

### Consequences

- Good: a mask that hides nothing changes nothing, and a blend mode inside a masked group behaves as it does outside one
- Good: no new allocation. `renderNode` already creates the buffer; seeding is one `drawImage` into a canvas that exists either way
- Good: the fixture that found this is 2KB, needs no reference renderer, and becomes the regression test
- Bad: **`renderNode` stops being independent of its caller.** It currently knows a node and a pixel store; it will need the parent surface and the region to read from. That coupling is the real price, and it is paid by every call, not only the masked-group one
- Bad: one document-region copy per masked pass-through group. Cheap next to compositing, but it is work that the true pass-through path does not do at all
- Bad: the fix cannot be distinguished from pushing the mask down by any fixture built so far. Telling them apart needs a partial mask over overlapping children, which does not exist yet — so the argument for this option over that one rests on reasoning about what a group mask means, not on a measurement
- Bad: nothing here addresses a pass-through group carrying opacity, the other half of the spec's open question, which stays open

### Unconfirmed

- **Whether Photoshop agrees.** The arithmetic settles what `multiply` against a backdrop gives, which is what makes the defect certain. It does not establish that Photoshop composites a masked pass-through group this way rather than some third way. FireAlpaca supports all the modes involved, so the fixture can be checked against it, and that check has not been run
- **Whether the copy costs anything that matters at document scale.** It was measured on 64×64. A 5000×4990 document with several masked pass-through groups copies a document-sized region per group, and no timing exists
- **How often the structure occurs.** One real file carried two of them among 38 nodes. The other three measured have not been tallied for it, and `inventory.mjs` does not yet report it

## Notes

- [Issue #37](https://github.com/nymch/psd-render-viewer/issues/37) is what this decides. The fixture pair it describes is the regression test
- [The spec](../design/psd-viewer-v1.md) needs its open question updated: the masked half is answered here, and answered against what it guessed
- [ADR-0002](0002-blend-mode-mapping.md) is not overturned. It rejected adding pixel math beside Canvas compositing; this adds neither
- [ADR-0008](0008-composite-verification.md) produced this. It is the first phenomenon to make that ADR's migration rule fire — found on a real file, reproduced by a generated one, so the real file is no longer needed for it
