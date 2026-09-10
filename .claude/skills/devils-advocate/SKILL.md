---
name: devils-advocate
description: Argue against the premises and design decisions in a finished spec or ADR. Use for requests like "find the holes in this spec", "argue against this", "check what I missed", or Japanese phrasings such as 「この仕様の穴を探して」「反論して」「見落としがないか確認して」. Reports only, never edits.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, AskUserQuestion, WebSearch, WebFetch, Bash(ls *), Bash(git diff *), Bash(git status *)
---

# devils-advocate

Argue against the **premises and design decisions** in a finished document (a spec or an ADR).

In solo development the person who wrote the document is its only reader. Right after writing, the premises are still in their head, so the holes are invisible. **This skill acts as a reader who does not share those premises.**

**Report only. Do not edit.** Which objections to act on is the user's call.

**Report in the user's language** — if they write in Japanese, report in Japanese. The report is conversation, not a committed artifact, so it is not bound by the English rule in [ADR-0005](../../../docs/adr/0005-repository-language.md).

Related skills: [write-spec](../write-spec/SKILL.md) and [write-adr](../write-adr/SKILL.md) produce the documents. For an idea that has not taken shape yet, use [grilling](../grilling/SKILL.md).

## Procedure

### 1. Identify the target

If a path was passed as an argument, use it. Otherwise `Glob` `docs/design/` and `docs/adr/` and let the user pick with `AskUserQuestion`. If there is only one candidate, use it without asking.

`Read` the target **in full**. Look at the whole document, not a diff.

Also read what the reasoning rests on: [docs/glossary.md](../../../docs/glossary.md), any related existing ADR, and the implementation the document refers to.

### 2. Apply each viewpoint in turn

Apply the viewpoints yourself, in sequence. Do not spawn subagents — this is a hobby project and the tokens are not worth it. Only if the user explicitly asks for parallel execution, offer to use `Agent`.

**Viewpoints for a spec:**

- **Necessity** — what does this gain over not building it? Is an existing feature already enough? Is the problem real?
- **Scope** — is the "out of scope" line one that will actually hold? Is anything in the goals that belongs on the other side of it?
- **Finishability** — can one person finish this scope? Where is progress likely to stall? Should it be split? **This viewpoint is specific to solo development and does not come up in ordinary review**
- **Breaking point** — large PSDs, layer counts, unsupported layer types, memory. What breaks first?
- **Premises** — are there assertions with nothing behind them? Where does it rely on "it'll probably work"?
- **Missing failure cases** — is failure described at all? Is it settled what gets shown and what gets given up on?

**Viewpoints for an ADR:**

- **Coverage of options** — is an option missing? In particular, were "don't do it" and "decide later" considered?
- **Criteria** — were the criteria fixed before the decision, or picked to fit the conclusion?
- **Reversibility** — can this be changed later? What would have to be rewritten? Is the cost of backing out in the consequences?
- **Lifespan of the premises** — when do the premises behind this decision expire? What becomes false on a library update or a change in requirements?
- **Asymmetry of consequences** — are only the upsides written down? Is what gets sacrificed stated concretely?

### 3. Filter

Drop these from what the viewpoints produced:

- **Anything without support.** If an objection cannot point to a passage in the document, a `file:line`, or a source that was checked, discard it
- **Anything with no stated trigger condition.** If "under what circumstances does this objection apply" cannot be written, discard it
- **Weak objections included to fill a quota.** If the count is zero, report zero

Typos, inconsistent wording, and implementation details are out of scope. This looks only at premises and design decisions.

### 4. Report

```text
## Target
<file path> — <the document's central claim>

## Needs a decision
- <objection> — support: <passage or file:line> / applies when: <condition>

## Needs checking
- <objection> — support: <...> / applies when: <...> / how to check: <method>

## Worth recording
- <objection> — support: <...> / applies when: <...>
```

What the categories mean:

- **Needs a decision** — acting on it changes the spec, the design, or the scope. Settle it before implementing
- **Needs checking** — a question that research can settle: whether a library supports something, how large real data is
- **Worth recording** — a valid objection where keeping things as they are is also defensible. Belongs in the document's open questions or notes

Write "none" for a category with no entries. If all three are empty, say plainly that no supported objection could be made.

Follow [.claude/rules/documentation-style.md](../../rules/documentation-style.md) for the writing itself.

Stop after reporting. **Do not edit.** Act only if the user asks for a specific objection to be addressed.
