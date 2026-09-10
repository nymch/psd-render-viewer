import type {Bounds, MaskRef, PixelSource} from "@/lib/psd/tree";

/**
 * An alpha image to hand to `destination-in`. Laid out as RGBA, where only alpha carries
 * meaning. It comes back as a plain object rather than an `ImageData` so that it can be unit
 * tested under Node.
 */
export type AlphaMap = {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
};

/**
 * Rebuilds a layer mask into an alpha image.
 *
 * ag-psd copies the mask's gradations into each RGB channel and returns alpha at 255
 * everywhere. `globalCompositeOperation = "destination-in"` looks at the source's alpha, so
 * handing it `mask.imageData` directly ignores the gradations and produces nothing but a
 * rectangular cut at the mask's bounds. The R channel has to be moved into alpha.
 *
 * `destination-in` affects the whole destination, including the area outside what was drawn,
 * so this is built at the full size of the target rectangle with everything outside the mask
 * rectangle filled with `defaultColor`. Without that, the area outside disappears whenever the
 * mask rectangle is smaller than the layer and `defaultColor` is 255 (outside is visible).
 */
export function buildMaskAlpha(
  mask: MaskRef,
  maskPixels: PixelSource,
  target: Bounds,
): AlphaMap {
  const width = target.right - target.left;
  const height = target.bottom - target.top;
  const data = new Uint8ClampedArray(width * height * 4);

  // A Uint8ClampedArray starts zeroed, so a defaultColor of 0 needs no filling
  if (mask.defaultColor !== 0) {
    for (let i = 3; i < data.length; i += 4) {
      data[i] = mask.defaultColor;
    }
  }

  const left = Math.max(mask.bounds.left, target.left);
  const top = Math.max(mask.bounds.top, target.top);
  const right = Math.min(mask.bounds.right, target.right);
  const bottom = Math.min(mask.bounds.bottom, target.bottom);

  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const source =
        ((y - mask.bounds.top) * maskPixels.width + (x - mask.bounds.left)) * 4;
      const destination = ((y - target.top) * width + (x - target.left)) * 4;
      // R, G and B hold the same value, so only R is read
      data[destination + 3] = maskPixels.data[source] ?? 0;
    }
  }

  return {data, width, height};
}
