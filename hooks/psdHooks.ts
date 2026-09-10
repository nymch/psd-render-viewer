"use client";

import {useAtomValue, useSetAtom} from "jotai";
import {useEffect, useRef} from "react";
import type {RefObject} from "react";
import {documentAtom, loadAttemptAtom} from "@/atoms/document";
import {layerTreeAtom} from "@/atoms/layers";
import type {WorkerRequest, WorkerResponse} from "@/lib/psd/workerMessage";

/**
 * ファイルを開いてからCanvasへ描くまでを担う。
 *
 * パースと合成はWorkerで行う。`readPsd`は同期関数なので、メインスレッドで呼ぶと
 * パースの間ずっとUIが止まる。判断の経緯はADR-0004を参照。
 *
 * Workerは読み込みごとに生成し、完了・失敗・差し替えでterminateする。展開済みピクセルが
 * Workerごと消えるため、解放漏れが構造的に起きない。
 */
export function usePsdDocument(
  canvasRef: RefObject<HTMLCanvasElement | null>,
): void {
  const attempt = useAtomValue(loadAttemptAtom);
  const setAttempt = useSetAtom(loadAttemptAtom);
  const setDocument = useSetAtom(documentAtom);
  const setLayerTree = useSetAtom(layerTreeAtom);

  // 表示中のドキュメント。描画のきっかけにする
  const loaded = useAtomValue(documentAtom);
  // 合成結果のRGBA。巨大なのでstateには入れない
  const imageRef = useRef<ImageData | null>(null);

  useEffect(() => {
    if (attempt.status !== "parsing") return;

    const file = attempt.file;
    const worker = new Worker(
      new URL("../lib/psd/worker.ts", import.meta.url),
      {type: "module"},
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const result = event.data;
      if (result.status === "error") {
        setAttempt({status: "error", fileName: file.name, message: result.message});
        worker.terminate();
        return;
      }

      // 前のファイルの資源を先に解放する
      imageRef.current = new ImageData(
        new Uint8ClampedArray(result.pixels),
        result.width,
        result.height,
      );

      setLayerTree(result.nodes);
      setDocument({
        fileName: file.name,
        width: result.width,
        height: result.height,
      });
      setAttempt({status: "idle"});
      worker.terminate();
    };

    worker.onerror = (event) => {
      setAttempt({
        status: "error",
        fileName: file.name,
        message: event.message || "Workerでエラーが起きた",
      });
      worker.terminate();
    };

    const send = async () => {
      const buffer = await file.arrayBuffer();
      const request: WorkerRequest = {buffer};
      // ArrayBufferはtransferableなので所有権ごと渡す
      worker.postMessage(request, [buffer]);
    };

    void send().catch((error: unknown) => {
      setAttempt({
        status: "error",
        fileName: file.name,
        message: error instanceof Error ? error.message : String(error),
      });
      worker.terminate();
    });

    // 読み込み中に別のファイルが来たら、走っているWorkerごと捨てる
    return () => worker.terminate();
  }, [attempt, setAttempt, setDocument, setLayerTree]);

  // 合成結果をCanvasへ移す。Canvasの寸法が変わると中身が消えるため、描画はここにまとめる。
  // 依存を付けないと再レンダーのたびにドキュメント大の書き込みが走るので、
  // 表示中のドキュメントが変わったときだけにする。
  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (canvas === null || image === null) return;
    if (canvas.width !== image.width) canvas.width = image.width;
    if (canvas.height !== image.height) canvas.height = image.height;

    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.putImageData(image, 0, 0);
  }, [loaded, canvasRef]);

  useEffect(() => {
    return () => {
      imageRef.current = null;
    };
  }, []);
}
