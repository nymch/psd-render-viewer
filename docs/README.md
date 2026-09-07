# docs

このリポジトリのドキュメント置き場。表記ルールは[.claude/rules/documentation-style.md](../.claude/rules/documentation-style.md)に従う。

## 置き場所

| ディレクトリ | 何を書くか | いつ書くか |
| --- | --- | --- |
| `design/` | これから作る機能の仕様書。何を作るか、どう動くか | 実装を始める前 |
| `adr/` | 技術的な決定の記録。何を選び、なぜ選んだか | 後から「なぜこうなっているのか」を思い出したくなりそうな判断をしたとき |
| `glossary.md` | 用語集。日本語表記とコード上の識別子の対応 | 用語がブレそうになったとき |

書く文書の性格で分ける。**やり方**（手順）と**仕組み**（なぜそうなっているか）を1つの文書に混ぜない。手順書が必要になったら`runbooks/`、実装済みのシステムの構造をまとめたくなったら`architecture/`を作る。先に空のディレクトリを用意しない。

## 索引

- [用語集](glossary.md)
- [仕様書テンプレート](design/template.md)
- [ADRテンプレート](adr/template.md)・[ADRの書き方](adr/README.md)

### 仕様書

- [PSDビューア（最初のバージョン）](design/psd-viewer-v1.md)

### ADR

- [ADR-0001 PSDパーサにag-psdを使う](adr/0001-psd-parser.md)
- [ADR-0002 描画モードはCanvas 2Dへ写せる16個だけ対応し、残りはnormalへ倒す](adr/0002-blend-mode-mapping.md)

## 書かないもの

- 実装を読めばわかること。コードと二重管理になり、必ず片方が古くなる
- その場限りの作業ログ。残す価値のある判断だけADRに落とす
