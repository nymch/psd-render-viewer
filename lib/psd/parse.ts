import {readPsd} from "ag-psd";
import type {Psd} from "ag-psd";

/**
 * `readPsd`のラッパ。オプションを固定する。
 *
 * `useImageData: true`でcanvasではなくPixelDataを受け取り、合成済み画像とサムネイルは
 * 自前で合成するため読まない。同期関数なので、呼ぶ前に1フレーム譲る必要がある
 * （`hooks/psdHooks.ts`を参照）。
 */
export function parsePsd(buffer: ArrayBuffer): Psd {
  return readPsd(buffer, {
    useImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
  });
}
