"use client";

import {useAtomValue} from "jotai";
import {useRef} from "react";
import {documentAtom, loadAttemptAtom} from "@/atoms/document";
import {zoomModeAtom} from "@/atoms/viewport";
import {usePsdDocument} from "@/hooks/psdHooks";

/**
 * パースから描画までを担う。Canvasは常にドキュメントサイズの等倍で描き、
 * 表示倍率はCSSの表示サイズだけを変えるので再描画は起きない。
 */
export function CanvasViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loaded = useAtomValue(documentAtom);
  const attempt = useAtomValue(loadAttemptAtom);
  const zoomMode = useAtomValue(zoomModeAtom);

  usePsdDocument(canvasRef);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-start justify-center">
      <canvas
        ref={canvasRef}
        className={
          zoomMode === "fit"
            ? // 縮小はするが拡大はしない。h-autoが無いと縦横比が崩れる
              "h-auto max-h-full w-auto max-w-full object-contain"
            : // 等倍。収まらない分はDropZoneのoverflow-autoでスクロールする
              "max-w-none shrink-0"
        }
        hidden={loaded === null}
      />
      {loaded === null && attempt.status !== "parsing" && (
        <p className="self-center text-sm text-zinc-500">
          PSDファイルを選ぶか、ここへドロップする
        </p>
      )}
    </div>
  );
}
