---
status: accepted
date: 2026-09-10
---

# Split the verified `ag-psd` behavior out of the glossary into its own document

## Context

`docs/glossary.md` is 172 lines doing two unrelated jobs.

Lines 1-28 and 157-172 are a glossary: a table mapping each term to the identifier used in code, so that documents and variable names do not drift apart.

Lines 29-156 are something else — notes on how `ag-psd` actually behaves, established by running it against real PSDs. `hidden` means the opposite of what it reads like. `children[0]` is the backmost layer. Group opacity is not accumulated down from ancestors, and multiplying it into children is not always correct. Mask levels sit in RGB with alpha at 255 throughout, so feeding one to `destination-in` does nothing. `imageData` is a `PixelData`, not an `ImageData`, and only carries real content at 8 bits. `totalMemoryLimit` is cumulative, not per image. Without a `document`, `initializeCanvas` is required.

That second half is the most expensive knowledge in the repository. It cost real debugging to obtain and cannot be re-derived by reading the library's types.

The two halves also have different readers, which shows up in how they are already cited. Of the 15 inbound references to `glossary.md`:

| Citing | What it actually wants |
| --- | --- |
| `.claude/rules/react.md:113` ("the real API is documented in…"), `docs/design/psd-viewer-v1.md:11/64/188/207`, `.claude/skills/create-pr/SKILL.md:121` | the `ag-psd` notes |
| `AGENTS.md:22`, `.claude/rules/documentation-style.md:11/13/58`, `.claude/skills/write-spec/SKILL.md:26/76/84`, `docs/README.md:11/17` | the terms |

Every citation in the spec points at the `ag-psd` traps. None of them points at the terminology table. The two documents are already being used separately; only the filename says otherwise.

The question surfaced while planning the migration to English ([ADR-0005](0005-repository-language.md)), because translating a file is the moment its structure gets scrutinized. The decision stands on its own regardless of language.

## Decision criteria

1. **A document's name should predict its contents.** Nobody looks in a glossary for the reason a mask silently fails.
2. **Splitting must not cost more than it saves.** 15 inbound links have to land on the right half.
3. Cheap to reverse if wrong — it is two files and a set of links, not a data structure.

## Options considered

- Keep one file and translate it as-is
- Split the `ag-psd` notes into `docs/ag-psd-notes.md`
- Split, and additionally move the notes under `docs/architecture/` as a new category

## Decision

**Move lines 29-156 to `docs/ag-psd-notes.md`. `docs/glossary.md` keeps the terminology tables.** Inbound links are repointed per the table above; `.claude/skills/devils-advocate/SKILL.md:27` gets both.

Do the split **before** translating, as its own change, and move the lines unmodified. A diff that both relocates and rewrites text cannot be reviewed — there is no way to tell a moved line from a re-authored one, which is exactly where a fact gets dropped.

`docs/architecture/` was rejected. `docs/README.md` says not to create a directory before it has contents, and one file does not justify a category. If notes on other subsystems appear later, that is the moment to reconsider.

### Consequences

- Good: the `ag-psd` findings get a name that says what they are, instead of being buried at line 29 of a file called "glossary"
- Good: `write-spec` and `devils-advocate` load a 30-line terminology file instead of 172 lines, most of which is irrelevant to naming things
- Good: the two halves can now diverge properly — terminology follows Photoshop's UI, the notes follow whatever `ag-psd` version is installed
- Bad: one more file, and a reader who does not know the split may look in the wrong one. `docs/README.md` and the PR template's docs checklist both list it, which is the mitigation
- Bad: 15 references had to be checked by hand. A wrong one does not break a build — it just sends a reader somewhere unhelpful

## Notes

- The notes are pinned to **ag-psd 31.0.2**. They are empirical, so a version bump invalidates them until re-checked. `docs/ag-psd-notes.md` should say so at the top
- Revisit if a second subsystem accumulates the same kind of notes — at that point `docs/architecture/` earns its existence
