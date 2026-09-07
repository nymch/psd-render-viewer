"use client";

import {useAtomValue, useSetAtom} from "jotai";
import {useState} from "react";
import type {DragEvent, ReactNode} from "react";
import {isLoadingAtom, loadAttemptAtom} from "@/atoms/document";

type DropZoneProps = {
  children: ReactNode;
};

/**
 * Canvas領域を包んでドラッグ&ドロップを受ける。受け取ったFileをatomへ書くだけで、
 * パースはCanvasViewportが担う。
 *
 * 読み込み中は受け付けを止める。同期パースの前に1フレーム譲るのと`file.arrayBuffer()`の
 * 2箇所にawaitがあり、その間に2つ目のファイルを落とすとパースが二重に走る。
 */
export function DropZone({children}: DropZoneProps) {
  const setAttempt = useSetAtom(loadAttemptAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  const [isOver, setIsOver] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsOver(false);
    if (isLoading) return;

    const file = event.dataTransfer.files[0];
    if (file !== undefined) setAttempt({status: "parsing", file});
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!isLoading) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      // min-w-0が無いとflexの子がmin-width:autoのままで、内容に合わせて広がりfitが効かない
      className={`flex min-w-0 flex-1 overflow-auto p-4 ${
        isOver ? "bg-blue-50 dark:bg-blue-950" : ""
      }`}
    >
      {children}
    </div>
  );
}
