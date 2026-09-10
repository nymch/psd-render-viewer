"use client";

import {useSetAtom} from "jotai";
import {loadAttemptAtom} from "@/atoms/document";

/**
 * ツールバーのファイル選択。ドロップと同じくFileをatomへ書くだけ。
 *
 * 読み込み中も受け付ける。パースはWorkerで走っており、差し替えは走っているWorkerを
 * terminateするだけで済むため、二重に走る心配がない。
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
          // 同じファイルをもう一度選べるようにする
          event.target.value = "";
        }}
      />
    </label>
  );
}
