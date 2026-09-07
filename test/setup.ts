import {initializeCanvas} from "ag-psd";

/**
 * Nodeでは`initializeCanvas`でcanvasの実装を渡さないと`readPsd`が例外を投げる。
 * `useImageData: true`を指定していても内部でcanvasを要求する。ブラウザでは
 * ag-psdが`document`を見て自動で用意するため、この初期化はテスト専用。
 *
 * 実際に描画するテストは書かない（Canvasの正しさは目視比較で確かめる）ので、
 * `createImageData`だけが動けばよい最小のスタブを渡す。
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
