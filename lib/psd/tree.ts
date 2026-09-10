import type {BlendMode, Layer, Psd} from "ag-psd";
import {resolveBlendMode} from "@/lib/psd/blendMode";

export const UNNAMED_LAYER = "(名称未設定)";

export type Bounds = {left: number; top: number; right: number; bottom: number};

/** Pixel data itself lives on a ref; a node holds only this id */
export type PixelId = string;

export type PixelStore = Map<PixelId, PixelSource>;

/**
 * The part of ag-psd's `PixelData` that drawing actually uses.
 * `ImageData`'s constructor does not accept an array backed by a `SharedArrayBuffer`, so this
 * is narrowed all the way down to the buffer type.
 */
export type PixelSource = {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
};

export type MaskRef = {
  bounds: Bounds;
  /** The value outside the mask rectangle, 0 or 255 */
  defaultColor: number;
  pixelId: PixelId;
};

export type UnsupportedReason =
  | {kind: "adjustment-layer"}
  | {kind: "layer-effects"}
  | {kind: "blend-mode"; blendMode: BlendMode}
  | {kind: "clipped-elements-ungrouped"}
  | {kind: "vector-mask"};

type NodeCommon = {
  id: string;
  name: string;
  visible: boolean;
  /** The PSD's own value (0-1), as it is. Shown in the layer panel */
  opacity: number;
  /**
   * The opacity compositing uses, with any ancestor `"pass through"` groups already multiplied
   * in. An isolated group applies its own to its buffer, so its children are reset to 1 here.
   */
  renderOpacity: number;
  blendMode: BlendMode;
  /** For an unsupported blend mode, the value after falling back to normal */
  compositeOperation: GlobalCompositeOperation;
  clipping: boolean;
  bounds: Bounds;
  mask: MaskRef | null;
  unsupported: UnsupportedReason[];
};

export type LayerLeaf = NodeCommon & {
  kind: "layer";
  /** Null on a layer that carries no pixels, such as an adjustment layer */
  pixelId: PixelId | null;
};

export type LayerGroup = NodeCommon & {
  kind: "group";
  /** Anything other than `"pass through"` composites into a buffer of its own */
  isolated: boolean;
  children: LayerNode[];
};

export type LayerNode = LayerLeaf | LayerGroup;

export type LayerTree = {
  nodes: LayerNode[];
  pixels: PixelStore;
};

const EMPTY_BOUNDS: Bounds = {left: 0, top: 0, right: 0, bottom: 0};

export function buildLayerTree(psd: Psd): LayerTree {
  const pixels: PixelStore = new Map();
  const counter = {value: 0};
  const nodes = buildNodes(psd.children ?? [], pixels, counter, 1);
  return {nodes, pixels};
}

function buildNodes(
  layers: Layer[],
  pixels: PixelStore,
  counter: {value: number},
  inheritedOpacity: number,
): LayerNode[] {
  return layers.map((layer) =>
    buildNode(layer, pixels, counter, inheritedOpacity),
  );
}

function buildNode(
  layer: Layer,
  pixels: PixelStore,
  counter: {value: number},
  inheritedOpacity: number,
): LayerNode {
  const id = `node-${counter.value++}`;
  const isGroup = layer.children !== undefined;

  // Photoshop defaults a layer to normal and a group to pass through
  const blendMode: BlendMode = layer.blendMode ?? (isGroup ? "pass through" : "normal");
  const opacity = layer.opacity ?? 1;
  const {operation, isSupported} = resolveBlendMode(blendMode);

  const unsupported: UnsupportedReason[] = [];
  if (!isSupported) unsupported.push({kind: "blend-mode", blendMode});
  if (layer.adjustment !== undefined) unsupported.push({kind: "adjustment-layer"});
  if (layer.effects !== undefined) unsupported.push({kind: "layer-effects"});
  if (layer.vectorMask !== undefined) unsupported.push({kind: "vector-mask"});
  // Unsupported only when explicitly false. undefined is Photoshop's default, which is on
  if (layer.blendClippendElements === false) {
    unsupported.push({kind: "clipped-elements-ungrouped"});
  }

  const common: NodeCommon = {
    id,
    name: layer.name ?? UNNAMED_LAYER,
    // ag-psd's hidden means the opposite of what it reads like
    visible: !layer.hidden,
    opacity,
    renderOpacity: opacity * inheritedOpacity,
    blendMode,
    compositeOperation: operation,
    clipping: layer.clipping === true,
    bounds: toBounds(layer),
    mask: takeMask(layer, pixels, id),
    unsupported,
  };

  if (!isGroup) {
    return {...common, kind: "layer", pixelId: takePixels(layer, pixels, id)};
  }

  const isolated = blendMode !== "pass through";
  return {
    ...common,
    kind: "group",
    isolated,
    // An isolated group applies renderOpacity to its own buffer, so it is not passed down.
    // A pass-through group has no buffer, so multiplying it into the children is the only way.
    renderOpacity: isolated ? common.renderOpacity : 1,
    children: buildNodes(
      layer.children ?? [],
      pixels,
      counter,
      isolated ? 1 : common.renderOpacity,
    ),
  };
}

