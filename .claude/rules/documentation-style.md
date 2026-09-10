# Writing style

Rules for Markdown, code comments, commit messages, and PR bodies. This is a solo project, so this covers the minimum needed to keep things readable rather than a strict house style.

**Everything committed to this repository is written in English.** Two things are outside that rule, both recorded in [ADR-0005](../../docs/adr/0005-repository-language.md): user-facing UI strings, which become bilingual through i18n; and the Japanese trigger phrases in each skill's `description` frontmatter, which are matching text rather than prose. The language a skill *converses* in is decided by that skill, not here.

## What goes where

| Subject | Location | Template |
| --- | --- | --- |
| The spec for something being built | `docs/design/` | [docs/design/template.md](../../docs/design/template.md) |
| A technical decision and its reasoning | `docs/adr/` | [docs/adr/template.md](../../docs/adr/template.md) |
| Terms and their identifiers | [docs/glossary.md](../../docs/glossary.md) | — |
| Verified `ag-psd` behavior | [docs/ag-psd-notes.md](../../docs/ag-psd-notes.md) | — |

See [docs/README.md](../../docs/README.md) for details. Follow the wording in `docs/glossary.md`, and do not use two words for the same thing.

## Notation

### Use backticks for code references

Wrap file names, commands, environment variables, package names, type names, and literal values in backticks.

```
Good: parsing lives in `lib/psd.ts`
Good: `ag-psd` depends on browser APIs
Good: when `blendMode` is `"multiply"`, compositing changes
```

### Punctuation and lists

- Use the Oxford comma.
- For a pair of alternatives, use a spaced slash: `parse / render`.
- Use an em dash for an aside — like this — without spaces around it.

### Register

- Present tense, active voice.
- Imperative for procedures: "run `npm test`", not "you should run `npm test`".
- Do not write "we". State the rule.
- Sentence case for headings, not Title Case.
- Contractions are fine. Aim for plain, not formal.
- US spelling.
- No space before a unit: `100MB`, `4GB`, `8192px`.

### Bold carries the load-bearing claim

This repository puts the one claim a paragraph exists to make in `**bold**`, and leaves the rest unmarked. Keep doing that. A document where everything is bold, or nothing is, makes the reader re-derive what matters.

## Markdown

- Annotate code blocks with a language (` ```bash `, ` ```typescript `).
- Link to existing files with a relative Markdown link, relative to the file being written. Do not link to a file that does not exist yet — write it in backticks followed by `(not written yet)`.

```
Good: [glossary](../../docs/glossary.md)
Good: `docs/runbooks/deploy.md` (not written yet)
```

## Commit messages

Prefer `type(scope): description`. The scope is optional. Start lowercase, no trailing period.

**Say what changed, not what you did.**

```
Bad:  feat(viewer): add opacity slider work
Good: feat(viewer): add a per-layer opacity slider
Good: fix: release ImageBitmap so repeated loads stop leaking
```

See [commit](../skills/commit/SKILL.md) for how `type` and `scope` are chosen.

## Writing quality

### Avoid hollow phrasing

Do not use filler that carries no content. State the claim directly.

- Announcements: "It's important to note that", "In this section we will", "In summary", "Let's dive in"
- Empty intensifiers: crucial, key, fundamental, seamless, robust, comprehensive, holistic, leverage
- Hollow verbs: "delve into", "unpack", "explore" with nothing following
- Padding structures: "not only X but also Y", and rule-of-three lists where the third item exists to make three

```
Bad:  This section explores canvas rendering from multiple angles.
Good: Canvas cleanup releases the bitmap and cancels the pending frame.
```

Keep hedges that express real uncertainty ("may", "seems", "probably").

### Avoid redundancy

- Do not make the same point twice. Do not restate something in different words right after saying it.
- Do not write self-questions or anticipate the reader's reaction ("You may be wondering whether… You are right.").
- Do not spell out steps the reader can fill in.

```
Bad:  Release the ImageBitmap. In other words, free it when you are done.
Good: Call `bitmap.close()` when the bitmap is no longer needed.
```

### No vague demonstratives

Name what a pronoun refers to, so a sentence works without re-reading the one before it.

```
Bad:  Running this frees the memory.
Good: Calling `bitmap.close()` frees the GPU memory.
```
