import {describe, expect, it} from "vitest";
import {buildMaskAlpha} from "@/lib/psd/mask";
import type {Bounds, MaskRef, PixelSource} from "@/lib/psd/tree";

/** ag-psdはマスクの濃淡をRGBへ複製し、アルファは全面255で返す。その形を再現する */
function maskPixels(values: number[], width: number, height: number): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4);
  values.forEach((value, index) => {
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = 255;
  });
  return {data, width, height};
}

function alphaAt(
  map: {data: Uint8ClampedArray; width: number},
  x: number,
  y: number,
): number | undefined {
  return map.data[(y * map.width + x) * 4 + 3];
}

const TARGET: Bounds = {left: 0, top: 0, right: 2, bottom: 2};

function mask(overrides: Partial<MaskRef> = {}): MaskRef {
  return {
    bounds: {left: 0, top: 0, right: 2, bottom: 2},
    defaultColor: 0,
    pixelId: "mask",
    ...overrides,
  };
}

describe("buildMaskAlpha", () => {
  it("マスクのRチャンネルの値がアルファへ移る", () => {
    const result = buildMaskAlpha(
      mask(),
      maskPixels([0, 64, 128, 255], 2, 2),
      TARGET,
    );
    expect(alphaAt(result, 0, 0)).toBe(0);
    expect(alphaAt(result, 1, 0)).toBe(64);
    expect(alphaAt(result, 0, 1)).toBe(128);
    expect(alphaAt(result, 1, 1)).toBe(255);
  });

  it("マスク矩形が対象より小さいとき、外側がdefaultColorで埋まる", () => {
    // defaultColorが255（矩形外は表示）なので、埋めないと矩形外が消える
    const result = buildMaskAlpha(
      mask({bounds: {left: 0, top: 0, right: 1, bottom: 1}, defaultColor: 255}),
      maskPixels([0], 1, 1),
      TARGET,
    );
    expect(alphaAt(result, 0, 0)).toBe(0);
    expect(alphaAt(result, 1, 0)).toBe(255);
    expect(alphaAt(result, 0, 1)).toBe(255);
    expect(alphaAt(result, 1, 1)).toBe(255);
  });

  it("defaultColorが0のときは矩形の外が透明になる", () => {
    const result = buildMaskAlpha(
      mask({bounds: {left: 0, top: 0, right: 1, bottom: 1}, defaultColor: 0}),
      maskPixels([255], 1, 1),
      TARGET,
    );
    expect(alphaAt(result, 0, 0)).toBe(255);
    expect(alphaAt(result, 1, 1)).toBe(0);
  });

  it("マスク矩形がずれていても対象の座標へ合わせて書き込む", () => {
    const result = buildMaskAlpha(
      mask({bounds: {left: 1, top: 1, right: 2, bottom: 2}}),
      maskPixels([200], 1, 1),
      TARGET,
    );
    expect(alphaAt(result, 0, 0)).toBe(0);
    expect(alphaAt(result, 1, 1)).toBe(200);
  });

  it("対象の外へはみ出したマスクは切り落とされる", () => {
    const result = buildMaskAlpha(
      mask({bounds: {left: 1, top: 1, right: 4, bottom: 4}}),
      maskPixels([10, 20, 30, 40, 50, 60, 70, 80, 90], 3, 3),
      TARGET,
    );
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(alphaAt(result, 1, 1)).toBe(10);
  });

  it("結果は対象の矩形と同じ大きさになる", () => {
    const result = buildMaskAlpha(mask(), maskPixels([0, 0, 0, 0], 2, 2), {
      left: 5,
      top: 5,
      right: 12,
      bottom: 9,
    });
    expect(result.width).toBe(7);
    expect(result.height).toBe(4);
  });
});
