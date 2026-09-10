import {initializeCanvas} from "ag-psd";
import {compositeDocument} from "@/lib/psd/composite";
import {
  checkBitsPerChannel,
  checkDocumentSize,
  describeRejection,
} from "@/lib/psd/limits";
import {parsePsd} from "@/lib/psd/parse";
import {buildLayerTree} from "@/lib/psd/tree";
import type {WorkerRequest, WorkerResponse} from "@/lib/psd/workerMessage";

/**
 * The worker that parses and composites a PSD.
 *
 * `readPsd` is synchronous, so calling it on the main thread stops the UI for the whole parse.
 * Moving it here keeps the layer panel and the zoom toggle working while a 100MB-class PSD
 * loads.
 *
 * One worker is created per load and terminated from the main thread once it has replied.
 * Decoded pixels die with the worker, so a leak cannot happen structurally.
 */

/**
 * **Forget this and `readPsd` throws `"Canvas not initialized"`.**
 *
 * `ag-psd` sets up a canvas implementation automatically only when
 * `typeof document !== "undefined"`. A worker has no `document`, so it never takes that branch.
 * It demands a canvas internally even with `useImageData: true`, hence handing it an
 * `OffscreenCanvas` up front.
 */
initializeCanvas((width: number, height: number) => {
  // ag-psd expects an HTMLCanvasElement but only ever uses getContext("2d"),
  // which an OffscreenCanvas satisfies
  return new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement;
});

/**
 * The worker's global scope.
 *
 * `tsconfig.json`'s `lib` includes `dom`, so `self` types as `Window`. Adding `webworker`
 * collides with `dom` on identifiers and the two cannot coexist, so only what this file uses is
 * typed out and re-cast. At run time inside a worker it is a `DedicatedWorkerGlobalScope`.
 */
type WorkerScope = {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

const scope = self as unknown as WorkerScope;

function toMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // ag-psd throws with this message once the memory budget runs out. Left as it is, it says
  // nothing about what happened
  if (error.message === "Exceeded memory limit") {
    return "PSDが大きすぎて読み込めない";
  }
  return error.message;
}

function respond(response: WorkerResponse): void {
  if (response.status === "ok") {
    scope.postMessage(response, [response.pixels]);
    return;
  }
  scope.postMessage(response);
}

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const psd = parsePsd(event.data.buffer);

    const depth = checkBitsPerChannel(psd.bitsPerChannel);
    if (!depth.ok) throw new Error(describeRejection(depth));

    const size = checkDocumentSize(psd.width, psd.height);
    if (!size.ok) throw new Error(describeRejection(size));

    const {nodes, pixels} = buildLayerTree(psd);
    const composited = compositeDocument({
      nodes,
      pixels,
      width: psd.width,
      height: psd.height,
    });

    // Return raw RGBA rather than an ImageBitmap. The reason is in workerMessage.ts
    const context = composited.getContext("2d");
    if (context === null) throw new Error("2Dコンテキストを取得できなかった");
    const image = context.getImageData(0, 0, psd.width, psd.height);
    composited.width = 0;
    pixels.clear();

    // Only a plain ArrayBuffer can be transferred. One backed by a SharedArrayBuffer cannot
    const buffer = image.data.buffer;
    if (!(buffer instanceof ArrayBuffer)) {
      throw new Error("合成結果を転送できる形で取り出せなかった");
    }

    respond({
      status: "ok",
      nodes,
      pixels: buffer,
      width: psd.width,
      height: psd.height,
    });
  } catch (error) {
    respond({status: "error", message: toMessage(error)});
  }
};
