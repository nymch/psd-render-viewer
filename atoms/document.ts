import {atom} from "jotai";

/** The document on screen. Replaced only when a load succeeds */
export type LoadedDocument = {
  fileName: string;
  width: number;
  height: number;
};

/**
 * The outcome for the file most recently opened.
 *
 * Kept apart from the document on display. A failed load leaves the previous render alone, so
 * "the tree on screen is A's, the failure is B's" is a reachable state. Mixed into a single
 * union, there is no way to express which file the tree belongs to.
 */
export type LoadAttempt =
  | {status: "idle"}
  | {status: "parsing"; file: File}
  | {status: "error"; fileName: string; message: string};

export const documentAtom = atom<LoadedDocument | null>(null);

export const loadAttemptAtom = atom<LoadAttempt>({status: "idle"});
