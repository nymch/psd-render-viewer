---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mts"
---

# TypeScriptコーディング規約

このリポジトリで`.ts`／`.tsx`を書くときの規約をまとめる。Reactコンポーネントとhooks、Canvas描画は[react.md](react.md)、文章・コメントの表記は[documentation-style.md](documentation-style.md)を参照。

## 型の厳格さ

- 型検査の基準はルートの`tsconfig.json`で、`strict`を有効にしている。設定を緩める方向の変更はしない。
- 配列やオブジェクトのインデックスアクセスは結果が`undefined`になりうる前提で書く。取り出した値は存在チェックか絞り込みをしてから使う。PSDのレイヤ配列のようにインデックスで引く場面が多いので特に注意する。
- `any`を使わない。値の型が不明なときは`unknown`で受けてから絞り込む。
- 型アサーション（`as`）は最小限にする。安全に絞り込めるならそちらを優先する。
- `@ts-ignore`は使わない。型エラーを意図的に無視する必要がある場合は`@ts-expect-error`を理由コメント付きで使う。`@ts-expect-error`は対象の型エラーが解消された時点で自身がエラーになるため、不要になった抑制に気づける。

## 型定義

- 基本は`type`を使う。宣言のマージが必要な場合など、`interface`が明確に適する場面だけ`interface`を使う。
- `enum`は使わない。`type BlendMode = "normal" | "multiply"`のようなunion of literals、または`as const`オブジェクトから`type Status = (typeof STATUS)[keyof typeof STATUS]`の形で値のunionを導出する。
- 状態をunionで表現し`switch`で分岐する場合は、`default`節で`value satisfies never`のような網羅性チェックを入れる。状態を追加したときの分岐の更新漏れをコンパイル時に検出できる。`const _exhaustive: never = value`の形は未使用変数のlint警告になるため使わない。
- zodスキーマがある値は`z.infer<typeof schema>`で型を導出し、型定義を二重に持たない。外部から来る値（APIレスポンス、ファイルから読んだメタデータ、`localStorage`の中身）はスキーマで検証してから使う。

## import

- 型だけを取り込むimportは`import type`を使い、値のimportと分ける。ESLintでは強制していないためレビューで確認する。
- リポジトリ内の参照はパスエイリアス`@/*`（`tsconfig.json`の`paths`で定義済み）を使う。`../../`と親を遡る相対パスを書かない。

## 命名

| 対象 | 記法 | 例 |
| --- | --- | --- |
| 変数・関数 | `camelCase` | `layerCount`・`parsePsd` |
| 型・Reactコンポーネント | `PascalCase` | `LayerNode`・`LayerPanel` |
| 定数オブジェクト・環境変数 | `SCREAMING_CASE` | `BLEND_MODE`・`NEXT_PUBLIC_API_URL` |

### 関数

- 関数は`camelCase`で、動詞から始める（`parsePsd`・`renderLayer`・`fetchDocument`等）。
- 真偽値を返す関数・変数は`is`／`has`／`can`などの接頭辞を付ける（`isVisible`・`hasAlpha`・`canRender`）。
- React hookは`use`から始める（`usePsdDocument`）。
- イベントハンドラは`handle`を接頭辞にし、それを受け取るpropsは`on`を接頭辞にする（`handleOpacityChange`を`onOpacityChange`に渡す）。

## Lint

- Prettierは導入していない。整形を目的にした大きな差分を作らず、周囲のコードのスタイルに合わせる。
- Lintは`npm run lint`（`eslint.config.mjs`の`eslint-config-next/core-web-vitals`と`eslint-config-next/typescript`）を通す。警告を`eslint-disable`で消すのではなく、原因を直す。

## コメント

- コメントの文章は[documentation-style.md](documentation-style.md)に従う。日本語・常体で書き、識別子やAPI名は原文（英語）のままでよい。
- 何をしているかではなく、なぜそうしているかを書く。コードを読めばわかることは書かない。
