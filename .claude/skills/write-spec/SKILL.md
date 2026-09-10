---
name: write-spec
description: Pin down a feature one question at a time and write the result to docs/design/ as a spec. Use for sorting out requirements before implementation, or requests like "let's decide what to build", "write the spec", or Japanese phrasings such as 「何を作るか決めたい」「仕様を固めたい」「仕様書を書いて」.
user-invocable: true
allowed-tools: Read, Write, Glob, Grep, AskUserQuestion, WebSearch, WebFetch, Bash(ls *), Bash(git log *)
---

# write-spec

Work through a feature in conversation and write a spec to `docs/design/`, following [docs/design/template.md](../../../docs/design/template.md).

This repository is developed by one person. A spec that lives only in someone's head goes into implementation unchallenged, and its premises collapse partway through. **This skill exists to fill in, through conversation, what a reviewer would have caught.**

**Conduct the interview in the user's language.** If they write in Japanese, ask in Japanese; if in English, ask in English. **The spec file itself is always English**, per [ADR-0005](../../../docs/adr/0005-repository-language.md).

Related skills:

- [write-adr](../write-adr/SKILL.md) — pins down and records a technical decision itself. If a heavy technical call comes up while working out the spec, split it off there
- [devils-advocate](../devils-advocate/SKILL.md) — argues against a finished spec
- [grilling](../grilling/SKILL.md) — general-purpose interrogation that leaves no document

## Interview principles

**Ask one question at a time.** Do not batch them. The next question depends on the last answer, so do not queue them up in advance.

**Look facts up; ask the user only for decisions.** Do not ask what can be found. Read first:

- [docs/glossary.md](../../../docs/glossary.md) — terms and identifiers. The spec uses this wording
- [.claude/rules/react.md](../../rules/react.md) — where state belongs (Jotai, refs, Server Components)
- Existing `docs/design/` and `docs/adr/` — check nothing contradicts an earlier decision
- Library documentation — what `ag-psd` can actually read, and so on. **Do not assert anything about the PSD format or a library's support from guesswork.** Look it up; if it stays unclear, put it under open questions

**Attach a recommendation to every question.** Leave the user with nothing to do but decide.

### Covering for the absent second opinion

Solo development is missing more than a critic. Take on these explicitly.

- **Supply the options yourself.** Do not evaluate only what the user proposed. At every branch, put at least one alternative of your own alongside it. Alone, the first idea that surfaces becomes the decision
- **Say the implicit premises out loud and confirm them.** Premises the user skipped as obvious ("the PSD is read from local disk", "there will be at most a few dozen layers") get written down and checked
- **Always make them decide what is out of scope.** The main reason a personal project never finishes is scope creep. Every time you ask about a goal, ask about its non-goals in the same breath
- **Do not agree by default.** If a proposal looks flawed, say so before moving on. Do not rush to consensus

## Procedure

### 1. Confirm the subject

Confirm in one sentence what the spec is about. If `docs/design/` already has a file on the same subject, check whether this is an update rather than a new file.

### 2. Walk the decision tree, one question at a time

Go depth-first in this order, finishing a branch before moving on. If an answer stays vague, offer concrete examples to narrow it.

1. **What is being built** — can it be said in one or two sentences? If not, the scope is too wide. Propose splitting it
2. **Why it is needed** — what is the current problem? If the answer stops at "it would be nice", ask whether it is really the top priority
3. **Definition of done** — what has to work for this to be finished? Get the answer as behavior ("opening the sample PSD shows every layer in the right stacking order", not "layers are visible")
4. **Out of scope** — what is explicitly not being done. Do not skip this
5. **Interaction and screen** — what the user does, and what happens
6. **Data** — which parts of the PSD get read, what state the app holds, and where it lives (`atoms/`, a ref, a Server Component)
7. **Failure cases** — unreadable files, unsupported layer types, size limits. What gets shown, and what gets given up on. **Always ask this.** It is the most commonly skipped question in solo development, and the most expensive one to answer late
8. **Technical design** — how it gets implemented. When a heavy call comes up (library choice, moving work to a worker, how data is held), say on the spot that it should be split into an ADR
9. **Open questions** — leave what cannot be settled explicitly unsettled. Do not force a decision
10. **How to verify** — how completion gets checked: which PSD to try, and what to look for

### 3. Confirm agreement

Summarize what was decided and check it matches. If the user corrects something here, go back to that branch.

If the user cuts it short ("that's enough"), write up what exists so far. Move unfilled sections into open questions.

### 4. Write it out

1. `Read` [docs/design/template.md](../../../docs/design/template.md)
2. Fill in each section. **Delete sections that cannot be filled.** Do not leave placeholders
3. Remove the HTML comment at the top, which explains the template
4. `Write` to `docs/design/<kebab-case-english-title>.md`

Follow [.claude/rules/documentation-style.md](../../rules/documentation-style.md), and use the wording from [docs/glossary.md](../../../docs/glossary.md). Do not state anything as settled that was not.

### 5. Point to what comes next

Give the path that was written, and suggest as appropriate:

- `/write-adr` if a technical decision should be split out
- `/devils-advocate` to have the spec argued against
- Adding to `docs/glossary.md` if a new term was introduced that is not in it
