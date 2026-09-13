"use client";

import {useState} from "react";
import {Tooltip} from "@/components/ui/Tooltip";
import {useDictionary} from "@/hooks/i18nHooks";
import type {Dictionary} from "@/lib/i18n";
import type {LayerNode, UnsupportedReason} from "@/lib/psd/tree";

type LayerRowProps = {
  node: LayerNode;
  depth: number;
};

function describeUnsupported(
  text: Dictionary["unsupported"],
  reason: UnsupportedReason,
): string {
  switch (reason.kind) {
    case "adjustment-layer":
      return text.adjustmentLayer;
    case "layer-effects":
      return text.layerEffects;
    case "blend-mode":
      return text.blendMode(reason.blendMode);
    case "clipped-elements-ungrouped":
      return text.clippedElementsUngrouped;
    case "vector-mask":
      return text.vectorMask;
    default:
      return reason satisfies never;
  }
}

export function LayerRow({node, depth}: LayerRowProps) {
  const text = useDictionary();
  const isGroup = node.kind === "group";
  // ag-psd's opened is the expanded state the PSD carries. Absent, start expanded
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

        <span
          className="truncate"
          title={node.name ?? text.layerPanel.unnamedLayer}
        >
          {node.name ?? text.layerPanel.unnamedLayer}
        </span>

        <span className="ml-auto shrink-0 tabular-nums text-zinc-500">
          {Math.round(node.opacity * 100)}%
        </span>

        {node.blendMode !== "normal" && (
          <span className="shrink-0 text-zinc-500">{node.blendMode}</span>
        )}

        {node.unsupported.length > 0 && (
          <Tooltip
            label={node.unsupported
              .map((reason) => describeUnsupported(text.unsupported, reason))
              .join("\n")}
          >
            <span
              className="shrink-0 cursor-help text-amber-600 dark:text-amber-400"
              aria-label={text.layerPanel.unsupportedBadge}
            >
              ⚠
            </span>
          </Tooltip>
        )}
      </div>

      {isGroup && isOpen && node.children.length > 0 && (
        // children runs back to front. The panel reverses it so the front is on top, as in Photoshop
        <ul>
          {[...node.children].reverse().map((child) => (
            <LayerRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
