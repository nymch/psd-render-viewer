import {buildMaskAlpha} from "@/lib/psd/mask";
import type {Bounds, LayerNode, PixelStore} from "@/lib/psd/tree";

/**
 * 分離モデルでの再帰合成。
 *
 * DOMには触れず`OffscreenCanvas`と`ImageData`だけで完結させる。後からWeb Workerへ移すときに
 * インターフェースを変えずに済む。
 */

type Origin = {x: number; y: number};

/** 描き終えたノード1つ分。originはバッファの左上のドキュメント座標 */
type Rendered = {canvas: OffscreenCanvas; origin: Origin};

/** クリッピングのまとまり。baseは直前の非クリッピングノード */
type Run =
  | {kind: "plain"; node: LayerNode}
  | {kind: "clip"; base: LayerNode; clipped: LayerNode[]};

type Context = {
  pixels: PixelStore;
  document: Bounds;
};

export type CompositeInput = {
  nodes: LayerNode[];
  pixels: PixelStore;
  width: number;
  height: number;
};

export function compositeDocument(input: CompositeInput): OffscreenCanvas {
  const documentBounds: Bounds = {
    left: 0,
    top: 0,
    right: input.width,
    bottom: input.height,
  };
  const canvas = new OffscreenCanvas(input.width, input.height);
  const ctx = getContext(canvas);
  drawNodes(ctx, {x: 0, y: 0}, input.nodes, {
    pixels: input.pixels,
    document: documentBounds,
  });
  return canvas;
}

function drawNodes(
  ctx: OffscreenCanvasRenderingContext2D,
  origin: Origin,
  nodes: LayerNode[],
  context: Context,
): void {
  for (const run of toRuns(nodes)) {
    if (run.kind === "clip") {
      drawClipRun(ctx, origin, run, context);
      continue;
    }

    const node = run.node;
    if (!node.visible) continue;

    // 通過グループは自分のバッファを持たず、親へ直接描く。
    // マスクが付いている場合だけは掛ける相手が要るので、分離グループと同じ経路へ回す。
    if (node.kind === "group" && !node.isolated && node.mask === null) {
      drawNodes(ctx, origin, node.children, context);
      continue;
    }

    const rendered = renderNode(node, context);
    if (rendered === null) continue;
    compositeOnto(ctx, origin, rendered, node.compositeOperation, node.renderOpacity);
    rendered.canvas.width = 0;
  }
}

/**
 * クリッピングのまとまりを合成する。
 *
 * ベースの`blendMode`と`opacity`を手順1ではなく手順4で使うのは、Photoshopの
 * 「クリッピングレイヤーをグループとして合成」がオンのときの挙動に合わせるため。
 * 手順1で乗算などを適用すると、クリッピングレイヤーが合成後のベースに重なって絵が変わる。
 */
function drawClipRun(
  ctx: OffscreenCanvasRenderingContext2D,
  origin: Origin,
  run: {base: LayerNode; clipped: LayerNode[]},
  context: Context,
): void {
  if (!run.base.visible) return;

  const base = renderNode(run.base, context);
  // ベースが描けないならクリッピングレイヤーの寄る辺が無いので、まとまりごと消える
  if (base === null) return;

  const visibleClipped = run.clipped.filter((node) => node.visible);
  if (visibleClipped.length === 0) {
    compositeOnto(ctx, origin, base, run.base.compositeOperation, run.base.renderOpacity);
    base.canvas.width = 0;
    return;
  }

  const extent = clampToDocument(
    unionBounds([nodeExtent(run.base), ...visibleClipped.map(nodeExtent)]),
    context.document,
  );
  if (extent === null) {
    base.canvas.width = 0;
    return;
  }

  const buffer = new OffscreenCanvas(
    extent.right - extent.left,
    extent.bottom - extent.top,
  );
  const bufferCtx = getContext(buffer);
  const bufferOrigin: Origin = {x: extent.left, y: extent.top};

  // 1. ベースを通常合成・不透明度1で置く
  compositeOnto(bufferCtx, bufferOrigin, base, "source-over", 1);

  // 2. クリッピングレイヤー群をそれぞれの描画モードで重ねる
  for (const node of visibleClipped) {
    const rendered = renderNode(node, context);
    if (rendered === null) continue;
    compositeOnto(
      bufferCtx,
      bufferOrigin,
      rendered,
      node.compositeOperation,
      node.renderOpacity,
    );
    rendered.canvas.width = 0;
  }

  // 3. ベースのアルファで切り抜く
  compositeOnto(bufferCtx, bufferOrigin, base, "destination-in", 1);
  base.canvas.width = 0;

  // 4. ベースの描画モードと不透明度でまとまり全体を親へ
  compositeOnto(
    ctx,
    origin,
    {canvas: buffer, origin: bufferOrigin},
    run.base.compositeOperation,
    run.base.renderOpacity,
  );
  buffer.width = 0;
}

