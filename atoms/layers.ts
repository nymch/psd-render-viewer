import {atom} from "jotai";
import {countUnsupported} from "@/lib/psd/tree";
import type {LayerNode} from "@/lib/psd/tree";

/** 描画パラメータだけのレイヤーツリー。ピクセルは含まない */
export const layerTreeAtom = atom<LayerNode[]>([]);

/** ツリーから計算できるので派生atomにする。二重に持たない */
export const unsupportedCountAtom = atom((get) =>
  countUnsupported(get(layerTreeAtom)),
);
