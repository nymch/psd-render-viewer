# UI text dictionary

## Overview

Collect every string the app shows a user into one typed dictionary, referenced by key rather than written where it is displayed. **One locale, Japanese. Nothing switches languages.**

## Background

The wording has drifted. Six terms appear in the UI that [the glossary](../glossary.md) does not define: クリッピングレイヤー, レイヤー効果, ベクトルマスク, 通常合成, 合成演算, and 名称未設定. The first is the worst of them — the glossary already has クリッピングマスク, so the UI uses two words for one thing, which [documentation-style.md](../../.claude/rules/documentation-style.md) forbids outright.

**Finding those six did not need a dictionary.** One `grep` over the source produced the list, which is exactly how it was produced. So the case for this work is not that the wording cannot be read as a set today — it demonstrably can. It is that **six terms drifted across eight files without ever sitting side by side**, and nothing about fixing them in place makes the seventh any more visible than the first six were.

There are 22 such strings today, which is the fewest there will ever be. **Extraction changes structure; translation does not.** Pure functions in `lib/` have to stop returning display text, and the worker's error channel has to carry a classification instead of a sentence — both get harder as more code comes to depend on their current shape. Translating gets more expensive with waiting too, but only in proportion to how many strings exist; it takes on no structural cost, which is why none is written here.

[ADR-0005](../adr/0005-repository-language.md) excluded user-facing strings from the migration to English and left them to i18n. This is the half of that work that pays for itself now.

## Goals

- Every string the app shows lives in one file and reads as a list
- Every term in that file is in the glossary, or the glossary gained a row for it
- A second locale can be added later without touching a component
- `lib/` produces no display text

## Out of scope

- **Switching languages**, and any state that would drive it. With one locale there is nothing to switch, and an unused `atom` is machinery for a future that has not arrived
- **A second locale.** An unread translation drifts from the one people read, and nothing catches it — a type can see a missing key, not a stale sentence
- **Component tests.** Their absence is what makes the visual check below necessary. Adding them overturns the two-layer rule in [testing.md](../../.claude/rules/testing.md) and picks a library, so it belongs in its own ADR. Worth recording for whoever writes it: only the components that carry text need covering, and the canvas path — where jsdom stops being useful — does not
- **The three internal `throw` messages**, below

## Specification

### Interaction and screen

Nothing moves. The same strings appear in the same places, and some read differently once the wording pass lands.

### Data

The dictionary is a plain object in `lib/i18n/ja.ts`. Entries that interpolate a value are **functions rather than strings with placeholders**, so the compiler checks their arguments and no format language has to be invented or parsed at run time.

```typescript
export const ja = {
  layerPanel: {
    heading: "レイヤー",
    empty: "レイヤーがない",
    unsupportedCount: (count: number) => `未対応${count}件`,
  },
};
```

`lib/i18n/index.ts` derives the contract with `export type Dictionary = typeof ja`, per [typescript.md](../../.claude/rules/typescript.md)'s rule against maintaining a second definition. A future locale has to satisfy `Dictionary`, which makes a missing key and a mismatched argument both compile errors.

**Do not write `as const` on the dictionary.** It narrows every entry to its own literal type, so `Dictionary` would then demand that a second locale repeat the Japanese verbatim — `Type '"Layers"' is not assignable to type '"レイヤー"'`. Every correctly translated line would fail to compile, which is the exact opposite of the check this shape exists to provide.

Components read through `useDictionary()` in `hooks/i18nHooks.ts`, following [react.md](../../.claude/rules/react.md)'s placement rule. With one locale it returns a constant. **It exists so that the seam is in one place**: swapping in locale-aware state later changes that hook and nothing else.

`LayerNode.name` becomes `string | null`. Today `buildLayerTree` bakes the placeholder in at `layer.name ?? UNNAMED_LAYER`, which makes `lib/` a source of display text. `null` states the fact — this layer has no name — and the panel decides what to show.

### Failure cases

What reaches the error line splits three ways, and **only one of them can carry a key**.

| Kind | Examples | Handling |
| --- | --- | --- |
| The app decided it | Over the size limit, 16-bit, over the memory limit | Keyed. The condition is one this code tests for |
| `ag-psd` threw | A parse failure | Passed through verbatim |
| An invariant broke | `2Dコンテキストを取得できなかった` | Passed through verbatim |

The last two stay raw deliberately. **A localized internal message is harder to trace than the original** — "予期しないエラー" in a report says nothing, while the original text names the line that produced it. The user can do nothing about either, but the difference between them matters: a parse failure means the file is the problem, and an invariant break means this code is.

## Technical design

