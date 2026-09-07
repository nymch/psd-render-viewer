"use client";

// ag-psdの読み込みを確認するための検証用ページ。
// 正式なビューアができたら削除する。

import {useState} from "react";
import {readPsd} from "ag-psd";

type CheckResult = {
  width: number;
  height: number;
  nodeCount: number;
  layerCount: number;
  firstLayerName: string;
  firstLayerBlendMode: string | undefined;
  firstLayerOpacity: number | undefined;
  elapsedMs: number;
};

export default function PsdCheckPage() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const started = performance.now();
      const buffer = await file.arrayBuffer();
      const psd = readPsd(buffer, {
        useImageData: true,
        skipCompositeImageData: true,
        skipThumbnail: true,
      });

      type PsdLayer = NonNullable<typeof psd.children>[number];
      const flat: PsdLayer[] = [];
      const walk = (layer: PsdLayer) => {
        flat.push(layer);
        layer.children?.forEach(walk);
      };
      psd.children?.forEach(walk);

      const layers = flat.filter((layer) => layer.imageData);
      const first = layers[0];
      if (!first) throw new Error("ピクセルを持つレイヤーが見つからない");

      setResult({
        width: psd.width,
        height: psd.height,
        nodeCount: flat.length,
        layerCount: layers.length,
        firstLayerName: first.name ?? "(no name)",
        firstLayerBlendMode: first.blendMode,
        firstLayerOpacity: first.opacity,
        elapsedMs: Math.round(performance.now() - started),
      });
    } catch (e) {
      setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
    }
  };

  return (
    <main className="flex flex-col gap-4 p-8 font-mono text-sm">
      <h1 className="text-base font-semibold">ag-psd check</h1>
      <input
        type="file"
        accept=".psd,.psb"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {error && <pre className="text-red-600">NG: {error}</pre>}
      {result && (
        <pre className="text-green-700">
          OK{"\n"}
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}
