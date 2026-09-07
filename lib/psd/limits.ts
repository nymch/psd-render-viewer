/**
 * ドキュメントを開けるかどうかの判定。
 *
 * 上限は長辺と面積の両方で見る。ブラウザのCanvasは辺の長さと面積の両方に制約があり、
 * Chromeの面積上限は268,435,456px（16384×16384ちょうど）。長辺だけを条件にすると
 * 16384×16384が素通りして面積上限に当たる。
 *
 * 面積の上限はメモリから逆算している。ドキュメントサイズで確保されるのは表示用Canvas・
 * ルートのバッファ・合成結果のImageBitmapの3枚で、8192×8192相当なら1枚268MB・3枚で約800MB。
 * どちらの値も仮置きで、実測して調整する。
 */
export const MAX_EDGE = 16384;
export const MAX_AREA = 8192 * 8192;

/** ag-psdのimageDataが本物のImageDataになるのは8bitのときだけ。16bit・32bitは描画できない */
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
 * 16bit・32bitのPSDを弾く。ag-psdはこの場合`imageData`をUint16Array／Float32Arrayを持つ
 * ただのオブジェクトで返し、`putImageData`が受け付けない。
 */
export function checkBitsPerChannel(
  bitsPerChannel: number | undefined,
): DocumentCheck {
  // undefinedのときはPSDのヘッダから読めなかったということで、8bitとみなして進める
  if (bitsPerChannel === undefined) return {ok: true};

  if (bitsPerChannel !== SUPPORTED_BITS_PER_CHANNEL) {
    return {ok: false, reason: "bits-per-channel", bitsPerChannel};
  }
  return {ok: true};
}

export function describeRejection(rejection: DocumentRejection): string {
  switch (rejection.reason) {
    case "edge":
      return `画像の長辺が${rejection.edge}pxで、上限の${rejection.limit}pxを超えている`;
    case "area":
      return `画像の面積が${rejection.area.toLocaleString()}pxで、上限の${rejection.limit.toLocaleString()}pxを超えている`;
    case "bits-per-channel":
      return `${rejection.bitsPerChannel}bit/チャンネルのPSDには対応していない（8bitのみ）`;
    default:
      return rejection satisfies never;
  }
}
