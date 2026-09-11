"use client";

// A scratch page for ADR-0007's first question: can a worker draw into a canvas it received
// through `transferControlToOffscreen`? Deleted once that is settled.

import {useCallback, useEffect, useRef, useState} from "react";
import type {ProbeRequest, ProbeResponse} from "./probe.worker";

const WIDTH = 480;
const HEIGHT = 270;

export default function OffscreenCheckPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  // Survives StrictMode's second effect pass, which reuses the same canvas element.
  const transferredRef = useRef(false);
  const passRef = useRef(0);
  const [log, setLog] = useState<string[]>([]);
  const pendingRef = useRef<string[]>([]);

  /**
   * Buffers a line and flushes on a microtask. The effect below reports synchronously - the
   * transfer either works or throws right there - and a direct `setState` from an effect body
   * is a cascading render the lint rule rightly refuses.
   */
  const say = useCallback((line: string) => {
    pendingRef.current.push(line);
    queueMicrotask(() => {
      const lines = pendingRef.current;
      if (lines.length === 0) return;
      pendingRef.current = [];
      setLog((current) => [...current, ...lines]);
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    if (transferredRef.current) {
      // Expected once in development: StrictMode runs the effect twice on the same element, and
      // a canvas can only be transferred once. Worth seeing rather than guarding silently.
      say("effect ran again on an already-transferred canvas - skipped");
      return;
    }

    let offscreen: OffscreenCanvas;
    try {
      offscreen = canvas.transferControlToOffscreen();
      transferredRef.current = true;
    } catch (error) {
      say(
        `transferControlToOffscreen threw: ${
          error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        }`,
      );
      return;
    }

    const worker = new Worker(new URL("./probe.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<ProbeResponse>) => {
      const message = event.data;
      if (message.type === "ready") {
        say(`worker sized the canvas to ${message.width}x${message.height}`);
        return;
      }
      if (message.type === "drew") {
        say(
          `pass ${message.pass} drew in ${message.ms.toFixed(1)}ms, sampled pixel [${message.sample.join(", ")}]`,
        );
        return;
      }
      say(`worker reported: ${message.message}`);
    };

    worker.onerror = (event) => {
      say(`worker error: ${event.message}`);
    };

    const init: ProbeRequest = {type: "init", canvas: offscreen, width: WIDTH, height: HEIGHT};
    worker.postMessage(init, [offscreen]);
    say("transferred the canvas and started the worker");

    // No terminate in cleanup on purpose. Tearing the worker down here would make StrictMode's
    // second pass indistinguishable from a real failure, and question 3 needs the teardown to
    // happen on demand instead.
  }, [say]);

  const draw = () => {
    const worker = workerRef.current;
    if (worker === null) {
      say("no worker - it was terminated, and the canvas cannot be transferred again");
      return;
    }
    passRef.current += 1;
    const request: ProbeRequest = {type: "draw", pass: passRef.current};
    worker.postMessage(request);
  };

  const terminate = () => {
    const worker = workerRef.current;
    if (worker === null) {
      say("already terminated");
      return;
    }
    worker.terminate();
    workerRef.current = null;
    say("terminated the worker - does the canvas keep what was drawn?");
  };

  const readFromMainThread = () => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    try {
      const ctx = canvas.getContext("2d");
      say(`getContext("2d") on the transferred element returned ${String(ctx)}`);
    } catch (error) {
      say(
        `getContext("2d") threw: ${
          error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        }`,
      );
    }
  };

  return (
    <main className="flex flex-col gap-4 p-8 font-mono text-sm">
      <h1 className="text-base font-semibold">transferControlToOffscreen check</h1>

      <p className="max-w-2xl text-zinc-600">
        ADR-0007 question 1. Draw repeatedly, then terminate and look at the canvas: if it goes
        blank, the contents were tied to the worker the way an ImageBitmap is, and a document
        switch has to remount the element.
      </p>

      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="border border-zinc-300 dark:border-zinc-700"
      />

      <div className="flex gap-2">
        <button type="button" onClick={draw} className="border px-3 py-1">
          draw
        </button>
        <button type="button" onClick={terminate} className="border px-3 py-1">
          terminate worker
        </button>
        <button type="button" onClick={readFromMainThread} className="border px-3 py-1">
          getContext from main thread
        </button>
      </div>

      <pre className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
        {log.map((line, index) => `${index + 1}. ${line}`).join("\n")}
      </pre>
    </main>
  );
}
