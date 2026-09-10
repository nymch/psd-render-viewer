"use client";

import {useAtomValue} from "jotai";
import {useRef} from "react";
import {documentAtom, loadAttemptAtom} from "@/atoms/document";
import {zoomModeAtom} from "@/atoms/viewport";
import {usePsdDocument} from "@/hooks/psdHooks";

/**
 * パースから描画までを担う。Canvasは常にドキュメントサイズの等倍で描き、
 * 表示倍率はCSSの表示サイズだけを変えるので再描画は起きない。
 *
 * 中央寄せに`justify-center`を使わない。空きが無いときに両側へ均等にはみ出し、
 * 開始側のはみ出しへスクロールで到達できなくなる（`scrollWidth`にも含まれない）。
 * autoマージンなら空きが無いとき0に潰れて開始位置に揃うので、すべて見られる。
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
            ? // 縮小はするが拡大はしない。h-autoが無いと縦横比が崩れる
              "mx-auto h-auto max-h-full w-auto max-w-full object-contain"
            : // 等倍。収まらない分はDropZoneのoverflow-autoでスクロールする
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
