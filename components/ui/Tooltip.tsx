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
 * Shows a bubble on hover and on focus. A generic part that knows nothing about PSDs.
 *
 * Drawn with `position: fixed`. Made `absolute`, it would be clipped by an ancestor carrying
 * `overflow` - the layer panel's scroll area - and get cut off. It is nudged to stay inside the
 * viewport, and flips above when it does not fit below.
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

  // The real height is unknown until it is drawn, so above-or-below is decided afterwards
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
