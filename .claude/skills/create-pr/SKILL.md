---
name: create-pr
description: ブランチの差分とコミット履歴を分析し、PRテンプレートに沿った本文を生成してPRを作成する。「PRを作って」「プルリクを出して」といった依頼で使う
user-invocable: true
allowed-tools: Bash(git *), Bash(gh pr *), Bash(gh auth status), Bash(gh repo view *), Bash(npm run *), AskUserQuestion, Read, Grep
---

# create-pr

ブランチの差分を分析し、[.github/pull_request_template.md](../../../.github/pull_request_template.md)に沿った本文でPRを作成する。

一人開発ではPRの本文が唯一のレビュー記録になる。**差分を読めばわかることではなく、差分からは読み取れない判断を書く。**

## ブランチ運用（簡易版git-flow）

| ブランチ | ベース | 用途 |
| --- | --- | --- |
| `main` | — | リリース済みの状態 |
| `develop` | — | 統合ブランチ。GitHubのデフォルト |
| `feature/*` | `develop` | 機能追加 |
| `fix/*` | `develop` | バグ修正 |
| `refactor/*`・`docs/*`・`chore/*` | `develop` | その他の変更 |
| `hotfix/*` | `main` | リリース済みの緊急修正。**マージ後は`develop`にも取り込む** |
| `release`（`develop` → `main`） | `main` | リリース |

`release/*`ブランチは使わない。

## 手順

### 1. 前提確認

並列で実行する:

```bash
gh auth status
git branch --show-current
git status --short
git remote -v
```

- **未認証** — その旨を伝えて終了する
- **`main`か`develop`の上にいる** — 作業ブランチに切り替えるよう伝えて終了する。ただし`develop`にいて「リリースPR」を作る意図が明確な場合は、`develop` → `main`のPRとして続行する
- **未コミットの変更がある** — `AskUserQuestion`で、コミット済み分だけでPRを作るか、先にコミットするかを確認する

### 2. ベースブランチの確定

**ブランチ名の接頭辞から決める。デフォルトブランチを無条件に使わない。**

- `hotfix/*` → `main`
- `develop`（リリースPR） → `main`
- それ以外 → `develop`

確定したら最新化する:

```bash
git fetch origin <base>
```

以降の比較はすべて`origin/<base>`を使う。ローカルが古いと、マージ済みの変更が差分に混ざる。

### 3. 情報の収集

並列で実行する:

```bash
git log origin/<base>..HEAD --oneline
git diff origin/<base>...HEAD --stat
git diff origin/<base>...HEAD
git ls-remote --heads origin <branch>
```

コミットが0件なら「ベースブランチとの差分がありません」と伝えて終了する。

### 4. 自己レビュー

**PRを出す前に、差分を自分で読む。**レビュアーがいないため、ここを飛ばすと誰も見ないままマージされる。

- `.claude/rules/`の規約に反している箇所がないか確認する
- デバッグ用のコード・コメントアウトした残骸・`console.log`が残っていないか確認する
- 差分に無関係な変更が混ざっていないか確認する。混ざっていればPRの分割を提案する

残骸をgrepで探すときは、**ドキュメントやスキル自身の説明文を拾う偽陽性**に注意する。`console.log`を検索すると、それを禁止している文章そのものがヒットする。ヒットした行が実際のコードかを確認してから報告する。

### 4.1. 動作確認

テンプレートの「動作確認」欄を埋めるために実行する:

```bash
npm run lint
npm run build
npm test
```

いずれかが失敗したらPRを作らず、その内容を伝えて終了する。壊れた状態のPRを出さない。

`npm test`は`package.json`に`test`スクリプトがある場合だけ実行する。無ければ飛ばし、PR本文の該当欄はチェックしない。

E2Eは重いため既定では走らせない。Canvasの描画やファイルを開く操作に触れる変更のときだけ`npm run test:e2e`も実行する。

差分がドキュメントや設定のみでアプリのコードを含まない場合も、両方を実行して壊れていないことを確認する。

**実行していない確認をチェック済みにしない。**「実際に動かして確認した」は、ブラウザやCLIで挙動を見たときだけチェックする。

見つかった問題は、PRを作る前にユーザーへ伝える。

### 5. 本文の生成

`.github/pull_request_template.md`の構成に沿って埋める。

- **概要** — 変更を1〜3行で要約する
- **種別** — ブランチ名の接頭辞から該当するものに`[x]`を入れる（`feature`→機能追加、`fix`・`hotfix`→バグ修正、`refactor`・`chore`・`perf`→改善、`docs`→ドキュメント）
- **背景・目的** — なぜこの変更が要るか。関連する`docs/design/`や`docs/adr/`があればリンクする
- **アプローチ** — **どういう方針で解決したか。検討した代替案と選ばなかった理由を書く。**「何を変えたか」は変更内容に書くので、ここには書かない
- **変更内容** — 差分から主要な変更点を箇条書きにする。ファイル名はバッククォートで囲む
- **動作確認** — 実際に確認した項目だけ`[x]`にする。**確認していない項目にチェックを入れない**
- **ドキュメント更新** — 変更パスから推定する（下表）。該当がなければ「上記いずれにも該当しない」にチェック
- **補足** — 未解決の論点・後回しにしたこと・レビューで特に見てほしい点。無ければ空のまま

| 変更パス | 該当する項目 |
| --- | --- |
| `lib/`のライブラリ呼び出し、依存の追加・変更 | `docs/glossary.md` |
| ライブラリ選定・構造の決定を伴う変更 | `docs/adr/` |
| 機能の仕様が変わる変更 | `docs/design/` |
| `.claude/rules/`配下 | `.claude/rules/` |

### 6. タイトルの生成

```text
type(scope): 日本語の説明
```

`type`と`scope`の決め方は[commit](../commit/SKILL.md)スキルと同じ。作業内容ではなく効果を書く。

### 7. 文体の適用

[.claude/rules/documentation-style.md](../../rules/documentation-style.md)に従う。特に:

- 英数字と日本語の間にスペースを入れない
- ファイル名・コマンド・型名はバッククォートで囲む
- LLM調の空虚な定型表現を使わない

### 8. 提示と確認

生成したタイトルと本文の全体を提示し、`AskUserQuestion`で作成・修正・キャンセルを選ばせる。修正を選ばれたら指示を反映して再提示する。

### 9. pushとPR作成

リモートにブランチが無ければ、pushの確認を取ってから実行する:

```bash
git push -u origin <branch>
```

本文は**スクラッチパッド配下の一時ファイルに書き出してから渡す**。バッククォートや`#`をヒアドキュメントで直接埋め込むとシェルのエスケープ事故が起きる。

```bash
gh pr create --base <base> --title "<タイトル>" --body-file <一時ファイル>
```

### 10. 結果報告

PRのURLを提示する。あわせて次を伝える:

- ベースブランチが何になったか（`hotfix`とリリースPRは`main`向き）
- `hotfix/*`の場合は、`main`へのマージ後に`develop`へも取り込む必要があること

**マージはこのスキルでは行わない。**
