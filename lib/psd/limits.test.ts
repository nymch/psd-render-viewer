import {describe, expect, it} from "vitest";
import {
  MAX_AREA,
  MAX_EDGE,
  checkBitsPerChannel,
  checkDocumentSize,
} from "@/lib/psd/limits";

describe("checkDocumentSize", () => {
  it("rejects a document whose longest edge is over the limit", () => {
    const result = checkDocumentSize(MAX_EDGE + 1, 100);
    expect(result).toEqual({
      ok: false,
      reason: "edge",
      edge: MAX_EDGE + 1,
      limit: MAX_EDGE,
    });
  });

  it("rejects a document within the edge limit but over the area limit", () => {
    // 16384x16384 sails past the edge check, and its area is Chrome's limit exactly
    const result = checkDocumentSize(MAX_EDGE, MAX_EDGE);
    expect(result).toEqual({
      ok: false,
      reason: "area",
      area: MAX_EDGE * MAX_EDGE,
      limit: MAX_AREA,
    });
  });

  it("accepts a document sitting exactly on both limits", () => {
    // 16384x4096 = 67,108,864, exactly on both the edge and the area limit
    expect(checkDocumentSize(MAX_EDGE, MAX_AREA / MAX_EDGE)).toEqual({ok: true});
  });

  it("measures the longest edge on a portrait document too", () => {
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
  it("accepts an 8-bit PSD", () => {
    expect(checkBitsPerChannel(8)).toEqual({ok: true});
  });

  it("rejects a 16-bit PSD", () => {
    expect(checkBitsPerChannel(16)).toEqual({
      ok: false,
      reason: "bits-per-channel",
      bitsPerChannel: 16,
    });
  });

  it("rejects a 32-bit PSD", () => {
    expect(checkBitsPerChannel(32)).toEqual({
      ok: false,
      reason: "bits-per-channel",
      bitsPerChannel: 32,
    });
  });

  it("assumes 8 bits and accepts when the depth could not be read", () => {
    expect(checkBitsPerChannel(undefined)).toEqual({ok: true});
  });
});
