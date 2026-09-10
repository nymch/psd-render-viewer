"use client";

import {useAtomValue} from "jotai";
import {documentAtom} from "@/atoms/document";

/** The name of the document on display, in the toolbar. Keeps it apart from where an error came from */
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
