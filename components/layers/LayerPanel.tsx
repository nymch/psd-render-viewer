"use client";

import {useAtomValue} from "jotai";
import {layerTreeAtom, unsupportedCountAtom} from "@/atoms/layers";
import {LayerRow} from "@/components/layers/LayerRow";

/** Read-only. Reads atoms/layers.ts and takes part in neither parsing nor drawing */
export function LayerPanel() {
  const nodes = useAtomValue(layerTreeAtom);
  const unsupportedCount = useAtomValue(unsupportedCountAtom);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800">
      <div className="flex items-baseline justify-between border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
        <h2 className="text-xs font-semibold">レイヤー</h2>
        {/* With many layers a mark sits below the fold, so the count goes here */}
        {unsupportedCount > 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            未対応{unsupportedCount}件
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {nodes.length === 0 ? (
          <p className="p-2 text-xs text-zinc-500">レイヤーがない</p>
        ) : (
          <ul>
            {[...nodes].reverse().map((node) => (
              <LayerRow key={node.id} node={node} depth={0} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
