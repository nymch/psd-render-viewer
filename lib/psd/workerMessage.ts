import type {LayerNode} from "@/lib/psd/tree";

/**
 * メインスレッドとWorkerでやり取りするメッセージ。
 *
 * 両側で同じ型を使い、`switch`の網羅性チェックを効かせる。
 * 構造化クローンで運べるものだけを載せる。`Error`はクラスが落ちるので文字列に変換して送る。
 */

export type WorkerRequest = {
  /** ファイルの中身。transferableなので所有権ごと渡す */
  buffer: ArrayBuffer;
};

export type WorkerResponse =
  | {
      status: "ok";
      /** 描画パラメータだけのレイヤーツリー。ピクセルは含まない */
      nodes: LayerNode[];
      /**
       * 合成結果のRGBA。`ImageData`の裏にある`ArrayBuffer`をそのまま渡す。
       *
       * **`ImageBitmap`を転送してはいけない。**Chromeでは`ImageBitmap`の実体がWorkerの
       * 寿命に紐づいており、転送したあとでもWorkerをterminateすると中身が失われる。
       * 読み込みごとにWorkerを破棄する設計とは両立しない。`ArrayBuffer`は寿命に依存しない。
       */
      pixels: ArrayBuffer;
      width: number;
      height: number;
    }
  | {
      status: "error";
      message: string;
    };
