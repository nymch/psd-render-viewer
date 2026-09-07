"use client";

import {useAtomValue} from "jotai";
import {documentAtom} from "@/atoms/document";

/** ツールバーに出す、いま表示中のドキュメントの名前。エラーの出所と取り違えないための表示 */
export function DocumentName() {
  const loaded = useAtomValue(documentAtom);
  if (loaded === null) return null;

  return (
    <span className="truncate text-sm text-zinc-600 dark:text-zinc-400">
      {loaded.fileName}
      <span className="ml-2 tabular-nums text-xs text-zinc-500">
        {loaded.width}×{loaded.height}
      </span>
    </span>
  );
}
