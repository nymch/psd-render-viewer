# Verification scripts

What [ADR-0008](../docs/adr/0008-composite-verification.md) decided, built. These sit outside the
app: nothing under `lib/`, `components/`, `hooks/`, or `atoms/` imports them, and `npm test` does
not run them.

**Every report they write carries no artwork, no layer names, and no rectangles.** Files are
identified by a hash of their contents and layers by the index `buildLayerTree` assigns, so a run
against a client file produces something that can be shared.

## `inventory.mjs` — what the files on hand actually contain

Run this first. It parses and counts; it renders nothing, needs no browser, and needs no
reference image.

```bash
node scripts/inventory.mjs ~/psd
node scripts/inventory.mjs ~/psd --json > inventory.json
```

It reads with `skipLayerImageData`, so a 170MB PSD is read for its structure without decoding a
single layer.

The last section of the output is the point. Each row is a case the v1 spec wants compared, and a
row with no file behind it is a fixture that has to be generated:

```
coverage — a case with no file behind it has to be generated:
  yes  nested isolated groups  (1)
  NO   pass-through group
  yes  layer effects  (1)
  ...
```

## `compare.mjs` — does the composite match a baseline

One script, two modes. Both need `npm run dev` running in another terminal, and chromium
installed once with `npx playwright install chromium`.

```bash
# Store this render as the baseline
node scripts/compare.mjs file.psd --save-baseline verification/base.json

# Regression: did the composite change since that baseline? Threshold is 0
node scripts/compare.mjs file.psd --baseline verification/base.json --out report.json

# Reference: does the composite match an FireAlpaca export?
node scripts/compare.mjs file.psd --expected export.png --threshold 2 --out report.json
```

### Nothing written to disk can be restored as an image

A baseline is **not** the composite. It is a grid of 64×64 tiles, each reduced to a hash and four
mean channel values — 4096 pixels become five numbers, so the picture cannot be recovered from it.
The tile size is a privacy parameter before it is a performance one: a per-pixel hash would be
trivially invertible, a per-tile hash is not.

- The **hash** answers "did this tile change at all", which is what a threshold of zero needs
- The **means** answer "by how much", which matters if the zero stops holding. It was measured on
  a 200×150 canvas and real documents are far larger

Reports carry no artwork either: no layer names, no rectangles. Files appear as a hash of their
contents, layers as the index `buildLayerTree` assigns.

Pixels are read only inside the browser page, where the diff runs. Only statistics cross back.

Baselines written before this — which did store the composited image — are refused rather than
misread. Delete one and capture it again.

| Flag | Meaning |
| --- | --- |
| `--save-baseline <json>` | Render and store, comparing nothing |
| `--baseline <json>` | Compare against a stored render |
| `--expected <png>` | Compare against a lossless reference export |
| `--expected-lossy <jpg>` | Compare against a lossy reference, by tile mean against a measured JPEG floor |
| `--background <color>` | What to flatten our composite onto before a lossy comparison. Default `#ffffff` |
| `--jpeg-quality <q>` | Quality the noise floor is measured at. Default 0.9; match the reference if known |
| `--margin <n>` | A tile counts as differing when its delta exceeds its own floor by this factor. Default 2 |
| `--allow-scale` | Compare in the reference's dimensions when it is not the document size |
| `--threshold <n>` | A pixel counts as differing when any channel is off by more than this. Default 0 |
| `--out <json>` | Write the report to a file instead of stdout |
| `--url <url>` | Where the dev server is. Default `http://localhost:3000` |

### Exporting from FireAlpaca

**The export settings are part of the baseline.** ADR-0008 pins them, because an expected image
made under settings nobody recorded is one afternoon's output rather than something to compare
against.

**FireAlpaca has ten blend modes**, against the 27 a PSD can carry and the 17 this app maps. A
file using `linear dodge`, `soft light`, `hard light`, or any of the non-separable modes is being
compared against a renderer that does not have them, and the difference is the reference's, not
ours. Check what a file actually uses — `inventory.mjs` lists it — before reading anything into a
comparison.

| Setting | Required |
| --- | --- |
| Format | PNG |
| Alpha | Preserved, not flattened onto a background |
| Bit depth | 8 per channel |
| Color profile | sRGB, or none |
| Scale | 100%, exactly the document size |

Alpha matters more than it looks: the app composites onto a bare canvas and never paints a
background, so a PSD's transparent areas stay transparent. An export flattened onto white differs
across every one of them.

A size mismatch is reported and exits non-zero rather than comparing the wrong pixels.

### Reading a report

```json
{
  "differingPixels": 3000,
  "percentDiffering": 10,
  "explainedByUnsupported": 0,
  "unexplained": 3000,
  "outsideEveryLayer": 0,
  "perLayer": [
    {"index": 2, "blendMode": "normal", "unsupported": [], "shareOfRegion": 71.43}
  ]
}
```

Regression runs report at tile granularity instead: `changedTiles`, `percentTilesChanged`, and
`worstTileMeanDelta`. Any changed tile is a real change, since the threshold there is zero.

- **`unexplained` is the number that matters** (reference runs). A difference inside a layer already marked
  unsupported is expected — ADR-0002 says that layer cannot be reproduced. A difference anywhere
  else is what earns a look. It means "not accounted for by this app's known gaps", not "this app
  is wrong": it may still belong to the reference renderer or to whatever wrote the PSD
- **Sort by `shareOfRegion`, not `shareOfAllDifference`.** A full-canvas backdrop contains every
  difference in the document, so it scores 100% on the latter no matter what caused them. Only
  the share of a layer's own area distinguishes it
- **Read from the bottom of the stack up.** Compositing carries a difference upward, so every
  layer above a wrong one also shows it. The lowest layer showing a difference is the suspect
- **`outsideEveryLayer` above zero means it is not a layer's fault.** Nothing is drawn there, so
  suspect the document-level path: the background, the alpha handling, or an offset
- **`unsupportedCount.agree: false` means this script has drifted.** It derives its own layer
  metadata rather than importing `lib/psd/tree.ts`, and compares its count against the number the
  app's own panel displays. When they disagree, the rules here are stale, not the app

## What these do not answer

The tool says where two images differ. Whether the picture is right is still a human judgment,
and ADR-0008 keeps the by-eye check for that reason rather than replacing it.
