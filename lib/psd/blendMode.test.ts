import {describe, expect, it} from "vitest";
import type {BlendMode} from "ag-psd";
import {resolveBlendMode} from "@/lib/psd/blendMode";

// Canvas 2Dに対応する演算が無い10個（ADR-0002）
const UNSUPPORTED: BlendMode[] = [
  "dissolve",
  "linear burn",
  "darker color",
  "lighter color",
  "vivid light",
  "linear light",
  "pin light",
  "hard mix",
  "subtract",
  "divide",
];

const ALL_BLEND_MODES: BlendMode[] = [
  "pass through",
  "normal",
  "dissolve",
  "darken",
  "multiply",
  "color burn",
  "linear burn",
  "darker color",
  "lighten",
  "screen",
  "color dodge",
  "linear dodge",
  "lighter color",
  "overlay",
  "soft light",
  "hard light",
  "vivid light",
  "linear light",
  "pin light",
  "hard mix",
  "difference",
  "exclusion",
  "subtract",
  "divide",
  "hue",
  "saturation",
  "color",
  "luminosity",
  "linear height",
  "height",
  "subtraction",
];

describe("resolveBlendMode", () => {
  it.each(UNSUPPORTED)(
    "「%s」は対応する演算が無いのでnormalへ倒し、未対応として記録される",
    (blendMode) => {
      expect(resolveBlendMode(blendMode)).toEqual({
        operation: "source-over",
        isSupported: false,
      });
    },
  );

  it("BlendModeのどの値を渡しても例外を投げない", () => {
    for (const blendMode of ALL_BLEND_MODES) {
      expect(() => resolveBlendMode(blendMode)).not.toThrow();
    }
  });

  it("blendModeがundefinedのときは通常合成として扱い、未対応にしない", () => {
    expect(resolveBlendMode(undefined)).toEqual({
      operation: "source-over",
      isSupported: true,
    });
  });

  it("pass throughは合成演算ではないので、未対応にせず通常合成を返す", () => {
    expect(resolveBlendMode("pass through")).toEqual({
      operation: "source-over",
      isSupported: true,
    });
  });

  it("写せるモードは17個ある", () => {
    const supported = ALL_BLEND_MODES.filter(
      (mode) => mode !== "pass through" && resolveBlendMode(mode).isSupported,
    );
    expect(supported).toHaveLength(17);
  });

  it("linear dodgeは加算合成のlighterへ写す", () => {
    // ブレンドモードではないが、下地が不透明なら覆い焼き(リニア)と一致する
    expect(resolveBlendMode("linear dodge")).toEqual({
      operation: "lighter",
      isSupported: true,
    });
  });
});
