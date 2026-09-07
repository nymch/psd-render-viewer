import {describe, expect, it} from "vitest";
import {
  MAX_AREA,
  MAX_EDGE,
  checkBitsPerChannel,
  checkDocumentSize,
} from "@/lib/psd/limits";

describe("checkDocumentSize", () => {
  it("長辺が上限を超えるドキュメントが弾かれる", () => {
    const result = checkDocumentSize(MAX_EDGE + 1, 100);
    expect(result).toEqual({
      ok: false,
      reason: "edge",
      edge: MAX_EDGE + 1,
      limit: MAX_EDGE,
    });
  });

  it("長辺が上限内でも面積が上限を超えるドキュメントが弾かれる", () => {
    // 16384×16384は長辺の判定を素通りするが、面積がChromeの上限そのもの
    const result = checkDocumentSize(MAX_EDGE, MAX_EDGE);
    expect(result).toEqual({
      ok: false,
      reason: "area",
      area: MAX_EDGE * MAX_EDGE,
      limit: MAX_AREA,
    });
  });

  it("長辺と面積がどちらもちょうど上限のとき通る", () => {
    // 16384×4096 = 67,108,864で、長辺も面積も上限ぴったり
    expect(checkDocumentSize(MAX_EDGE, MAX_AREA / MAX_EDGE)).toEqual({ok: true});
  });

  it("縦長でも長辺で判定する", () => {
    const result = checkDocumentSize(100, MAX_EDGE + 1);
    expect(result).toEqual({
      ok: false,
      reason: "edge",
      edge: MAX_EDGE + 1,
      limit: MAX_EDGE,
    });
  });
});

describe("checkBitsPerChannel", () => {
  it("8bitのPSDは通る", () => {
    expect(checkBitsPerChannel(8)).toEqual({ok: true});
  });

  it("16bitのPSDは弾かれる", () => {
    expect(checkBitsPerChannel(16)).toEqual({
      ok: false,
      reason: "bits-per-channel",
      bitsPerChannel: 16,
    });
  });

  it("32bitのPSDは弾かれる", () => {
    expect(checkBitsPerChannel(32)).toEqual({
      ok: false,
      reason: "bits-per-channel",
      bitsPerChannel: 32,
    });
  });

  it("読み取れなかったときは8bitとみなして通す", () => {
    expect(checkBitsPerChannel(undefined)).toEqual({ok: true});
  });
});
