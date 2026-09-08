import {readPsd} from "ag-psd";
import type {Psd} from "ag-psd";

/**
 * デコードに使うメモリの累積上限。
 *
 * `ag-psd`の既定は2GBで、100MB級のPSDがここに当たって開けなかった。既定値に乗ったままだと
 * ライブラリの更新で挙動が変わるため、こちらの値として明示する。
 * `undefined`を渡すと上限そのものが外れるが、それでは落ちるときにエラーではなく
 * タブごと落ちるので取らない。
 */
const TOTAL_MEMORY_LIMIT = 4 * 1024 * 1024 * 1024;

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
    totalMemoryLimit: TOTAL_MEMORY_LIMIT,
  });
}
