"use client";

import {useCallback, useId, useLayoutEffect, useRef, useState} from "react";
import type {ReactNode} from "react";

type TooltipProps = {
  label: string;
  children: ReactNode;
};

type Anchor = {top: number; left: number; bottom: number};

const WIDTH = 256;
const GAP = 4;
const EDGE = 8;

/**
 * hoverとフォーカスで吹き出しを出す。PSDを知らない汎用部品。
 *
 * `position: fixed`で描く。`absolute`にすると、`overflow`を持つ親（レイヤーパネルの
 * スクロール領域）にクリップされて見切れる。位置はビューポートに収まるよう寄せ、
 * 下に入らなければ上へ回す。
 */
export function Tooltip({label, children}: TooltipProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [flipUp, setFlipUp] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  const open = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect === undefined) return;
    setFlipUp(false);
    setAnchor({top: rect.top, left: rect.left, bottom: rect.bottom});
  }, []);

  const close = useCallback(() => setAnchor(null), []);

  // 実際の高さは描いてみないと分からないので、描いた後に上下を決め直す
  useLayoutEffect(() => {
    if (anchor === null || flipUp) return;
    const height = tooltipRef.current?.offsetHeight;
    if (height === undefined) return;
    if (anchor.bottom + GAP + height > window.innerHeight - EDGE) setFlipUp(true);
  }, [anchor, flipUp]);

  const left =
    anchor === null
      ? 0
      : Math.max(EDGE, Math.min(anchor.left, window.innerWidth - WIDTH - EDGE));

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-describedby={anchor === null ? undefined : id}
        className="inline-flex"
        onPointerEnter={open}
        onPointerLeave={close}
        onFocus={open}
        onBlur={close}
      >
        {children}
      </span>
      {anchor !== null && (
        <span
          ref={tooltipRef}
          id={id}
          role="tooltip"
          style={{
            left,
            ...(flipUp
              ? {bottom: window.innerHeight - anchor.top + GAP}
              : {top: anchor.bottom + GAP}),
          }}
          className="fixed z-50 w-64 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs leading-relaxed whitespace-pre-line text-zinc-100 shadow-lg"
        >
          {label}
        </span>
      )}
    </>
  );
}