/** ノード1つを自分のバッファへ描く。マスクは適用済み、描画モードと不透明度は未適用 */
function renderNode(node: LayerNode, context: Context): Rendered | null {
  if (!node.visible) return null;

  const extent = clampToDocument(nodeExtent(node), context.document);
  if (extent === null) return null;

  const canvas = new OffscreenCanvas(
    extent.right - extent.left,
    extent.bottom - extent.top,
  );
  const ctx = getContext(canvas);
  const origin: Origin = {x: extent.left, y: extent.top};

  if (node.kind === "layer") {
    const source = node.pixelId === null ? undefined : context.pixels.get(node.pixelId);
    if (source === undefined) {
      canvas.width = 0;
      return null;
    }
    // 負のオフセットになりうるが、putImageDataは範囲外を切り落とすので問題ない
    ctx.putImageData(
      new ImageData(source.data, source.width, source.height),
      node.bounds.left - origin.x,
      node.bounds.top - origin.y,
    );
  } else {
    drawNodes(ctx, origin, node.children, context);
  }

  applyMask(ctx, node, extent, context);
  return {canvas, origin};
}

function applyMask(
  ctx: OffscreenCanvasRenderingContext2D,
  node: LayerNode,
  target: Bounds,
  context: Context,
): void {
  if (node.mask === null) return;
  const maskPixels = context.pixels.get(node.mask.pixelId);
  if (maskPixels === undefined) return;

  const alpha = buildMaskAlpha(node.mask, maskPixels, target);
  // putImageDataは合成演算を無視するため、一時バッファを経由してdrawImageで掛ける
  const maskCanvas = new OffscreenCanvas(alpha.width, alpha.height);
  getContext(maskCanvas).putImageData(
    new ImageData(alpha.data, alpha.width, alpha.height),
    0,
    0,
  );

  ctx.globalCompositeOperation = "destination-in";
  ctx.globalAlpha = 1;
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  maskCanvas.width = 0;
}

function compositeOnto(
  ctx: OffscreenCanvasRenderingContext2D,
  origin: Origin,
  rendered: Rendered,
  operation: GlobalCompositeOperation,
  opacity: number,
): void {
  ctx.globalCompositeOperation = operation;
  ctx.globalAlpha = opacity;
  ctx.drawImage(
    rendered.canvas,
    rendered.origin.x - origin.x,
    rendered.origin.y - origin.y,
  );
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

/**
 * クリッピングレイヤーを直前の非クリッピングレイヤーへまとめる。
 * `children`は背面からの順なので、直前の要素が下のレイヤーにあたる。
 */
function toRuns(nodes: LayerNode[]): Run[] {
  const runs: Run[] = [];
  for (const node of nodes) {
    const previous = runs[runs.length - 1];
    if (node.clipping && previous !== undefined) {
      if (previous.kind === "clip") {
        previous.clipped.push(node);
      } else {
        runs[runs.length - 1] = {kind: "clip", base: previous.node, clipped: [node]};
      }
      continue;
    }
    runs.push({kind: "plain", node});
  }
  return runs;
}

/**
 * ノードが実際に描く範囲。バッファをドキュメントサイズで取らないための計算。
 * グループは子孫の範囲の和集合になる。マスクは範囲を狭めるだけなので考えなくてよい。
 */
function nodeExtent(node: LayerNode): Bounds | null {
  if (!node.visible) return null;
  if (node.kind === "layer") {
    if (node.pixelId === null) return null;
    return isEmpty(node.bounds) ? null : node.bounds;
  }
  return unionBounds(node.children.map(nodeExtent));
}

function unionBounds(bounds: (Bounds | null)[]): Bounds | null {
  return bounds.reduce<Bounds | null>((merged, current) => {
    if (current === null) return merged;
    if (merged === null) return current;
    return {
      left: Math.min(merged.left, current.left),
      top: Math.min(merged.top, current.top),
      right: Math.max(merged.right, current.right),
      bottom: Math.max(merged.bottom, current.bottom),
    };
  }, null);
}

function clampToDocument(bounds: Bounds | null, document: Bounds): Bounds | null {
  if (bounds === null) return null;
  const clamped: Bounds = {
    left: Math.max(bounds.left, document.left),
    top: Math.max(bounds.top, document.top),
    right: Math.min(bounds.right, document.right),
    bottom: Math.min(bounds.bottom, document.bottom),
  };
  return isEmpty(clamped) ? null : clamped;
}

function isEmpty(bounds: Bounds): boolean {
  return bounds.right <= bounds.left || bounds.bottom <= bounds.top;
}

function getContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("2Dコンテキストを取得できなかった");
  return ctx;
}
