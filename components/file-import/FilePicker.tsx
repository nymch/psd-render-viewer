"use client";

import {useSetAtom} from "jotai";
import {loadAttemptAtom} from "@/atoms/document";

/**
 * The toolbar's file picker. Like the drop target, it only writes the File into an atom.
 *
 * Accepted during a load too. Parsing runs in a worker and replacing one is just a terminate on
 * the running worker, so there is no risk of two running at once.
 */
export function FilePicker() {
  const setAttempt = useSetAtom(loadAttemptAtom);

  return (
    <label className="inline-flex cursor-pointer items-center rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
      ファイルを選択
      <input
        type="file"
        accept=".psd,.psb"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) setAttempt({status: "parsing", file});
          // So that the same file can be picked again
          event.target.value = "";
        }}
      />
    </label>
  );
}
