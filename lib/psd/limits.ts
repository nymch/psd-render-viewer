/**
 * Whether a document can be opened at all.
 *
 * Both the longest edge and the area are checked. A browser canvas is constrained on both, and
 * Chrome's area limit is 268,435,456px (exactly 16384x16384). Testing only for the edge lets a
 * 16384x16384 document through into the area limit.
 *
 * The area limit is derived from memory. What gets allocated at document size is three
 * surfaces - the display canvas, the root buffer, and the composited ImageBitmap - which at
 * 8192x8192 is 268MB each, about 800MB for three. Both values are provisional and get adjusted
 * by measurement.
 */
export const MAX_EDGE = 16384;
export const MAX_AREA = 8192 * 8192;

/** ag-psd's imageData is a real ImageData only at 8 bits. 16- and 32-bit cannot be drawn */
const SUPPORTED_BITS_PER_CHANNEL = 8;

export type DocumentRejection =
  | {reason: "edge"; edge: number; limit: number}
  | {reason: "area"; area: number; limit: number}
  | {reason: "bits-per-channel"; bitsPerChannel: number};

export type DocumentCheck = {ok: true} | {ok: false} & DocumentRejection;

export function checkDocumentSize(width: number, height: number): DocumentCheck {
  const edge = Math.max(width, height);
  if (edge > MAX_EDGE) {
    return {ok: false, reason: "edge", edge, limit: MAX_EDGE};
  }

  const area = width * height;
  if (area > MAX_AREA) {
    return {ok: false, reason: "area", area, limit: MAX_AREA};
  }

  return {ok: true};
}

/**
 * Rejects 16- and 32-bit PSDs. For those, ag-psd returns `imageData` as a plain object holding
 * a Uint16Array or Float32Array, which `putImageData` will not take.
 */
export function checkBitsPerChannel(
  bitsPerChannel: number | undefined,
): DocumentCheck {
  // undefined means it could not be read from the PSD header. Assume 8 bits and carry on
  if (bitsPerChannel === undefined) return {ok: true};

  if (bitsPerChannel !== SUPPORTED_BITS_PER_CHANNEL) {
    return {ok: false, reason: "bits-per-channel", bitsPerChannel};
  }
  return {ok: true};
}
