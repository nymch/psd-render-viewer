"use client";

import {useAtomValue} from "jotai";
import {loadAttemptAtom} from "@/atoms/document";

/**
 * Shows the file that most recently failed to open, along the bottom.
 * The filename in the toolbar belongs to the document on display, and the two can disagree, so
 * both always carry a filename.
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
