import {buildMaskAlpha} from "@/lib/psd/mask";
import type {Bounds, LayerNode, PixelStore} from "@/lib/psd/tree";

/**
 * Recursive compositing, isolated model.
 *
 * Touches no DOM and works entirely through `OffscreenCanvas` and `ImageData`, so moving it
 * into a Web Worker later takes no change to the interface.
 */

type Origin = {x: number; y: number};

/** One finished node. origin is the buffer's top-left in document coordinates */
type Rendered = {canvas: OffscreenCanvas; origin: Origin};

/** A clipping run. base is the nearest non-clipping node below */
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

    // A pass-through group has no buffer of its own and draws straight into the parent.
    // Only when it carries a mask does it need something to apply that to, so it goes down the
    // same path as an isolated group.
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
 * Composites a clipping run.
 *
 * The base's `blendMode` and `opacity` are used in step 4 rather than step 1 to match
 * Photoshop's behavior when "blend clipped layers as group" is on. Applying multiply and the
 * like in step 1 would put the clipping layers on top of an already-composited base, changing
 * the picture.
 */
function drawClipRun(
  ctx: OffscreenCanvasRenderingContext2D,
  origin: Origin,
  run: {base: LayerNode; clipped: LayerNode[]},
  context: Context,
): void {
  if (!run.base.visible) return;

  const base = renderNode(run.base, context);
  // With no base to draw, the clipping layers have nothing to sit on, so the run disappears
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

  // 1. Lay the base down with normal compositing and opacity 1
  compositeOnto(bufferCtx, bufferOrigin, base, "source-over", 1);

  // 2. Stack the clipping layers, each with its own blend mode
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

  // 3. Clip to the base's alpha
  compositeOnto(bufferCtx, bufferOrigin, base, "destination-in", 1);
  base.canvas.width = 0;

  // 4. Composite the whole run into the parent with the base's blend mode and opacity
  compositeOnto(
    ctx,
    origin,
    {canvas: buffer, origin: bufferOrigin},
    run.base.compositeOperation,
    run.base.renderOpacity,
  );
  buffer.width = 0;
}

/** Draws one node into its own buffer. The mask is applied; blend mode and opacity are not */
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
    // The offset can go negative, which is fine: putImageData clips what falls outside
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
  // putImageData ignores compositing operations, so this goes through a scratch buffer and
  // applies it with drawImage
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
 * Groups clipping layers onto the nearest non-clipping layer below.
 * `children` runs back to front, so the preceding element is the layer underneath.
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
 * The area a node actually draws into, computed so that buffers need not be allocated at
 * document size. A group's is the union of its descendants'. A mask only narrows the area, so
 * it does not enter into this.
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
