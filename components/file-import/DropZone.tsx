"use client";

import {useSetAtom} from "jotai";
import {useState} from "react";
import type {DragEvent, ReactNode} from "react";
import {loadAttemptAtom} from "@/atoms/document";

type DropZoneProps = {
  children: ReactNode;
};

/**
 * Wraps the canvas area and takes drag and drop. It only writes the File it receives into an
 * atom; parsing is CanvasViewport's job.
 *
 * Accepted during a load too. Replacing one is just a terminate on the running worker, so two
 * parses never run at once.
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
      // Without min-w-0 and min-h-0 a flex child keeps its auto min size, growing to fit its
      // contents so that fit never takes effect
      className={`flex min-h-0 min-w-0 flex-1 overflow-auto p-4 ${
        isOver ? "bg-blue-50 dark:bg-blue-950" : ""
      }`}
    >
      {children}
    </div>
  );
}
