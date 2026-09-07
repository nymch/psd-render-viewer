"use client";

import {useId, useState} from "react";
import type {ReactNode} from "react";

type TooltipProps = {
  label: string;
  children: ReactNode;
};

/** hoverとフォーカスで吹き出しを出す。PSDを知らない汎用部品 */
export function Tooltip({label, children}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const id = useId();

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={() => setIsOpen(true)}
      onPointerLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      <span aria-describedby={isOpen ? id : undefined} tabIndex={0}>
        {children}
      </span>
      {isOpen && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-10 mt-1 w-64 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs leading-relaxed text-zinc-100 shadow-lg"
        >
          {label}
        </span>
      )}
    </span>
  );
}
