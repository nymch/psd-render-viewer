# skills

一人で開発しているため、レビュアー・相談相手にあたる役をスキルで補う。

## 一覧

| スキル | 何をするか | 成果物 |
| --- | --- | --- |
| [write-spec](write-spec/SKILL.md) | 作りたい機能を1問ずつ詰めて仕様を確定させる | `docs/design/<name>.md` |
| [write-adr](write-adr/SKILL.md) | 技術的な決定を選択肢とトレードオフから詰める | `docs/adr/NNNN-*.md` |
| [devils-advocate](devils-advocate/SKILL.md) | 書き上がった文書の前提と設計判断に反論する | 報告のみ |
| [grilling](grilling/SKILL.md) | 汎用の壁打ち。文書は残さない | なし |
| [commit](commit/SKILL.md) | 変更を分析してコミットメッセージを組み立てる | コミット |
| [create-pr](create-pr/SKILL.md) | 差分を自己レビューしPR本文を組み立てる | PR |

## 使う順番

```
考えがまとまっていない
  └─ /grilling                      … 文書にする前に考えを整理する

作るものが決まってきた
  └─ /write-spec                    … 仕様を詰めて docs/design/ へ
       └─ /write-adr                … 途中で出た重い技術判断を docs/adr/ へ
            └─ /devils-advocate     … 書けた文書に反論させる
                 └─ 実装
                      └─ /commit          … 変更をコミットする
                           └─ /create-pr  … 自己レビューしてPRを出す
```

`/devils-advocate`は書いた直後より、**少し時間を置いてから**のほうが効く。書いた直後は前提が頭に残っていて、指摘を無意識に退けやすい。

## 設計の意図

一人開発で欠けるのは批判役だけではない。各スキルに以下を義務として書いている。

- **選択肢を出す役** — 自分が思いついた案しか俎上に載らない。`/write-spec`と`/write-adr`は、こちらが代替案を必ず用意して並べる
- **前提を疑う役** — 頭の中にある前提は誰にも疑われない。暗黙の前提を文にして確認する
- **範囲を止める役** — 個人開発が完成しない最大の原因は範囲の膨張。ゴールを決めたら必ず「やらないこと」を対で決める
- **決定を記録する役** — 詰めた結果が会話に消えると、後から自分が理由を思い出せない。`/write-spec`と`/write-adr`は必ずファイルに書き出す

## 出典

`grilling`はMatt Pocockの公開スキルが原典。description に日本語のトリガー語を追加し、末尾に発話言語へ合わせる指示を1文足した以外は原文のまま。

- [mattpocock/skills — grilling](https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling)

`write-spec`・`write-adr`・`devils-advocate`はこのリポジトリ用に新規作成。
