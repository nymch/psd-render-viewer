"use client";

import {useState} from "react";
import {Tooltip} from "@/components/ui/Tooltip";
import {describeUnsupported} from "@/lib/psd/tree";
import type {LayerNode} from "@/lib/psd/tree";

type LayerRowProps = {
  node: LayerNode;
  depth: number;
};

export function LayerRow({node, depth}: LayerRowProps) {
  const isGroup = node.kind === "group";
  // ag-psdのopenedはPSDが持つ開閉状態。無ければ開いた状態から始める
  const [isOpen, setIsOpen] = useState(true);

  return (
    <li>
      <div
        className={`flex items-center gap-1.5 py-0.5 pr-2 text-xs ${
          node.visible ? "" : "opacity-40"
        }`}
        style={{paddingLeft: `${depth * 12 + 8}px`}}
      >
        {isGroup ? (
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
            className="w-4 shrink-0 text-zinc-500"
          >
            {isOpen ? "▼" : "▶"}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <span className="truncate" title={node.name}>
          {node.name}
        </span>

        <span className="ml-auto shrink-0 tabular-nums text-zinc-500">
          {Math.round(node.opacity * 100)}%
        </span>

        {node.blendMode !== "normal" && (
          <span className="shrink-0 text-zinc-500">{node.blendMode}</span>
        )}

        {node.unsupported.length > 0 && (
          <Tooltip
            label={node.unsupported.map(describeUnsupported).join("\n")}
          >
            <span
              className="shrink-0 cursor-help text-amber-600 dark:text-amber-400"
              aria-label="未対応の要素がある"
            >
              ⚠
            </span>
          </Tooltip>
        )}
      </div>

      {isGroup && isOpen && node.children.length > 0 && (
        // childrenは背面からの順。パネルはPhotoshopに合わせて上が最前面になるよう逆順にする
        <ul>
          {[...node.children].reverse().map((child) => (
            <LayerRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
