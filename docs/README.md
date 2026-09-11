# docs

Where this repository's documentation lives. Notation follows [.claude/rules/documentation-style.md](../.claude/rules/documentation-style.md).

## Where things go

| Directory | What goes in it | When to write it |
| --- | --- | --- |
| `design/` | The spec for a feature yet to be built: what it is and how it behaves | Before implementation starts |
| `adr/` | The record of a technical decision: what was chosen, and why | On a judgment call you will later want to remember the reason for |
| `glossary.md` | Terms: the word for each concept, what the app shows users in Japanese, and the identifier in code | When a term looks like it is about to drift |
| `ag-psd-notes.md` | How `ag-psd` behaves in practice, established by running it. Tied to the installed version | When the library's behavior contradicts its type definitions |

Split by what a document is for. **How** (a procedure) and **why** (how something came to be) do not go in one document. When a procedure is needed, create `runbooks/`; when the structure of a built system is worth writing down, create `architecture/`. Do not create an empty directory ahead of its contents.

## Index

- [Glossary](glossary.md)
- [ag-psd notes](ag-psd-notes.md)
- [Spec template](design/template.md)
- [ADR template](adr/template.md), [how to write an ADR](adr/README.md)

### Specs

- [PSD viewer (first version)](design/psd-viewer-v1.md)

### ADRs

- [ADR-0001 Use ag-psd as the PSD parser](adr/0001-psd-parser.md)
- [ADR-0002 Support the 17 blend modes Canvas 2D can express and fall back to normal for the rest](adr/0002-blend-mode-mapping.md)
- [ADR-0003 Decode layers one at a time, and budget memory by what is alive at once](adr/0003-deferred-layer-decoding.md) (**proposed**)
- [ADR-0004 Move parsing and compositing into a Web Worker, and throw the worker away after each load](adr/0004-worker-offloading.md)
- [ADR-0005 Write everything committed to the repository in English, and localize the UI separately](adr/0005-repository-language.md)
- [ADR-0006 Split the verified `ag-psd` behavior out of the glossary into its own document](adr/0006-split-glossary.md)
- [ADR-0007 Probe interactive recompositing on a long-lived worker that owns the canvas](adr/0007-interactive-recompositing-probe.md) (**proposed**)

## What does not go here

- Anything the implementation already says. It duplicates the code, and one of the two always goes stale
- A working log for its own sake. Only a judgment worth keeping goes into an ADR
