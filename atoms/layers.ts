import {atom} from "jotai";
import {countUnsupported} from "@/lib/psd/tree";
import type {LayerNode} from "@/lib/psd/tree";

/** The layer tree, drawing parameters only. No pixels */
export const layerTreeAtom = atom<LayerNode[]>([]);

/** Computable from the tree, so it is a derived atom. Not held twice */
export const unsupportedCountAtom = atom((get) =>
  countUnsupported(get(layerTreeAtom)),
);
