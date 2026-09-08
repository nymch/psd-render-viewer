"use client";

import {useAtomValue} from "jotai";
import {loadAttemptAtom} from "@/atoms/document";

/**
 * 読み込み中の表示。
 *
 * Canvasと兄弟に置くと横並びになり、前の描画の真横に文言が出てレイアウトが動く。
 * スクロールしない領域に重ねることで、位置が動かず前の描画も透けて見える。
 * パースは同期実行で画面全体が固まるので、パネルまで覆って構わない。
 */
export function LoadingOverlay() {
  const attempt = useAtomValue(loadAttemptAtom);
  if (attempt.status !== "parsing") return null;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-black/70">
      <p className="rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {attempt.file.name}を読み込んでいる…
      </p>
    </div>
  );
}
