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
 * PSDのパースと合成を担うWorker。
 *
 * `readPsd`は同期関数なので、メインスレッドで呼ぶとパースの間ずっとUIが止まる。
 * ここへ逃がすことで、100MB級のPSDを読んでいる最中もレイヤーパネルや倍率の操作が効く。
 *
 * 1回の読み込みごとに生成され、結果を返したらメインスレッド側でterminateされる。
 * 展開済みピクセルはWorkerごと消えるため、解放漏れが構造的に起きない。
 */

/**
 * **これを忘れると`readPsd`が`"Canvas not initialized"`で落ちる。**
 *
 * `ag-psd`は`typeof document !== "undefined"`のときだけcanvasの実装を自動で用意する。
 * Workerには`document`が無いのでその分岐に入らない。`useImageData: true`を指定していても
 * 内部でcanvasを要求するため、`OffscreenCanvas`を渡しておく。
 */
initializeCanvas((width: number, height: number) => {
  // ag-psdはHTMLCanvasElementを期待するが、実際に使うのはgetContext("2d")だけ。
  // OffscreenCanvasで要求を満たせる
  return new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement;
});

/**
 * Workerのグローバルスコープ。
 *
 * `tsconfig.json`の`lib`は`dom`を含むため`self`は`Window`として型が付く。`webworker`を
 * 足すと`dom`と識別子が衝突して両立できないので、このファイルで使う分だけを型にして
 * 受け直す。Workerの実行時には`DedicatedWorkerGlobalScope`が入っている。
 */
type WorkerScope = {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

const scope = self as unknown as WorkerScope;

function toMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // ag-psdはメモリ予算を使い切るとこのメッセージで投げる。そのままでは何が起きたか伝わらない
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

    // ImageBitmapではなくRGBAの生データを返す。理由はworkerMessage.tsを参照
    const context = composited.getContext("2d");
    if (context === null) throw new Error("2Dコンテキストを取得できなかった");
    const image = context.getImageData(0, 0, psd.width, psd.height);
    composited.width = 0;
    pixels.clear();

    respond({
      status: "ok",
      nodes,
      pixels: image.data.buffer as ArrayBuffer,
      width: psd.width,
      height: psd.height,
    });
  } catch (error) {
    respond({status: "error", message: toMessage(error)});
  }
};
