import type {BlendMode} from "ag-psd";

/**
 * Photoshopの描画モードとCanvas 2Dの合成演算の対応。
 *
 * `null`は対応する演算が無いもの。方針はADR-0002（docs/adr/0002-blend-mode-mapping.md）で、
 * 自前のピクセル演算では埋めず`normal`へ倒して未対応として記録する。
 *
 * `"pass through"`はグループを分離するかどうかの分岐で合成演算ではないため、この表には含めない。
 */
const BLEND_MODE_MAP: Record<
  Exclude<BlendMode, "pass through">,
  GlobalCompositeOperation | null
> = {
  normal: "source-over",
  darken: "darken",
  multiply: "multiply",
  "color burn": "color-burn",
  lighten: "lighten",
  screen: "screen",
  "color dodge": "color-dodge",
  overlay: "overlay",
  "soft light": "soft-light",
  "hard light": "hard-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",

  dissolve: null,
  "linear burn": null,
  "darker color": null,
  "linear dodge": null,
  "lighter color": null,
  "vivid light": null,
  "linear light": null,
  "pin light": null,
  "hard mix": null,
  subtract: null,
  divide: null,

  // ディスクリプタ経由（レイヤー効果・ベクトルストローク）でしか出ないため、layer.blendModeには現れない。
  // BlendModeのunionを網羅するために置いている。
  "linear height": null,
  height: null,
  subtraction: null,
};

const FALLBACK_OPERATION: GlobalCompositeOperation = "source-over";

export type BlendModeResolution = {
  /** 実際に使う合成演算。未対応のときはフォールバック済みの値が入る */
  operation: GlobalCompositeOperation;
  /** falseなら対応する演算が無く、normalへ倒している */
  isSupported: boolean;
};

/**
 * 描画モードを合成演算へ写す。写せないものはnormalへ倒し、`isSupported: false`で知らせる。
 * `BlendMode`のどの値を渡しても例外を投げない。
 */
export function resolveBlendMode(
  blendMode: BlendMode | undefined,
): BlendModeResolution {
  // undefinedはPhotoshopの既定である通常合成として扱う。未対応ではない。
  if (blendMode === undefined || blendMode === "pass through") {
    return {operation: FALLBACK_OPERATION, isSupported: true};
  }

  const operation = BLEND_MODE_MAP[blendMode];
  if (operation === null || operation === undefined) {
    return {operation: FALLBACK_OPERATION, isSupported: false};
  }
  return {operation, isSupported: true};
}
