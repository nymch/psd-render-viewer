# ag-psd notes

What `ag-psd` actually does, as opposed to what its types suggest. **Pinned to ag-psd 31.0.2** (MIT), the installed version — these notes are empirical, so a version bump invalidates them until they are re-checked. Why this parser was chosen is recorded in [ADR-0001](adr/0001-psd-parser.md).

The findings come from two places. Some were **established by running the library against real PSDs** (layer order, group opacity, initialization outside the browser). The rest were **read out of the type definitions in `node_modules/ag-psd/dist/psd.d.ts` and the bundled implementation** (identifiers, value lists, options). The second kind is correct as to identifiers, but how a real PSD fills them in has not been confirmed.

Every property of `Layer` is optional. Treat anything taken off one as possibly `undefined`.

| Purpose | Identifier | Notes |
| --- | --- | --- |
| Visibility | `hidden?: boolean` | **The sense is inverted.** If the app holds `visible`, convert with `visible: !layer.hidden`. Groups carry it too |
| Opacity | `opacity?: number` | **0-1**, already normalized, so no conversion is needed |
| Fill opacity | `fillOpacity?: number` | 0-1. Not the same thing as `opacity` |
| Blend mode | `blendMode?: BlendMode` | A union of strings. The values are listed below |
| Clipping | `clipping?: boolean` | |
| Name | `name?: string` | Can be `undefined` |
| Layer id | `id?: number` | Can be `undefined`, so it cannot be used as a React key as-is |
| Children | `children?: Layer[]` | **A group is represented as a layer that has `children`.** There is no separate group type |
| Group expanded | `opened?: boolean` | Only on groups. Useful for the layer panel's initial state |
| Layer bounds | `left`, `top`, `right`, `bottom` | Document coordinates. **`imageData` is the size of this rectangle, not of the document.** Drawing needs the offset |
| Pixels | `imageData?: PixelData` | Present when `useImageData: true`. What it really is, below |
| Layer mask | `mask?: LayerMaskData` | Below. There is also `realMask` |
| Vector mask | `vectorMask?: LayerVectorMask` | Path data only. No rasterized pixels |
| Layer effects | `effects?: LayerEffectsInfo` | Settings only. **The result of applying an effect is not in `imageData`.** Drawing it is on you |
| Adjustment layer | `adjustment?: AdjustmentLayer` | Settings only. Holds no pixels |
| Smart object | `placedLayer?: PlacedLayer` | |
| Text | `text?: LayerTextData` | The text data. Its rasterized pixels are in `imageData` instead |
| Artboard | `artboard?` | Sits on a layer. `psd.artboards` is document-wide information such as the count, and a different thing |
| Document size | `psd.width`, `psd.height` | |

## Read options

```typescript
import {readPsd} from "ag-psd";

const psd = readPsd(arrayBuffer, {
  useImageData: true,           // receive PixelData rather than a canvas
  skipCompositeImageData: true, // skip the flattened image, unused since this app composites itself
  skipThumbnail: true,          // skip the thumbnail
});
```

Other options worth knowing about.

| Option | Default | What it does |
| --- | --- | --- |
| `totalMemoryLimit` | 2GB | A **cumulative** ceiling on decoding memory. Every layer and mask decoded subtracts its byte count, and once too little is left it throws `Error("Exceeded memory limit")`. It is not a per-image ceiling, so a PSD with many layers stops here too. **This app sets 4GB explicitly in `lib/psd/parse.ts`**, because a 100MB PSD hit the 2GB default. Passing `undefined` removes the ceiling altogether |
| `throwForMissingFeatures` | `false` | Throw when an element `ag-psd` itself does not support is encountered |
| `logMissingFeatures` | `false` | Log the same situation to the console |
| `skipLayerImageData` | `false` | Skip layer pixels. Useful when only the tree is wanted |
| `skipLinkedFilesData` | `false` | Skip what a smart object links to |

## What `imageData` really is

The type of `imageData` is `PixelData` (`{data: PixelArray; width: number; height: number}`), which is **a different type from the DOM's `ImageData`**. What it holds depends on the bit depth of the PSD being read.

- At **8 bits with 4 channels** (an ordinary RGB PSD) the contents are a genuine `ImageData` instance. `ag-psd` builds it internally by calling `canvas.getContext("2d").createImageData()`, so it can go straight to `putImageData`
- At **16 and 32 bits** it is a plain object, `{data: Uint16Array | Float32Array, width, height}`, which `putImageData` rejects

The type is always `PixelData`, so passing one to `putImageData` needs narrowing. Test `data instanceof Uint8ClampedArray` for the 8-bit case. The bit depth itself is readable at `psd.bitsPerChannel`.

## Blend mode values

`BlendMode` is a union of these 31 values.

