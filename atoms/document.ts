import {atom} from "jotai";

/** 画面に出ているドキュメント。読み込みに成功したときだけ差し替わる */
export type LoadedDocument = {
  fileName: string;
  width: number;
  height: number;
};

/**
 * 最後に開こうとしたファイルの結果。
 *
 * 表示中のドキュメントとは別に持つ。読み込みに失敗しても前の描画は消さないため、
 * 「画面に出ているのはAのツリー、失敗したのはB」という状態になりうる。
 * 1つのunionに混ぜるとどちらのファイルのものか表現できない。
 */
export type LoadAttempt =
  | {status: "idle"}
  | {status: "parsing"; file: File}
  | {status: "error"; fileName: string; message: string};

export const documentAtom = atom<LoadedDocument | null>(null);

export const loadAttemptAtom = atom<LoadAttempt>({status: "idle"});
