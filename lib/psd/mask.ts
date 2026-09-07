import type {Bounds, MaskRef, PixelSource} from "@/lib/psd/tree";

/**
 * `destination-in`へ渡すためのアルファ画像。RGBAの並びで、アルファにだけ意味がある。
 * `ImageData`ではなく素のオブジェクトで返すのは、Nodeでの単体テストのため。
 */
export type AlphaMap = {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
};

/**
 * レイヤーマスクをアルファ画像に組み替える。
 *
 * ag-psdはマスクの濃淡をRGBの各チャンネルへ複製し、アルファは全面255で返す。
 * `globalCompositeOperation = "destination-in"`はソースのアルファを見る演算なので、
 * `mask.imageData`をそのまま渡すと濃淡が無視され、マスク矩形での矩形切り抜きにしかならない。
 * Rチャンネルの値をアルファへ移す必要がある。
 *
 * `destination-in`は描画範囲の外も含めた宛先全体に効くため、対象の矩形いっぱいの大きさで作り、
 * マスク矩形の外側は`defaultColor`で埋める。これをしないと、マスク矩形がレイヤーより小さく
 * `defaultColor`が255（矩形外は表示）のときに矩形外が消える。
 */
export function buildMaskAlpha(
  mask: MaskRef,
  maskPixels: PixelSource,
  target: Bounds,
): AlphaMap {
  const width = target.right - target.left;
  const height = target.bottom - target.top;
  const data = new Uint8ClampedArray(width * height * 4);

  // Uint8ClampedArrayは0で初期化されるので、defaultColorが0のときは埋める必要がない
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
      // RGBに同じ値が入っているのでRだけ読む
      data[destination + 3] = maskPixels.data[source] ?? 0;
    }
  }

  return {data, width, height};
}
