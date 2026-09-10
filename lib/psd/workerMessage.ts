import type {LayerNode} from "@/lib/psd/tree";

/**
 * The messages exchanged between the main thread and the worker.
 *
 * Both sides use the same types, which makes `switch` exhaustiveness checking work.
 * Only what structured clone can carry goes in here. An `Error` loses its class, so it is
 * converted to a string before being sent.
 */

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
      message: string;
    };
