import type {DocumentRejection} from "@/lib/psd/limits";
import type {LayerNode} from "@/lib/psd/tree";

/**
 * The messages exchanged between the main thread and the worker.
 *
 * Both sides use the same types, which makes `switch` exhaustiveness checking work.
 * Only what structured clone can carry goes in here. An `Error` loses its class, so a failure
 * travels as `WorkerFailure` instead.
 */

/**
 * What reached the error channel, classified rather than worded.
 *
 * Only `document` and `memoryLimit` are conditions this code tests for, so only they can carry
 * a key. `raw` is `ag-psd` throwing or an invariant breaking: **a localized internal message is
 * harder to trace than the original**, and the difference between the two matters — a parse
 * failure means the file is the problem, an invariant break means this code is.
 *
 * `DocumentRejection` needs no new shape. It is already a key and its arguments, so formatting
 * simply moves to where the dictionary is.
 */
export type WorkerFailure =
  | {kind: "document"; rejection: DocumentRejection}
  | {kind: "memoryLimit"}
  | {kind: "raw"; message: string};

export type WorkerRequest = {
  /** The file's contents. Transferable, so ownership goes with it */
  buffer: ArrayBuffer;
};

export type WorkerResponse =
  | {
      status: "ok";
      /** The layer tree, drawing parameters only. No pixels */
      nodes: LayerNode[];
      /**
       * The composited RGBA. The `ArrayBuffer` behind an `ImageData`, passed as it is.
       *
       * **Never transfer an `ImageBitmap`.** In Chrome an `ImageBitmap` is backed by the
       * worker's lifetime: terminate the worker and the contents are lost, even after the
       * transfer. That does not go together with discarding the worker after every load.
       * An `ArrayBuffer` does not depend on a lifetime.
       */
      pixels: ArrayBuffer;
      width: number;
      height: number;
    }
  | {
      status: "error";
      failure: WorkerFailure;
    };
