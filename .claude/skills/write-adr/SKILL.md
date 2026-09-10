---
name: write-adr
description: Work through the options and trade-offs behind a technical decision and record it in docs/adr/ as an ADR. Use for library choices and structural decisions, or requests like "help me decide between these", "record this decision", or Japanese phrasings such as 「どっちにするか決めたい」「この判断を記録しておきたい」.
user-invocable: true
allowed-tools: Read, Write, Glob, Grep, AskUserQuestion, WebSearch, WebFetch, Bash(ls *), Bash(npm view *), Bash(git log *)
---

# write-adr

Work through a technical decision in conversation and write an ADR to `docs/adr/`, following [docs/adr/template.md](../../../docs/adr/template.md). The conventions are in [docs/adr/README.md](../../../docs/adr/README.md).

Deciding alone means **the first idea that surfaces becomes the decision, uncompared.** This skill takes on the job of laying out the options, and fixes the criteria before comparing anything.

**Conduct the interview in the user's language.** If they write in Japanese, ask in Japanese; if in English, ask in English. **The ADR file itself is always English**, per [ADR-0005](../../../docs/adr/0005-repository-language.md).

Related skills: [write-spec](../write-spec/SKILL.md) (works out a spec) and [devils-advocate](../devils-advocate/SKILL.md) (argues against a finished ADR).

## Interview principles

**Ask one question at a time.**

**Look facts up.** For a library choice, confirm what it can actually do using `WebFetch`, `WebSearch`, `npm view`, and the existing code. **Do not write pros and cons from guesswork.** Mark anything unconfirmed as unconfirmed.

**Prepare at least three options.** Even when the user has only one, research an alternative and put it forward. Always include "don't do it / don't decide yet" as one of them — sometimes not deciding is the right call.

**Fix the criteria first.** Comparing options without criteria means deciding on whatever impression is handy. Criteria that tend to matter on a hobby project:

- Maintainable by one person (learning cost, depth of documentation)
- Reversible later (cost of backing out)
- Keeps implementation moving (maturity of the dependency)
- Actually does the job (feature coverage)

Once the criteria are listed, **make the user rank them.** How the criteria are weighted is what decides the decision.

## Procedure

### 1. State the decision in one sentence

Put "what is being decided" into one sentence. If it is blurry, narrow it with questions. If several decisions are mixed together, split them into separate ADRs.

`Glob` the existing `docs/adr/` to see whether a decision on the same subject already exists. If one does, confirm whether this overturns it or supplements it.

### 2. Ask for the background

Why does this need deciding now? What goes wrong if it is not decided? If this is thin, point out that it may be too early to decide at all.

### 3. Fix the criteria

Offer candidate criteria and have the user rank them.

### 4. Lay out the options

Present three or more: the user's, an alternative you researched, and "don't do it".

For each option, research and show how it fares against each criterion. Cite where it came from — a documentation URL, or `file:line` in the existing code.

If the user looks ready to decide on the spot, **make one attempt to defend the weakest-looking option.** Solo development produces no opposing view, so produce one deliberately.

### 5. Decision and consequences

Have the user choose, and put the reason into words **tied back to the criteria**. Do not settle for "it seems better".

Then always draw out **what this decision gives up**. An ADR listing only upsides is useless to whoever reads it later.

### 6. Write it out

1. Find the highest number among the existing files in `docs/adr/` and add one (`0001` if there are none)
2. `Read` [docs/adr/template.md](../../../docs/adr/template.md) and fill it in
3. Set the frontmatter `status` to `accepted` if it is implemented and settled, `proposed` if it is still to be tried. Set `date` to today
4. `Write` to `docs/adr/NNNN-short-english-title.md`

**Always record the options that were not chosen, and why.** Most of an ADR's value is there. The conclusion alone can be read off the code.

One decision per file. If two got mixed together, split them.

Follow [.claude/rules/documentation-style.md](../../rules/documentation-style.md).

### 7. Point to what comes next

Give the path that was written. If the decision overturns an existing ADR, propose updating that one's `status` to `superseded by ADR-NNNN` (**never delete the original**).