| File | Change |
| --- | --- |
| `lib/i18n/ja.ts` | New. The 19 keyed strings |
| `lib/i18n/index.ts` | New. `Dictionary` derived from `ja` |
| `hooks/i18nHooks.ts` | New. `useDictionary()` |
| `lib/psd/tree.ts` | `describeUnsupported` removed. `UNNAMED_LAYER` removed and `LayerNode.name` becomes nullable |
| `lib/psd/limits.ts` | `describeRejection` removed. `DocumentRejection` stays |
| `lib/psd/workerMessage.ts` | The error side carries `WorkerFailure` instead of a string |
| `lib/psd/worker.ts` | Classifies a failure instead of wording one. `toMessage` goes |
| `hooks/psdHooks.ts`, `components/` | Read from the dictionary; format the unions |

`UnsupportedReason` and `DocumentRejection` need no new shape. **They are already a key and its arguments** — `{kind: "blend-mode", blendMode}` is exactly that — so formatting simply moves to where the dictionary is, and both travel through structured clone unchanged.

```typescript
export type WorkerFailure =
  | {kind: "document"; rejection: DocumentRejection}
  | {kind: "memoryLimit"}
  | {kind: "raw"; message: string};
```

**Extraction and rewording are separate commits.** Moving a string and changing it in one diff makes the two indistinguishable, and reviewing the wording is the point of this work. The same split is why [ADR-0006](../adr/0006-split-glossary.md) required the glossary to be cut before it was translated.

## Alternatives considered

- **Hold the dictionary outside the code and generate the typed module from it.** This is what the Next.js guide does with `dictionaries/*.json`, and it is right once translators or a CMS are involved. Neither is. JSON cannot hold a function, so the seven interpolated entries would need placeholders, a format function, and somewhere to declare whether a value is a number or a string — a second schema. The generator would then have to run ahead of `dev`, `build`, `lint`, and `test`, or produce a committed file that can go stale. **The tooling would outweigh 22 strings and one editor.** Going from a typed module to generated data later costs an export; going back costs removing a build step from four entry points
- **Key the internal errors too.** It would leave nothing outside the dictionary, but it trades away the diagnostic value described above
- **Import `ja` directly in each component.** One fewer module, but adding a locale would then touch every component that shows text, which is the cost this spec exists to avoid
- **Write English now.** ADR-0005 says i18n makes the UI bilingual, so this is the letter of it. But no user needs an English UI, and ADR-0005 itself says the work becomes urgent only when one does

## Open questions

- **Which glossary rows to add.** レイヤー効果 and ベクトルマスク are real PSD concepts this app names and the spec already uses, so they likely earn rows rather than being reworded away. 通常合成 and 合成演算 may be reducible to 合成, which the glossary has. クリッピングレイヤー is not a question — it becomes クリッピングマスク
- **The reworded text itself.** Settled in the rewording commit, once the strings can be read together
- **Nothing will catch a dictionary entry that no component uses any more.** TypeScript does not report an unused object property, so a key outlives its last caller in silence. While the strings sat inline this could not happen — deleting the code deleted the string with it. It is the rot this shape introduces, and the same kind the out-of-scope section cites against carrying a second locale. No cheap guard is known, so it is recorded rather than solved

## How to verify

**The extraction commit is verified by the strings not changing**, and it earns its keep twice: with extraction proved verbatim, **the next commit's diff is exactly the wording review**, which is what this work is for. [ADR-0006](../adr/0006-split-glossary.md)'s split used the same check.

Sixteen of the nineteen are string literals today. Extracting those from `develop` and from the dictionary and comparing the two sets byte for byte settles them mechanically.

**The other three have no "before" literal to compare against.** `未対応{unsupportedCount}件`, `⚠ {attempt.fileName}を読み込めなかった: {attempt.message}`, and `{attempt.file.name}を読み込んでいる…` are JSX children — text nodes split around an expression — and only become a single string once the dictionary holds them. Reassembling them is done by hand, so the before and after belong side by side in the commit message where they can be read. **The space after `⚠` and the `: ` between the filename and the reason exist only as JSX text**, and are what a careless reassembly drops.

**The rewording commit is verified against the glossary.** Every term in the changed strings is in the glossary, or the glossary changed in the same commit.

Then, across the repository:

```bash
grep -rn '[ぁ-んァ-ヶ一-龠]' --include='*.ts' --include='*.tsx' app atoms components hooks lib
```

Only `lib/i18n/ja.ts` and the three internal `throw` messages may answer.

`npm test` stays at 46. `tree.test.ts` changes one assertion from the removed constant to `toBeNull()`; nothing else in the suite touches display text.

**One pass by eye is required.** Unit tests cover pure functions in `lib/` only, and this repository writes no component tests, so nothing mechanical proves that a component reads the key it should. Open a PSD and read the panel, the tooltip, the empty state, and an error.
