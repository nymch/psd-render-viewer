import type {BlendMode, Layer, Psd} from "ag-psd";
import {resolveBlendMode} from "@/lib/psd/blendMode";

export const UNNAMED_LAYER = "(名称未設定)";

export type Bounds = {left: number; top: number; right: number; bottom: number};

/** ピクセルデータの実体はrefに置き、ノードはこのidだけを持つ */
export type PixelId = string;

export type PixelStore = Map<PixelId, PixelSource>;

/**
 * ag-psdの`PixelData`のうち、描画に使う部分だけを写したもの。
 * `ImageData`のコンストラクタは`SharedArrayBuffer`由来の配列を受け付けないため、
 * バッファの型まで絞った形で持つ。
 */
export type PixelSource = {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
};

export type MaskRef = {
  bounds: Bounds;
  /** マスク矩形の外側の値（0または255） */
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
  /** PSDが持つ値そのまま（0〜1）。レイヤーパネルに出す */
  opacity: number;
  /**
   * 合成で使う不透明度。祖先の`"pass through"`グループの分を掛け合わせてある。
   * 分離グループは自分のバッファへ掛けるため、子はここで1へリセットされる。
   */
  renderOpacity: number;
  blendMode: BlendMode;
  /** 未対応の描画モードはnormalへ倒した後の値 */
  compositeOperation: GlobalCompositeOperation;
  clipping: boolean;
  bounds: Bounds;
  mask: MaskRef | null;
  unsupported: UnsupportedReason[];
};

export type LayerLeaf = NodeCommon & {
  kind: "layer";
  /** ピクセルを持たないレイヤー（調整レイヤー等）ではnull */
  pixelId: PixelId | null;
};

export type LayerGroup = NodeCommon & {
  kind: "group";
  /** `"pass through"`以外なら自分のバッファへ合成する */
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

  // Photoshopの既定はレイヤーが「通常」、グループが「通過」
  const blendMode: BlendMode = layer.blendMode ?? (isGroup ? "pass through" : "normal");
  const opacity = layer.opacity ?? 1;
  const {operation, isSupported} = resolveBlendMode(blendMode);

  const unsupported: UnsupportedReason[] = [];
  if (!isSupported) unsupported.push({kind: "blend-mode", blendMode});
  if (layer.adjustment !== undefined) unsupported.push({kind: "adjustment-layer"});
  if (layer.effects !== undefined) unsupported.push({kind: "layer-effects"});
  if (layer.vectorMask !== undefined) unsupported.push({kind: "vector-mask"});
  // 明示的にfalseのときだけ未対応。undefinedはPhotoshopの既定であるオンとして扱う
  if (layer.blendClippendElements === false) {
    unsupported.push({kind: "clipped-elements-ungrouped"});
  }

  const common: NodeCommon = {
    id,
    name: layer.name ?? UNNAMED_LAYER,
    // ag-psdのhiddenは意味が反転している
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
    // 分離グループは自分のバッファへrenderOpacityを掛けるので、子へは伝えない。
    // 通過グループはバッファを持たないため、子へ掛け合わせて渡すしかない。
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
 * ag-psdの`PixelData`から描画に使える形を取り出す。
 * 8bitのPSDでは`data`がUint8ClampedArrayになる。16bit・32bitではUint16Array／Float32Arrayが
 * 入るためここでnullを返すが、そのようなPSDは`limits.ts`で先に弾いている。
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

/** `ImageData`へそのまま渡せる配列かを判定する */
function isDrawableArray(
  data: ArrayBufferView,
): data is Uint8ClampedArray<ArrayBuffer> {
  return data instanceof Uint8ClampedArray && data.buffer instanceof ArrayBuffer;
}

/** 未対応の要素を持つノードを数える。レイヤーパネルのヘッダに出す */
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
