"use client";

import {useAtomValue} from "jotai";
import {loadAttemptAtom} from "@/atoms/document";

/**
 * 最後に開こうとして失敗したファイルを下端に出す。
 * ツールバーのファイル名は表示中のドキュメントのもので、この2つは食い違いうるため、
 * どちらも常にファイル名を添える。
 */
export function LoadError() {
  const attempt = useAtomValue(loadAttemptAtom);
  if (attempt.status !== "error") return null;

  return (
    <p
      role="alert"
      className="border-t border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      ⚠ {attempt.fileName}を読み込めなかった: {attempt.message}
    </p>
  );
}
