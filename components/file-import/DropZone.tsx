"use client";

import {useSetAtom} from "jotai";
import {useState} from "react";
import type {DragEvent, ReactNode} from "react";
import {loadAttemptAtom} from "@/atoms/document";

type DropZoneProps = {
  children: ReactNode;
};

/**
 * Canvas領域を包んでドラッグ&ドロップを受ける。受け取ったFileをatomへ書くだけで、
 * パースはCanvasViewportが担う。
 *
 * 読み込み中も受け付ける。差し替えは走っているWorkerをterminateするだけで済むため、
 * パースが二重に走らない。
 */
export function DropZone({children}: DropZoneProps) {
  const setAttempt = useSetAtom(loadAttemptAtom);
  const [isOver, setIsOver] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsOver(false);

    const file = event.dataTransfer.files[0];
    if (file !== undefined) setAttempt({status: "parsing", file});
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      // min-w-0とmin-h-0が無いとflexの子がminサイズautoのままで、内容に合わせて広がりfitが効かない
      className={`flex min-h-0 min-w-0 flex-1 overflow-auto p-4 ${
        isOver ? "bg-blue-50 dark:bg-blue-950" : ""
      }`}
    >
      {children}
    </div>
  );
}
