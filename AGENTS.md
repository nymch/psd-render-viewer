<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## コーディング規約

コードを書く前に該当する規約を読む。

- TypeScript: [.claude/rules/typescript.md](.claude/rules/typescript.md)
- React／Hooks・Canvas描画: [.claude/rules/react.md](.claude/rules/react.md)
- ドキュメント・コメントの表記: [.claude/rules/documentation-style.md](.claude/rules/documentation-style.md)

## ドキュメント

[docs/README.md](docs/README.md)に置き場所をまとめている。仕様書は[docs/design/template.md](docs/design/template.md)、技術的な決定の記録は[docs/adr/template.md](docs/adr/template.md)を使う。用語と識別子の対応は[docs/glossary.md](docs/glossary.md)に従う。

実装を始める前に、対象の機能について`docs/design/`に仕様書があるか確認する。無ければ`/write-spec`で作る。

## スキル

一人で開発しているため、レビュアーや相談相手にあたる役をスキルで補っている。一覧と使う順番は[.claude/skills/README.md](.claude/skills/README.md)を参照。

- `/write-spec` — 仕様を詰めて`docs/design/`へ書き出す
- `/write-adr` — 技術的な決定を詰めて`docs/adr/`へ記録する
- `/devils-advocate` — 書き上がった文書に反論する
- `/grilling` — 汎用の壁打ち
- `/commit` — 変更を分析してコミットする
- `/create-pr` — 差分を自己レビューしてPRを作成する

## ブランチ運用

簡易版git-flow。`main`がリリース済み、`develop`が統合ブランチ（GitHubのデフォルト）。

- `feature/*`・`fix/*`・`refactor/*`・`docs/*`・`chore/*` — `develop`から切り、`develop`へ戻す
- `hotfix/*` — `main`から切り、`main`へ戻したあと`develop`にも取り込む
- リリース — `develop`から`main`へPRを出す

`release/*`ブランチは使わない。PRは`/create-pr`で作る。

## 技術スタック

Next.js 16（App Router）+ React 19 + TypeScript + Tailwind CSS v4。

PSDの表示は`ag-psd`でパースしCanvas 2Dに描画する（選定の経緯は[docs/adr/0001-psd-parser.md](docs/adr/0001-psd-parser.md)）。データ取得はSWR、グローバル状態はJotai、検証と型導出はzod、submitのあるフォームはReact Hook Form + `zodResolver`。`ag-psd`以外はまだ`package.json`に入っていないため、使う段階でインストールする。
