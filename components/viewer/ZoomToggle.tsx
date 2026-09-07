"use client";

import {useAtom} from "jotai";
import {zoomModeAtom} from "@/atoms/viewport";
import type {ZoomMode} from "@/atoms/viewport";

const MODES: {value: ZoomMode; label: string}[] = [
  {value: "fit", label: "fit"},
  {value: "actual", label: "100%"},
];

export function ZoomToggle() {
  const [zoomMode, setZoomMode] = useAtom(zoomModeAtom);

  return (
    <div className="inline-flex overflow-hidden rounded border border-zinc-300 dark:border-zinc-700">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          aria-pressed={zoomMode === mode.value}
          onClick={() => setZoomMode(mode.value)}
          className={`px-3 py-1.5 text-sm ${
            zoomMode === mode.value
              ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
