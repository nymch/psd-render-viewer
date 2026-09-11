// A scratch worker for ADR-0007's first question: can a worker draw into a canvas it received
// through `transferControlToOffscreen`? Deleted once that is settled.

export type ProbeRequest =
  | {type: "init"; canvas: OffscreenCanvas; width: number; height: number}
  | {type: "draw"; pass: number};

export type ProbeResponse =
  | {type: "ready"; width: number; height: number}
  | {type: "drew"; pass: number; sample: [number, number, number, number]; ms: number}
  | {type: "failed"; message: string};

/**
 * The worker's global scope, typed down to what this file uses.
 *
 * Same shape as `lib/psd/worker.ts`: `tsconfig.json`'s `lib` includes `dom`, so `self` types as
 * `Window`, and adding `webworker` collides on identifiers.
 */
type WorkerScope = {
  postMessage(message: ProbeResponse): void;
  onmessage: ((event: MessageEvent<ProbeRequest>) => void) | null;
};

const scope = self as unknown as WorkerScope;

let target: OffscreenCanvas | null = null;

/** Draws a pattern that differs per pass, so a repeated draw is visible rather than inferred. */
function paint(canvas: OffscreenCanvas, pass: number): [number, number, number, number] {
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error('getContext("2d") returned null on the transferred canvas');

  const hue = (pass * 47) % 360;
  ctx.fillStyle = `hsl(${hue} 70% 85%)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = `hsl(${hue} 70% 35%)`;
  const step = canvas.width / 8;
  for (let i = 0; i <= pass % 8; i++) {
    ctx.fillRect(i * step, canvas.height / 3, step * 0.7, canvas.height / 3);
  }

  ctx.fillStyle = "#000";
  ctx.font = "16px monospace";
  ctx.fillText(`pass ${pass}`, 8, 20);

  // Read a pixel back. Dimensions alone would not prove anything was rasterized - ADR-0004
  // found an ImageBitmap with the right size and no contents.
  const probe = ctx.getImageData(1, Math.floor(canvas.height / 2), 1, 1).data;
  return [probe[0] ?? 0, probe[1] ?? 0, probe[2] ?? 0, probe[3] ?? 0];
}

scope.onmessage = (event: MessageEvent<ProbeRequest>) => {
  try {
    const message = event.data;

    if (message.type === "init") {
      target = message.canvas;
      // Resizing from the worker is part of the question: after the transfer the main thread
      // cannot size the canvas, so document switching depends on this working.
      target.width = message.width;
      target.height = message.height;
      scope.postMessage({type: "ready", width: target.width, height: target.height});
      return;
    }

    if (target === null) throw new Error("draw arrived before init");

    const started = performance.now();
    const sample = paint(target, message.pass);
    scope.postMessage({
      type: "drew",
      pass: message.pass,
      sample,
      ms: performance.now() - started,
    });
  } catch (error) {
    scope.postMessage({
      type: "failed",
      message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
};
