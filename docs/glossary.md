# Glossary

Fixes the word used for each concept and the identifier it takes in code. Follow this table when writing a document and when naming a variable or a type. When a term looks like it is about to drift, add a row.

**The 日本語 column is what the app shows its users, not a translation of the English one.** It follows Adobe Photoshop's Japanese UI, because inventing a label of one's own breaks conversation with people who work in Photoshop. UI strings are outside the migration to English and become bilingual through i18n instead — see [ADR-0005](adr/0005-repository-language.md).

## PSD structure

| Term | 日本語 | Identifier | Description |
| --- | --- | --- | --- |
| Document | ドキュメント | `document` | One loaded PSD file. What `ag-psd`'s `readPsd()` returns |
| Layer | レイヤー | `Layer`・`layer` | One image element |
| Layer group | レイヤーグループ | `group` | A container for layers, which can nest. `ag-psd` represents it as a layer that has `children` |
| Node | ノード | `node` | Layers and groups taken together. A node is a group when it has `children` |
| Layer tree | レイヤーツリー | `layerTree` | The tree of layers and groups reachable from the document, walked through `children` |
| Blend mode | 描画モード | `blendMode` | How a layer composites with what is below it (normal, multiply, screen, and so on). **The Japanese label is 描画モード, never ブレンドモード** |
| Opacity | 不透明度 | `opacity` | 0-100% in Photoshop's UI. Say so in code when a value is held as 0-1 instead |
| Fill opacity | 塗りの不透明度 | `fillOpacity` | Opacity of the fill alone, with layer effects excluded. Not the same thing as `opacity` |
| Clipping mask | クリッピングマスク | `clippingMask` | Clips a layer to the opaque part of the layer below it |
| Layer mask | レイヤーマスク | `layerMask` | A grayscale mask attached to a layer |
| Text layer | テキストレイヤー | `textLayer` | A layer carrying text. Photoshop's English UI calls this a *type layer*; the identifier stays `textLayer` |
| Adjustment layer | 調整レイヤー | `adjustmentLayer` | Changes the tone of the layers below it. Carries no pixel data |
| Smart object | スマートオブジェクト | `smartObject` | A layer placed while keeping its source data |
| Artboard | アートボード | `artboard` | Several screen areas held inside one PSD |
| Pass through | 通過 | `"pass through"` | One of the group blend modes. The group's contents go straight up to the parent and composite with the layers below |
| Isolated | 分離 | `isolated` | Compositing a group's children into one buffer before compositing that buffer into the parent — what every group other than pass through does. **Photoshop has no such word in either language**; this repository uses it to describe the compositing model |
| Unsupported | 未対応 | `unsupported` | An element this app cannot reproduce. Shown to the user with this word. **In Japanese it is 未対応** — not 非対応, not サポート外 |

## Rendering

| Term | 日本語 | Identifier | Description |
| --- | --- | --- | --- |
| Composite | 合成 | `composite` | Stacking several layers into one set of pixels |
| Render | 描画 | `render` | Writing the composited result out to a canvas |
| Canvas | キャンバス | `canvas` | The HTML `<canvas>` element. For the PSD's own dimensions write **document size**, to keep the two apart |
| Viewport | ビューポート | `viewport` | The part of the image actually visible on screen |
| Zoom | ズーム倍率 | `zoom` | Display scale. 1 is actual size |
| Pan | パン | `pan` | Translation of the displayed position |

## Japanese wording

Rules for the 日本語 column only. The English half follows [.claude/rules/documentation-style.md](../.claude/rules/documentation-style.md) like everything else.

- Keep the long vowel mark: レイヤー, ユーザー, サーバー — not レイヤ, ユーザ
- Match Photoshop's Japanese UI label. A term Photoshop does not have (分離) is marked as such in the table