`"pass through"`, `"normal"`, `"dissolve"`, `"darken"`, `"multiply"`, `"color burn"`, `"linear burn"`, `"darker color"`, `"lighten"`, `"screen"`, `"color dodge"`, `"linear dodge"`, `"lighter color"`, `"overlay"`, `"soft light"`, `"hard light"`, `"vivid light"`, `"linear light"`, `"pin light"`, `"hard mix"`, `"difference"`, `"exclusion"`, `"subtract"`, `"divide"`, `"hue"`, `"saturation"`, `"color"`, `"luminosity"`, `"linear height"`, `"height"`, `"subtraction"`

**Only 28 of them can appear on `layer.blendMode`.** `toBlendMode` (`dist/helpers.js`), which converts the PSD's four-character keys, covers 28; the remaining `linear height`, `height`, and `subtraction` only ever arrive through a descriptor (a layer effect or a vector stroke). Do not take the type's 31 as the number of values a layer can hold.

Canvas 2D's `globalCompositeOperation`, for its part, offers 15 blending operations (`multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`), with `source-over` for normal compositing.

Removing `pass through` from the 28 — it describes group structure, not a compositing operation — leaves 27, of which **16 correspond by name.** On top of those, `linear dodge` maps onto the additive `lighter` despite the different name (the two agree when the backdrop is opaque). **The remaining 10 have no equivalent operation.** [ADR-0002](adr/0002-blend-mode-mapping.md) decides what to do with them.

## Layer masks

The fields of `mask?: LayerMaskData`.

| Identifier | Meaning |
| --- | --- |
| `imageData?: PixelData` | The mask's pixels, at **the size of the mask's own rectangle**, which matches neither the layer's rectangle nor the document. Channel layout below |
| `left`, `top`, `right`, `bottom` | The mask's rectangle, in document coordinates |
| `disabled?: boolean` | **When true, the mask is not applied** |
| `defaultColor?: number` | The value outside the mask rectangle, 0 or 255. It decides whether the area outside counts as transparent or opaque |
| `positionRelativeToLayer?: boolean` | Whether the rectangle is relative to the layer |
| `fromVectorData?: boolean` | Whether the mask was built from a vector mask |
| `userMaskDensity`, `userMaskFeather` | Density and feather. Honoring them takes calculation of your own |

`realMask` has the same `LayerMaskData` type and is the slot used when a raster mask and a vector mask are both present. **How real data fills it in has not been confirmed.**

### Channel layout of a mask

**A mask's gradations land in RGB, and alpha comes back 255 everywhere.** After reading the mask's channel, `ag-psd` copies the R value into G and B in `setupGrayscale`, then fills alpha in `resetAlpha`.

Because of that, **a mask must not be handed to `globalCompositeOperation = "destination-in"` as-is.** `destination-in` looks at the source's alpha, so the gradations are ignored and the result is a rectangular cut at the mask's bounds. To make a mask work, build an `ImageData` yourself with the R value moved into alpha.

`defaultColor` is the value outside the mask rectangle, 0 or 255. `destination-in` affects the whole destination including the area outside what was drawn, so lay `defaultColor` down across the full size of the layer before writing the mask rectangle into it.

## Layer order

Established against real data. **`children[0]` is the backmost layer and the last element is the frontmost.**

- **Drawing to a canvas** — keep the order of `children`, drawing back to front
- **Displaying the layer panel** — reverse it, so the front is at the top as in Photoshop

This is the opposite of `@webtoon/psd`, so do not reuse an article or a snippet written on that assumption.

## Group opacity

**`ag-psd` does not hand back an opacity accumulated down from the ancestors.** A group with `opacity: 0.5` still returns its child layers at `opacity: 1`. Making group opacity take effect is code you write.

**Multiplying it down the tree into the children is not always the right answer, though.** With a buffer per group (the isolated model), a group's opacity need only be applied once, when its buffer is drawn into the parent. Multiplying it into the children instead makes **the places where children overlap come out darker.** Multiplying into the children is correct only for a `"pass through"` group, which has no buffer of its own. Doing both applies it twice.

A group's `blendMode` can be `"pass through"`. Canvas 2D has no matching compositing operation, so it is handled separately.

## Running without a `document`

**Where there is no `document`, `readPsd` throws unless `initializeCanvas` is given a canvas implementation** (`"Canvas not initialized"`). It demands a canvas internally even with `useImageData: true`. Both Node (tests and scripts) and **a Web Worker** are affected.

`ag-psd` detects the browser with `typeof document !== "undefined"` and, when that holds, installs an implementation backed by `document.createElement("canvas")`. **A worker has no `document`, so it never takes that branch.** Code that worked on the main thread falls over here once moved into a worker.

In a worker, pass an `OffscreenCanvas`.

```typescript
initializeCanvas((width, height) => new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement);
```

`initializeCanvas` is exported from `ag-psd` itself.
