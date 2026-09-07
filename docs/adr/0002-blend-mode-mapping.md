---
status: proposed
date: 2026-09-07
---

# 描画モードはCanvas 2Dへ写せる16個だけ対応し、残りはnormalへ倒す

## 背景と課題

[ADR-0001](0001-psd-parser.md)で`ag-psd`を選んだ理由は描画モードとグループの表示切替が扱えることだった。そのADRは「描画モードをCanvas 2Dの`globalCompositeOperation`にどこまで対応させるかは別途決める」として判断を残している。ここで決める。

範囲は`lib/psd/blendMode.ts`の対応表と、`lib/psd/composite.ts`がそれをどう使うかまで。仕様は[PSDビューア（最初のバージョン）](../design/psd-viewer-v1.md)。

`ag-psd`の`BlendMode`型は31個あるが、**PSDのレイヤーから実際に返るのは28個**（`node_modules/ag-psd/dist/helpers.js`の`toBlendMode`）。残る`linear height`・`height`・`subtraction`はディスクリプタ経由（レイヤー効果・ベクトルストローク）でしか出ないため、`layer.blendMode`には現れない。

28個から`pass through`（グループの構造の話で合成演算ではない）を除いた27個のうち、Canvas 2Dの`globalCompositeOperation`に対応する演算があるのは16個。**残り11個には対応する演算が無い。**

| | 内訳 |
| --- | --- |
| 写せる16個 | `normal`・`darken`・`multiply`・`color burn`・`lighten`・`screen`・`color dodge`・`overlay`・`soft light`・`hard light`・`difference`・`exclusion`・`hue`・`saturation`・`color`・`luminosity` |
| 写せない11個 | `dissolve`・`linear burn`・`darker color`・`linear dodge`・`lighter color`・`vivid light`・`linear light`・`pin light`・`hard mix`・`subtract`・`divide` |

## 判断基準

趣味の個人開発なので、次を最優先する。

1. **一人で保守できるか** — 実装量と、半年後に自分が読めるか
2. Photoshopとの見た目の一致
3. 描画速度

速度を最下位にしたのは、このバージョンが**ファイルを開いたときに1回描くだけ**で、毎フレーム再描画しないため。表示切替や不透明度スライダーを足すときに順位が変わりうる。

## 検討した選択肢

- 写せる16個だけ`globalCompositeOperation`へ写し、残り11個は`normal`へ倒して未対応の印を出す
- 16個に加えて、式が単純なもの（`linear burn`・`linear dodge`・`subtract`・`divide`等）を自前のピクセル演算で埋める
- Canvasの合成演算を使わず、27個すべてを自前のピクセル演算で実装する
- 今は決めない。v1はすべて`normal`扱いにし、対応表を次のバージョンへ回す

倒し先については別に3案を比べた。すべて`normal`／系統の近いモードへ倒す／レイヤーごと隠す。

## 決定

**写せる16個だけを`globalCompositeOperation`へ写し、残り11個は`normal`へ倒して未対応の印を出す。**

最優先の基準「一人で保守できるか」で他を明確に上回るため。対応表は`Record<BlendMode, GlobalCompositeOperation | null>`1つで済み、`composite.ts`の合成パイプラインは今のまま「レイヤーのバッファを親へ`drawImage`する」で変わらない。

自前のピクセル演算を入れる案（2番目・3番目）は、**合成パイプラインの構造を変える**点で退けた。Canvasの合成演算は下地を暗黙に扱うが、自前の演算は下地が要る。親バッファを`getImageData`で読み、JSで合成し、`putImageData`で書き戻す経路が必要になる。部分実装（2番目）ではCanvas任せと自前の2系統が同居し、「どこまでを単純な式とするか」の線引きも自分で持つことになる。

「今は決めない」（4番目）は、[仕様書](../design/psd-viewer-v1.md)の完成の定義の段2が丸ごと空になる。ADR-0001が描画モードを理由に`ag-psd`を選んでいるため、選定の前提を検証しないまま進むことになり、退けた。

倒し先を`normal`にしたのは、**未対応を未対応のまま見せるため。**系統の近いモードへ倒すと見た目はPhotoshopに近づくが、差分を見たときに「倒し先の選び方が悪いのか合成がバグっているのか」の判別が要る。このバージョンの目的は「正しく表示されているか」を判断できることなので、判別のしやすさを取った。倒し先の選定根拠を自分で背負わずに済む点も、最優先の基準に沿う。

### 結果

- 良い点: 対応表が16行のデータ1つで済む。合成パイプラインが1系統のままで、`getImageData`による読み戻しが要らない。写せる16個は`globalCompositeOperation`の実装に乗るので、式を自分で検証しなくてよい
- 良い点: 未対応が11個と確定するので、UIの印とTooltipに出す文言が具体的に書ける
- 悪い点: **11個を使ったPSDはPhotoshopと絵が違う。**特に`linear dodge`（加算）と`linear burn`は光彩や影の表現で実際によく使われる。`normal`へ倒すと加算系は暗く、焼き込み系は明るく見える
- 悪い点: 印は出るが差は残る。「未対応の印が付いているもの以外は一致する」という判定に、Photoshop側でも該当レイヤーを非表示にする手間が加わる
- 悪い点: 11個のうち10個は式が単純で、やろうと思えば計算できる。**できるのにやらない**という判断なので、実用でつまずいたときに繰り返し再検討したくなる

### 未確認

- Canvas 2Dの`soft-light`がPhotoshopの「ソフトライト」と同じ式かを確認していない。W3Cの合成仕様に定義はあるが、Photoshopの実装と一致する保証は取れていない。**写せる16個の中にも見た目が合わないものがありうる**
- `hue`・`saturation`・`color`・`luminosity`の非分離モードについても同様に未確認
- 11個それぞれが実際のPSDでどれくらい使われるかを調べていない。「よく使われる」は一般的な印象に基づくもので、手持ちのPSDで数えていない

## 補足

- 見直しの目安は、実用のPSDを開いて11個のいずれかに繰り返し当たったとき。そのときは2番目の選択肢（式が単純なものだけ自前で埋める）へ移る。移行時に書き直すのは`blendMode.ts`と`composite.ts`のレイヤー合成部分で、`tree.ts`とマスク処理には及ばない
- `pass through`は対応表に載せない。グループを分離するかどうかの分岐で、合成演算ではない。扱いは[仕様書](../design/psd-viewer-v1.md)の合成アルゴリズムを参照
- 対応表の値が`null`のとき未対応として記録し、描画は`source-over`で続ける。この判定は`lib/`の純関数なので単体テストの対象になる（[テスト規約](../../.claude/rules/testing.md)）
