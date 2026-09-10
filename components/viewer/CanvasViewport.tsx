"use client";

import {useAtomValue} from "jotai";
import {useRef} from "react";
import {documentAtom, loadAttemptAtom} from "@/atoms/document";
import {zoomModeAtom} from "@/atoms/viewport";
import {usePsdDocument} from "@/hooks/psdHooks";

/**
 * Covers everything from parsing to drawing. The canvas is always drawn 1:1 at document size,
 * and scale changes only the CSS display size, so nothing is redrawn.
 *
 * Centering does not use `justify-center`. With no slack it overflows equally on both sides,
 * and the overflow on the leading side becomes unreachable by scrolling (it is not in
 * `scrollWidth` either). An auto margin collapses to 0 when there is no slack, aligning to the
 * start, so everything stays reachable.
 */
export function CanvasViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loaded = useAtomValue(documentAtom);
  const attempt = useAtomValue(loadAttemptAtom);
  const zoomMode = useAtomValue(zoomModeAtom);

  usePsdDocument(canvasRef);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-start">
      <canvas
        ref={canvasRef}
        className={
          zoomMode === "fit"
            ? // Shrinks but never enlarges. Without h-auto the aspect ratio breaks
              "mx-auto h-auto max-h-full w-auto max-w-full object-contain"
            : // 1:1. Whatever does not fit scrolls through DropZone's overflow-auto
              "mx-auto max-w-none shrink-0"
        }
        hidden={loaded === null}
      />
      {loaded === null && attempt.status !== "parsing" && (
        <p className="m-auto text-sm text-zinc-500">
          PSDファイルを選ぶか、ここへドロップする
        </p>
      )}
    </div>
  );
}
