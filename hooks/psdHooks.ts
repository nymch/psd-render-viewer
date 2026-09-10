"use client";

import {useAtomValue, useSetAtom} from "jotai";
import {useEffect, useRef} from "react";
import type {RefObject} from "react";
import {documentAtom, loadAttemptAtom} from "@/atoms/document";
import {layerTreeAtom} from "@/atoms/layers";
import type {WorkerRequest, WorkerResponse} from "@/lib/psd/workerMessage";

/**
 * Covers everything from opening a file to drawing it on the canvas.
 *
 * Parsing and compositing happen in a worker. `readPsd` is synchronous, so calling it on the
 * main thread stops the UI for the whole parse. The reasoning is in ADR-0004.
 *
 * A worker is created per load and terminated on completion, failure, or replacement. Decoded
 * pixels die with the worker, so a leak cannot happen structurally.
 */
export function usePsdDocument(
  canvasRef: RefObject<HTMLCanvasElement | null>,
): void {
  const attempt = useAtomValue(loadAttemptAtom);
  const setAttempt = useSetAtom(loadAttemptAtom);
  const setDocument = useSetAtom(documentAtom);
  const setLayerTree = useSetAtom(layerTreeAtom);

  // The document on display. What triggers a draw
  const loaded = useAtomValue(documentAtom);
  // The composited RGBA. Too large to put in state
  const imageRef = useRef<ImageData | null>(null);

  useEffect(() => {
    if (attempt.status !== "parsing") return;

    const file = attempt.file;
    const worker = new Worker(
      new URL("../lib/psd/worker.ts", import.meta.url),
      {type: "module"},
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const result = event.data;
      if (result.status === "error") {
        setAttempt({status: "error", fileName: file.name, message: result.message});
        worker.terminate();
        return;
      }

      // Release the previous file's resources first
      imageRef.current = new ImageData(
        new Uint8ClampedArray(result.pixels),
        result.width,
        result.height,
      );

      setLayerTree(result.nodes);
      setDocument({
        fileName: file.name,
        width: result.width,
        height: result.height,
      });
      setAttempt({status: "idle"});
      worker.terminate();
    };

    worker.onerror = (event) => {
      setAttempt({
        status: "error",
        fileName: file.name,
        message: event.message || "Workerでエラーが起きた",
      });
      worker.terminate();
    };

    const send = async () => {
      const buffer = await file.arrayBuffer();
      const request: WorkerRequest = {buffer};
      // An ArrayBuffer is transferable, so ownership goes with it
      worker.postMessage(request, [buffer]);
    };

    void send().catch((error: unknown) => {
      setAttempt({
        status: "error",
        fileName: file.name,
        message: error instanceof Error ? error.message : String(error),
      });
      worker.terminate();
    });

    // Another file arriving mid-load throws away the running worker with it
    return () => worker.terminate();
  }, [attempt, setAttempt, setDocument, setLayerTree]);

  // Move the composited result onto the canvas. Changing a canvas's dimensions wipes its
  // contents, so drawing is concentrated here. Without the dependency, every re-render would
  // run a document-sized write, so this fires only when the document on display changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (canvas === null || image === null) return;
    if (canvas.width !== image.width) canvas.width = image.width;
    if (canvas.height !== image.height) canvas.height = image.height;

    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.putImageData(image, 0, 0);
  }, [loaded, canvasRef]);

  useEffect(() => {
    return () => {
      imageRef.current = null;
    };
  }, []);
}
