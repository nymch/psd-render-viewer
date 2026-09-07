"use client";

import {useAtomValue, useSetAtom} from "jotai";
import {useEffect, useRef} from "react";
import type {RefObject} from "react";
import {documentAtom, loadAttemptAtom} from "@/atoms/document";
import {layerTreeAtom} from "@/atoms/layers";
import {compositeDocument} from "@/lib/psd/composite";
import {
  checkBitsPerChannel,
  checkDocumentSize,
  describeRejection,
} from "@/lib/psd/limits";
import {parsePsd} from "@/lib/psd/parse";
import {buildLayerTree} from "@/lib/psd/tree";
import type {PixelStore} from "@/lib/psd/tree";

/**
 * `readPsd`は同期関数なので、状態を`parsing`にした直後に呼ぶとローディング表示が一度も塗られない。
 * 1回目のコールバックはそのフレームの描画前に走るため、実際に塗られたことを保証するには
 * 2回目まで待つ必要がある。
 */
function nextPaintedFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function toMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // ag-psdはメモリ予算を使い切るとこのメッセージで投げる。そのままでは何が起きたか伝わらない
  if (error.message === "Exceeded memory limit") {
    return "PSDが大きすぎて読み込めない";
  }
  return error.message;
}

/**
 * ファイルを開いてからCanvasへ描くまでを担う。
 *
 * パースする側と描く側を同じコンポーネントに寄せている。refはコンポーネント単位なので、
 * 別のコンポーネントでパースするとピクセルの受け渡し先が無くなる。
 */
export function usePsdDocument(
  canvasRef: RefObject<HTMLCanvasElement | null>,
): void {
  const attempt = useAtomValue(loadAttemptAtom);
  const setAttempt = useSetAtom(loadAttemptAtom);
  const setDocument = useSetAtom(documentAtom);
  const setLayerTree = useSetAtom(layerTreeAtom);

  const pixelsRef = useRef<PixelStore | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);

  useEffect(() => {
    if (attempt.status !== "parsing") return;

    const file = attempt.file;
    let cancelled = false;

    const load = async () => {
      await nextPaintedFrame();
      if (cancelled) return;

      let buffer: ArrayBuffer;
      try {
        buffer = await file.arrayBuffer();
      } catch (error) {
        if (!cancelled) {
          setAttempt({status: "error", fileName: file.name, message: toMessage(error)});
        }
        return;
      }
      if (cancelled) return;

      try {
        const psd = parsePsd(buffer);

        const depth = checkBitsPerChannel(psd.bitsPerChannel);
        if (!depth.ok) throw new Error(describeRejection(depth));

        const size = checkDocumentSize(psd.width, psd.height);
        if (!size.ok) throw new Error(describeRejection(size));

        const {nodes, pixels} = buildLayerTree(psd);
        const composited = compositeDocument({
          nodes,
          pixels,
          width: psd.width,
          height: psd.height,
        });

        if (cancelled) {
          composited.width = 0;
          return;
        }

        // 前のファイルの資源を先に解放する
        bitmapRef.current?.close();
        pixelsRef.current = pixels;
        bitmapRef.current = composited.transferToImageBitmap();

        setLayerTree(nodes);
        setDocument({fileName: file.name, width: psd.width, height: psd.height});
        setAttempt({status: "idle"});
      } catch (error) {
        if (!cancelled) {
          setAttempt({status: "error", fileName: file.name, message: toMessage(error)});
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt, setAttempt, setDocument, setLayerTree]);

  // 合成結果をCanvasへ移す。Canvasの寸法が変わると中身が消えるため、描画はここにまとめる
  useEffect(() => {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    if (canvas === null || bitmap === null) return;
    if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
    if (canvas.height !== bitmap.height) canvas.height = bitmap.height;

    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
  });

  useEffect(() => {
    return () => {
      bitmapRef.current?.close();
      bitmapRef.current = null;
      pixelsRef.current = null;
    };
  }, []);
}
