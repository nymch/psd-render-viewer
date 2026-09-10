"use client";

import {useAtomValue} from "jotai";
import {loadAttemptAtom} from "@/atoms/document";

/**
 * The loading indicator.
 *
 * Placed as a sibling of the canvas it would sit alongside, putting the text right next to the
 * previous render and shifting the layout. Laid over the non-scrolling region instead, it stays
 * put and the previous render shows through.
 * Parsing runs synchronously and freezes the whole screen, so covering the panel too is fine.
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
