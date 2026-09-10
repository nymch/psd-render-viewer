# ag-psd notes

What `ag-psd` actually does, established by running it and by reading its type definitions. **Pinned to the installed version** — a version bump invalidates these notes until they are re-checked.

## `ag-psd`の実API

導入済みの**ag-psd 31.0.2**（MIT）について確認した内容。選定の経緯は[ADR-0001](adr/0001-psd-parser.md)を参照。

出どころを2つに分ける。**実データで動かして確認した**もの（並び順・グループの不透明度・Node環境の初期化）と、**型定義`node_modules/ag-psd/dist/psd.d.ts`と同梱実装から読み取った**もの（識別子・値の一覧・オプション）。後者は識別子として正しいが、実際のPSDでどう入るかまでは確かめていない。

`Layer`のプロパティはすべて省略可能（`?`付き）。取り出した値は`undefined`前提で扱う。

| 用途 | 識別子 | 注意 |
| --- | --- | --- |
| 表示状態 | `hidden?: boolean` | **意味が反転している。**アプリ側で`visible`を持つなら`visible: !layer.hidden`と変換する。グループにも付く |
| 不透明度 | `opacity?: number` | **0〜1**。正規化済みなので変換不要 |
| 塗りの不透明度 | `fillOpacity?: number` | 0〜1。`opacity`とは別物 |
| 描画モード | `blendMode?: BlendMode` | 文字列のunion型。値の一覧は後述 |
| クリッピング | `clipping?: boolean` | |
| 名前 | `name?: string` | `undefined`がありうる |
| レイヤーid | `id?: number` | `undefined`がありうるため、そのままReactのkeyには使えない |
| 子要素 | `children?: Layer[]` | **グループも「childrenを持つレイヤー」として表現される。**専用のGroup型は無い |
| グループの開閉 | `opened?: boolean` | グループにのみ付く。レイヤーパネルの初期状態に使える |
| レイヤーの境界 | `left`・`top`・`right`・`bottom` | ドキュメント座標。**`imageData`はこの矩形のサイズで、ドキュメントサイズではない。**描画時にオフセットが要る |
| ピクセル | `imageData?: PixelData` | `useImageData: true`のときに入る。実体は後述 |
| レイヤーマスク | `mask?: LayerMaskData` | 後述。`realMask`もある |
| ベクトルマスク | `vectorMask?: LayerVectorMask` | パス情報のみ。ラスタライズ済みのピクセルは入らない |
| レイヤー効果 | `effects?: LayerEffectsInfo` | 設定値のみ。**効果を適用した結果は`imageData`に含まれない。**自前で描くしかない |
| 調整レイヤー | `adjustment?: AdjustmentLayer` | 設定値のみ。ピクセルを持たない |
| スマートオブジェクト | `placedLayer?: PlacedLayer` | |
| テキスト | `text?: LayerTextData` | 文字情報。ラスタライズ済みのピクセルは`imageData`の側に入る |
| アートボード | `artboard?` | レイヤーに付く。`psd.artboards`は件数などの全体情報で別物 |
| ドキュメントサイズ | `psd.width`・`psd.height` | |

### 読み込みオプション

```typescript
import {readPsd} from "ag-psd";

const psd = readPsd(arrayBuffer, {
  useImageData: true,          // canvasではなくPixelDataで受け取る
  skipCompositeImageData: true, // 合成済み画像を読まない（自前で合成するため不要）
  skipThumbnail: true,          // サムネイルを読まない
});
```

他に使い道のあるオプション。

| オプション | 既定 | 内容 |
| --- | --- | --- |
| `totalMemoryLimit` | 2GB | デコードに使うメモリの**累積**上限。レイヤーとマスクを1枚デコードするたびにそのバイト数が引かれ、残りが足りなくなると`Error("Exceeded memory limit")`を投げる。1枚あたりの上限ではないので、レイヤー数が多いPSDもここで止まる。**このアプリは`lib/psd/parse.ts`で4GBを明示している**（100MB級のPSDが既定の2GBに当たったため）。`undefined`を明示的に渡すと上限そのものが外れる |
| `throwForMissingFeatures` | `false` | ag-psd側が対応していない要素に当たったとき例外を投げる |
| `logMissingFeatures` | `false` | 同じ状況をコンソールに出す |
| `skipLayerImageData` | `false` | レイヤーのピクセルを読まない。ツリーだけ欲しいときに使う |
| `skipLinkedFilesData` | `false` | スマートオブジェクトのリンク先を読まない |

### `imageData`の実体

`imageData`の型は`PixelData`（`{data: PixelArray; width: number; height: number}`）で、**DOMの`ImageData`とは別の型**。中身は読み込むPSDのビット深度で変わる。

- **8bit・4チャンネル**（普通のRGBのPSD）では、中身は本物の`ImageData`インスタンス。ag-psdが内部で`canvas.getContext("2d").createImageData()`を呼んで作っているため、そのまま`putImageData`へ渡せる
- **16bit・32bit**では`{data: Uint16Array | Float32Array, width, height}`のただのオブジェクトになり、`putImageData`は受け付けない

型の上では常に`PixelData`なので、`putImageData`へ渡すには絞り込みが要る。`data instanceof Uint8ClampedArray`で8bitかを判定する。ビット深度は`psd.bitsPerChannel`で読める。

### 描画モードの値

`BlendMode`は次の31個のunion型。

