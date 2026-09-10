import type {BlendMode} from "ag-psd";

/**
 * How Photoshop's blend modes map onto Canvas 2D's compositing operations.
 *
 * `null` means no operation corresponds. The approach is settled in ADR-0002
 * (docs/adr/0002-blend-mode-mapping.md): rather than filling the gaps with pixel math of our
 * own, fall back to `normal` and record the layer as unsupported.
 *
 * `"pass through"` decides whether a group is isolated and is not a compositing operation, so
 * it is not in this table.
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

  // "lighter" is additive compositing rather than a blend mode, but it agrees exactly with
  // linear dodge when the backdrop is opaque (measured, saturation and semi-transparent
  // sources included). Only over a semi-transparent backdrop does alpha get summed too,
  // coming out more opaque than it should. Details in ADR-0002.
  "linear dodge": "lighter",

  dissolve: null,
  "linear burn": null,
  "darker color": null,
  "lighter color": null,
  "vivid light": null,
  "linear light": null,
  "pin light": null,
  "hard mix": null,
  subtract: null,
  divide: null,

  // These only ever arrive through a descriptor (a layer effect or a vector stroke), so they
  // never appear on layer.blendMode. They are here to cover the BlendMode union.
  "linear height": null,
  height: null,
  subtraction: null,
};

const FALLBACK_OPERATION: GlobalCompositeOperation = "source-over";

export type BlendModeResolution = {
  /** The operation actually used. Already the fallback value when unsupported */
  operation: GlobalCompositeOperation;
  /** False means no operation corresponds and it fell back to normal */
  isSupported: boolean;
};

/**
 * Maps a blend mode onto a compositing operation. What cannot be mapped falls back to normal
 * and reports `isSupported: false`. No value of `BlendMode` makes it throw.
 */
export function resolveBlendMode(
  blendMode: BlendMode | undefined,
): BlendModeResolution {
  // undefined is treated as Photoshop's default, normal compositing. Not unsupported.
  if (blendMode === undefined || blendMode === "pass through") {
    return {operation: FALLBACK_OPERATION, isSupported: true};
  }

  const operation = BLEND_MODE_MAP[blendMode];
  if (operation === null || operation === undefined) {
    return {operation: FALLBACK_OPERATION, isSupported: false};
  }
  return {operation, isSupported: true};
}
