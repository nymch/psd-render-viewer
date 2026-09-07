"use client";

import {useAtomValue, useSetAtom} from "jotai";
import {isLoadingAtom, loadAttemptAtom} from "@/atoms/document";

/** ツールバーのファイル選択。ドロップと同じくFileをatomへ書くだけ */
export function FilePicker() {
  const setAttempt = useSetAtom(loadAttemptAtom);
  const isLoading = useAtomValue(isLoadingAtom);

  return (
    <label
      className={`inline-flex items-center rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 ${
        isLoading
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      ファイルを選択
      <input
        type="file"
        accept=".psd,.psb"
        disabled={isLoading}
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
