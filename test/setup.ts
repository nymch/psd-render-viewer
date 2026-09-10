import {initializeCanvas} from "ag-psd";

/**
 * Under Node, `readPsd` throws unless `initializeCanvas` is given a canvas implementation. It
 * demands a canvas internally even with `useImageData: true`. In a browser ag-psd sets one up
 * automatically off `document`, so this initialization is test-only.
 *
 * No test draws anything - the canvas is verified by side-by-side comparison instead - so the
 * stub is the minimum that makes `createImageData` work.
 */
initializeCanvas(
  (width: number, height: number) => {
    const canvas = {
      width,
      height,
      getContext: () => ({
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        }),
      }),
    };
    return canvas as unknown as HTMLCanvasElement;
  },
  (width: number, height: number) =>
    ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }) as unknown as ImageData,
);