function toBounds(layer: Layer): Bounds {
  const left = layer.left ?? 0;
  const top = layer.top ?? 0;
  const right = layer.right ?? left;
  const bottom = layer.bottom ?? top;
  if (right <= left || bottom <= top) return EMPTY_BOUNDS;
  return {left, top, right, bottom};
}

function takePixels(
  layer: Layer,
  pixels: PixelStore,
  nodeId: string,
): PixelId | null {
  const source = toPixelSource(layer.imageData);
  if (source === null) return null;
  const pixelId = `${nodeId}-image`;
  pixels.set(pixelId, source);
  return pixelId;
}

function takeMask(
  layer: Layer,
  pixels: PixelStore,
  nodeId: string,
): MaskRef | null {
  const mask = layer.mask;
  if (mask === undefined || mask.disabled === true) return null;

  const source = toPixelSource(mask.imageData);
  if (source === null) return null;

  const left = mask.left ?? 0;
  const top = mask.top ?? 0;
  const right = mask.right ?? left;
  const bottom = mask.bottom ?? top;
  if (right <= left || bottom <= top) return null;

  const pixelId = `${nodeId}-mask`;
  pixels.set(pixelId, source);
  return {
    bounds: {left, top, right, bottom},
    defaultColor: mask.defaultColor ?? 0,
    pixelId,
  };
}

/**
 * Takes a drawable form out of ag-psd's `PixelData`.
 * On an 8-bit PSD, `data` is a Uint8ClampedArray. At 16 and 32 bits it holds a Uint16Array or
 * Float32Array, so this returns null - though `limits.ts` rejects such a PSD first.
 */
function toPixelSource(
  pixelData: {data: ArrayBufferView; width: number; height: number} | undefined,
): PixelSource | null {
  if (pixelData === undefined) return null;
  if (!isDrawableArray(pixelData.data)) return null;
  if (pixelData.width <= 0 || pixelData.height <= 0) return null;
  return {
    data: pixelData.data,
    width: pixelData.width,
    height: pixelData.height,
  };
}

/** Whether the array can be handed to `ImageData` as it is */
function isDrawableArray(
  data: ArrayBufferView,
): data is Uint8ClampedArray<ArrayBuffer> {
  return data instanceof Uint8ClampedArray && data.buffer instanceof ArrayBuffer;
}

/** Counts nodes carrying an unsupported element. Shown in the layer panel's header */
export function countUnsupported(nodes: LayerNode[]): number {
  return nodes.reduce((total, node) => {
    const own = node.unsupported.length > 0 ? 1 : 0;
    const children = node.kind === "group" ? countUnsupported(node.children) : 0;
    return total + own + children;
  }, 0);
}

export function describeUnsupported(reason: UnsupportedReason): string {
  switch (reason.kind) {
    case "adjustment-layer":
      return "調整レイヤーは描画しない。下のレイヤーの色は変わらない";
    case "layer-effects":
      return "レイヤー効果は再現しない。効果を除いたピクセルだけを描く";
    case "blend-mode":
      return `描画モード「${reason.blendMode}」に対応する合成演算が無いため、通常合成で描く`;
    case "clipped-elements-ungrouped":
      return "クリッピングレイヤーをグループとして合成しない設定には対応していない";
    case "vector-mask":
      return "ベクトルマスクは適用しない";
    default:
      return reason satisfies never;
  }
}
