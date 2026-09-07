---
paths:
  - "app/**/*.tsx"
  - "app/**/*.ts"
  - "components/**/*.tsx"
  - "components/**/*.ts"
  - "hooks/**/*.ts"
  - "atoms/**/*.ts"
  - "lib/**/*.ts"
---

# React／Hooks・Canvas描画規約

Reactコンポーネント、hooks、Canvas描画の書き方をまとめる。言語レベルのTypeScript規約は[typescript.md](typescript.md)、文章・コメントの表記は[documentation-style.md](documentation-style.md)を参照。

このリポジトリは`src/`を持たず、リポジトリ直下に配置する。

| ディレクトリ | 置くもの |
| --- | --- |
| `app/` | ルーティングのみ（`page.tsx`・`layout.tsx`・`route.ts`）。コンポーネントを置かない |
| `components/` | Reactコンポーネント。機能ごとにサブディレクトリを切る（下記） |
| `hooks/` | カスタムhook |
| `atoms/` | Jotaiのatom |
| `lib/` | fetcher、PSDパース、zodスキーマなど非Reactの処理 |

## コンポーネントの配置

コンポーネントは`components/`の下に、**機能ごとのサブディレクトリ**を作って格納する。

```
components/
├─ ui/                    ← PSDを知らない汎用部品
│  ├─ Button.tsx
│  └─ Slider.tsx
├─ layers/                ← 機能
│  ├─ LayerPanel.tsx
│  └─ LayerRow.tsx
├─ viewer/
│  └─ CanvasViewport.tsx
└─ file-import/
   └─ DropZone.tsx
```

### 機能ディレクトリ

- 粒度は**画面上でまとまった役割を持つ単位**にする（`viewer`・`layers`・`toolbar`・`file-import`）。コンポーネント1つのために1ディレクトリを作らない
- ディレクトリ名はkebab-case。複数の要素を扱う機能は複数形にする（`layers`）、単一の役割なら単数（`viewer`）
- ファイル名はPascalCaseで、コンポーネント名と一致させる

### `ui/`と機能ディレクトリの使い分け

判定基準は**使われている数ではなく、PSDのドメインを知っているか**。

- **`ui/`** — PSDを知らない汎用部品（ボタン・スライダー・ダイアログ）。どのプロジェクトへ持っていっても成立するもの
- **機能ディレクトリ** — PSD固有のもの

**PSD固有のコンポーネントが複数の機能から使われるようになっても、持ち主の機能に置いたまま他機能からimportする。**「2箇所以上で使うから移動する」という運用にすると、使われる数が変わるたびにファイルが動き、共有ディレクトリが無関係な部品の寄せ集めになる。

### `app/`にコンポーネントを置かない

`app/`は`page.tsx`・`layout.tsx`・`route.ts`だけにする。ページ専用に見えるコンポーネントも`components/`へ置く。`app/<route>/_components/`のような同居を許すと、「これはページ専用か」の判断が毎回発生し、共有したくなった時点で移動が要る。

### barrel fileを作らない

`index.ts`でのre-exportをしない。ファイルを直接importする。

```typescript
// Good
import {LayerPanel} from "@/components/layers/LayerPanel";

// Bad — barrel経由
import {LayerPanel} from "@/components/layers";
```

barrelはツリーシェイキングを妨げ、循環参照の原因になる。ファイルを追加するたびの更新も要る。

1ファイル1コンポーネントを原則とする。そのファイル内でしか使わない小さなサブコンポーネントは同居させてよい。

### hooksとatomsは機能で割らない

`hooks/`と`atoms/`は種類別のまま（`hooks/psdHooks.ts`・`atoms/layers.ts`）。機能で割るのは`components/`だけにする。

## コンポーネント

- 関数コンポーネントで書く。propsは`type`で定義する。
- デフォルトはServer Componentとして書く。データ取得はできる限りServer Component側で行う。
- ブラウザAPIや状態に依存するコンポーネントはファイル先頭に`"use client"`を置く。
- `"use client"`は状態・イベントハンドラ・ブラウザAPIを直接使う末端コンポーネントに付け、`page`や`layout`から境界を押し下げる。境界を上位に置くほど、サーバーで完結できるレンダリングまでクライアントJSに含まれ、バンドルサイズと初期表示時間が悪化する。
- `window`／`document`をモジュールのトップレベルで参照するライブラリは`next/dynamic`で読み込む（`ssr: false`）。
- 画像は`next/image`を使う（`eslint-config-next/core-web-vitals`が要求する）。Canvasに描画するPSDのピクセルデータは対象外。

## Hooks

### 配置と命名

- カスタムhookは`hooks/`にドメイン別のファイル（`psdHooks.ts`・`canvasHooks.ts`等）でまとめる。機能ディレクトリに同居させない。
- hook名は`use` + リソース（+ 動作）にする（`usePsdDocument`・`useLayerList`）。再利用するロジックはカスタムhookに切り出す。
- Rules of Hooksを守る。hookはコンポーネントかカスタムhookのトップレベルでのみ呼ぶ。条件分岐・ループ・早期returnの後では呼ばない。`eslint-plugin-react-hooks`の警告を放置しない（`eslint-disable`で抑制しない）。

### useEffect

