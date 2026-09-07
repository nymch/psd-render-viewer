import {atom} from "jotai";

/**
 * 表示倍率。fitはビューポートに収まるよう縮小（拡大はしない）、actualは等倍。
 * Canvasは常にドキュメントサイズの等倍で描き、CSSの表示サイズだけを変えるので再描画は起きない。
 */
export type ZoomMode = "fit" | "actual";

export const zoomModeAtom = atom<ZoomMode>("fit");