`"pass through"`・`"normal"`・`"dissolve"`・`"darken"`・`"multiply"`・`"color burn"`・`"linear burn"`・`"darker color"`・`"lighten"`・`"screen"`・`"color dodge"`・`"linear dodge"`・`"lighter color"`・`"overlay"`・`"soft light"`・`"hard light"`・`"vivid light"`・`"linear light"`・`"pin light"`・`"hard mix"`・`"difference"`・`"exclusion"`・`"subtract"`・`"divide"`・`"hue"`・`"saturation"`・`"color"`・`"luminosity"`・`"linear height"`・`"height"`・`"subtraction"`

**ただし`layer.blendMode`に入りうるのはこのうち28個だけ。**PSDの4文字キーを変換する`toBlendMode`（`dist/helpers.js`）に載っているのが28個で、残る`linear height`・`height`・`subtraction`はディスクリプタ経由（レイヤー効果・ベクトルストローク）でしか出ない。型の31個をそのまま「レイヤーが取りうる値」として数えない。

対してCanvas 2Dの`globalCompositeOperation`が持つブレンド系の演算は15個（`multiply`・`screen`・`overlay`・`darken`・`lighten`・`color-dodge`・`color-burn`・`hard-light`・`soft-light`・`difference`・`exclusion`・`hue`・`saturation`・`color`・`luminosity`）で、通常合成は`source-over`。

28個から`pass through`（グループの構造の話で合成演算ではない）を除いた27個のうち、**名前が対応するのは16個。**加えて`linear dodge`は名前こそ違うが加算合成の`lighter`で写せる（下地が不透明なら一致する）。**残る10個には対応する演算が無い。**どう扱うかは[ADR-0002](adr/0002-blend-mode-mapping.md)で決めている。

### レイヤーマスク

`mask?: LayerMaskData`のフィールド。

| 識別子 | 意味 |
| --- | --- |
| `imageData?: PixelData` | マスクのピクセル。**マスク自身の矩形サイズ**で、レイヤーの矩形とも一致しない。チャンネルの並びは後述 |
| `left`・`top`・`right`・`bottom` | マスクの矩形。ドキュメント座標 |
| `disabled?: boolean` | **真のときマスクを適用しない** |
| `defaultColor?: number` | マスク矩形の外側の値（0または255）。矩形外を透明として扱うか不透明として扱うかがこれで決まる |
| `positionRelativeToLayer?: boolean` | 矩形がレイヤー相対か |
| `fromVectorData?: boolean` | ベクトルマスクから作られたマスクか |
| `userMaskDensity`・`userMaskFeather` | 濃度とぼかし。反映するには自前の計算が要る |

`realMask`も同じ`LayerMaskData`型で、ラスターマスクとベクトルマスクの両方があるときに使われる枠。**実データでどう入るかは未確認。**

#### マスクのチャンネルの並び

**マスクの濃淡はRGBに入り、アルファは全面255になる。**ag-psdはマスクのチャンネルを読んだあと`setupGrayscale`でRの値をGとBへ複製し、続く`resetAlpha`でアルファを埋めている。

そのため**`globalCompositeOperation = "destination-in"`へそのまま渡してはいけない。**`destination-in`はソースのアルファを見る演算なので、濃淡が無視されてマスク矩形での矩形切り抜きになる。マスクを効かせるには、Rの値をアルファへ移した`ImageData`を自分で組み立てる。

`defaultColor`はマスク矩形の外側の値（0または255）。`destination-in`は描画範囲の外も含めた宛先全体に効くため、レイヤー全体の大きさで`defaultColor`を敷いてからマスク矩形を書き込む必要がある。

### レイヤーの並び順

実データで確認済み。**`children[0]`が最背面で、末尾が最前面。**

- **Canvasへの描画** — `children`の順のまま（背面から描く）
- **レイヤーパネルの表示** — 逆順にする（Photoshopと同じく上が最前面）

`@webtoon/psd`とは逆向きなので、その前提で書かれた記事やコードを流用しない。

### グループの不透明度

**ag-psdは親をさかのぼって掛け合わせた不透明度を提供しない。**グループに`opacity: 0.5`が付いていても、子のレイヤーは`opacity: 1`のまま返る。グループの不透明度を効かせる処理は自分で書く。

**ただし「ツリーをたどって子へ掛け合わせる」が常に正解ではない。**グループごとにバッファを作って合成する（分離モデル）なら、グループの不透明度はバッファを親へ重ねるときに1回掛ければよい。子へ掛け合わせてしまうと、**子同士が重なった部分だけ濃くなる。**子へ掛け合わせるのが正しいのは、自分のバッファを持たない`"pass through"`のグループだけ。両方でやると二重に掛かる。

グループの`blendMode`は`"pass through"`（Photoshopの「通過」）がありうる。Canvas 2Dの合成演算には対応するものが無いため、別扱いにする。

### `document`が無い環境での注意

**`document`が無い環境では`initializeCanvas`でcanvasの実装を渡さないと`readPsd`が例外を投げる**（`"Canvas not initialized"`）。`useImageData: true`を指定していても内部でcanvasを要求する。該当するのはNode（テスト・スクリプト）と**Web Worker**の両方。

ag-psdは`typeof document !== "undefined"`でブラウザを判定し、そのとき`document.createElement("canvas")`を使う実装を自動で入れる。**Workerには`document`が無いのでこの分岐に入らない。**メインスレッドで動いていたコードをWorkerへ移すと、ここで落ちる。

Workerでは`OffscreenCanvas`を渡せばよい。

```typescript
initializeCanvas((width, height) => new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement);
```

`initializeCanvas`は`ag-psd`本体からexportされている。