- `useEffect`は外部システム（DOM・Canvas・タイマー・購読等）との同期にのみ使う。propsやstateから計算できる値を`useState` + `useEffect`で同期しない。レンダー中に計算するか`useMemo`を使う。
- 購読・イベントリスナー・タイマー・`requestAnimationFrame`・observerなど後始末が要るものはcleanup関数を返す。副作用が通知だけのeffectにはcleanupを書かない。
- 依存配列は正確に書く。派生値ではなく元の値を依存に入れる。

### useCallback／useMemo

- 子へpropsとして渡すハンドラや、再生成を避けたい関数は`useCallback`でメモ化する。
- レイヤ一覧の整形などの派生値は`useMemo`で計算する。

## Canvas／PSDレンダリング

このプロジェクトの中核。`ag-psd`でPSDをパースし、Canvas 2Dに描画する。選定の経緯は[ADR-0001](../../docs/adr/0001-psd-parser.md)、実APIは[docs/glossary.md](../../docs/glossary.md)を参照。

- `ag-psd`のパースはブラウザAPIに依存するため`"use client"`の内側に閉じ込める。パース処理自体は`lib/`に置き、コンポーネントから切り離す。`readPsd`には`useImageData: true`・`skipCompositeImageData: true`・`skipThumbnail: true`を渡す。
- 大きいPSDのパースとレイヤ合成はWeb Workerに逃がし、メインスレッドをブロックしない。Worker側で`OffscreenCanvas`に描いて`ImageBitmap`を転送する形にすると、メインスレッドの負荷を抑えられる。
- Canvas要素は`useRef<HTMLCanvasElement>`で参照し、描画は`useEffect`（外部システムとの同期）で行う。レンダー中に描画しない。
- 状態が変わるたびに即描画せず、`requestAnimationFrame`で1フレームにまとめる。不透明度スライダーのドラッグのように毎フレーム値が変わる操作では、これがないと描画がキューに積まれて操作が重くなる。cleanupで`cancelAnimationFrame`する。
- `ImageBitmap`・`ObjectURL`・`OffscreenCanvas`などの資源はcleanupで解放する（`bitmap.close()`・`URL.revokeObjectURL(url)`）。PSDは1枚でも数百MBのピクセルデータになるため、解放漏れがそのままメモリ枯渇につながる。
- `ImageBitmap`や巨大な`ImageData`をReact stateに入れない。refに置き、stateに置くのは描画パラメータ（表示・不透明度・変形・選択状態）だけにする。ピクセルデータをstateに入れると、値の比較と再レンダーのたびに大きなオブジェクトを引きずることになる。

## データ取得（SWR）

- クライアントでのデータ取得はSWRに一本化する。`useState`と`useEffect`でfetchを自前実装しない。
- fetcherは`lib/`に定義し、hookから使う。レスポンスはzodスキーマで検証し、型は`z.infer`で導出する。
- fetcherは非2xxレスポンスでthrowする。throwしないとSWRの`error`に乗らない。
- SWRのキャッシュキーは、パラメータを含む複合キーなら配列（`["psd", fileId]`）、パラメータのない固定リソースなら文字列（`"document-list"`）にする。文字列連結（`` `psd-${fileId}` ``）は区切り文字がidに含まれるとキーが衝突しうるため使わない。
- **キーの一意性に特に注意する**。同じキーを別々のデータ取得で使うとキャッシュが衝突し、片方のデータがもう片方に混ざる・意図しない再検証が起きるなどの不具合になる。リソースを区別する値（id・パラメータ）はすべてキーに含める。
- 書き込み（mutation）は`useSWRMutation`でラップし、`trigger`・`isMutating`・`error`を使う。ローディングやエラー状態を`useState`で自前管理しない。対応するGETと同一キーなら成功時に自動再検証され、キーが異なる場合は`onSuccess`等で対応する`mutate`を呼ぶ。

## グローバル状態（Jotai）

- グローバル状態はJotaiを使う。atomは`atoms/`にドメイン別のファイル（`layers.ts`・`viewport.ts`）で定義する。
- 読み取りだけなら`useAtomValue`、書き込みだけなら`useSetAtom`、両方使うなら`useAtom`。書き込みしかしないコンポーネントで`useAtom`を使うと、値の更新のたびに不要な再レンダーが起きる。
- レイヤの表示・不透明度・並び順のようにレイヤ単位で変わる状態は`atomFamily`でレイヤごとのatomに分ける。1枚のスライダーを動かしたときに、そのレイヤのコントロールだけが再レンダーされる。
- 他のatomから計算できる値は派生atomにする。同じ値を複数のatomに持たない。

## フォーム（React Hook Form）

- React Hook Formは**submitのあるフォーム**に使う（書き出し設定ダイアログ、レイヤのリネーム、ファイル読み込みフォーム等）。`zodResolver`と組み合わせ、スキーマは`lib/schemas/`から取る。
- ネストした子には`FormProvider`と`useFormContext`で配る。配列フィールドは`useFieldArray`を使う。
- **レイヤの表示切替・不透明度・並び替えのような即時反映の操作UIにReact Hook Formを使わない。** これらの状態はCanvasの描画に直結する。RHFに持たせるとフォーム状態と描画状態の二重持ちになり、`useWatch`で全変更を拾って同期する処理が要る。これは「stateから計算できる値を`useEffect`で同期しない」に反する。これらはJotaiのatomに置く。
