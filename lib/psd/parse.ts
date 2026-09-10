import {readPsd} from "ag-psd";
import type {Psd} from "ag-psd";

/**
 * Cumulative ceiling on the memory used for decoding.
 *
 * `ag-psd` defaults to 2GB, which 100MB-class PSDs were hitting and failing to open. Riding on
 * the default would mean the behavior changing under a library update, so the value is set here.
 * Passing `undefined` removes the ceiling entirely, but then running out takes the whole tab
 * down instead of raising an error, so that is not an option.
 */
const TOTAL_MEMORY_LIMIT = 4 * 1024 * 1024 * 1024;

/**
 * Wraps `readPsd`, fixing the options.
 *
 * `useImageData: true` receives PixelData rather than a canvas, and the flattened image and the
 * thumbnail are skipped because compositing happens here. It is synchronous, which is why it
 * runs inside `lib/psd/worker.ts` rather than on the main thread (ADR-0004).
 */
export function parsePsd(buffer: ArrayBuffer): Psd {
  return readPsd(buffer, {
    useImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
    totalMemoryLimit: TOTAL_MEMORY_LIMIT,
  });
}
