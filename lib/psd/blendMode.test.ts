import {describe, expect, it} from "vitest";
import type {BlendMode} from "ag-psd";
import {resolveBlendMode} from "@/lib/psd/blendMode";

// The 10 with no corresponding operation in Canvas 2D (ADR-0002)
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
    "falls %s back to normal and records it as unsupported",
    (blendMode) => {
      expect(resolveBlendMode(blendMode)).toEqual({
        operation: "source-over",
        isSupported: false,
      });
    },
  );

  it("never throws for any value of BlendMode", () => {
    for (const blendMode of ALL_BLEND_MODES) {
      expect(() => resolveBlendMode(blendMode)).not.toThrow();
    }
  });

  it("treats undefined as normal compositing without marking it unsupported", () => {
    expect(resolveBlendMode(undefined)).toEqual({
      operation: "source-over",
      isSupported: true,
    });
  });

  it("returns normal compositing for pass through without marking it unsupported", () => {
    expect(resolveBlendMode("pass through")).toEqual({
      operation: "source-over",
      isSupported: true,
    });
  });

  it("maps exactly 17 blend modes", () => {
    const supported = ALL_BLEND_MODES.filter(
      (mode) => mode !== "pass through" && resolveBlendMode(mode).isSupported,
    );
    expect(supported).toHaveLength(17);
  });

  it("maps linear dodge onto the additive lighter", () => {
    // Not a blend mode, but it agrees with linear dodge when the backdrop is opaque
    expect(resolveBlendMode("linear dodge")).toEqual({
      operation: "lighter",
      isSupported: true,
    });
  });
});
