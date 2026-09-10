import {atom} from "jotai";

/**
 * Display scale. fit shrinks to the viewport without ever enlarging; actual is 1:1.
 * The canvas is always drawn at document size and only the CSS display size changes, so
 * nothing is redrawn.
 */
export type ZoomMode = "fit" | "actual";

export const zoomModeAtom = atom<ZoomMode>("fit");
