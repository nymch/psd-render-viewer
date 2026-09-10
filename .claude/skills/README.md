# skills

This is a solo project, so skills stand in for the reviewer and the person to think out loud at.

## The skills

| Skill | What it does | Artifact |
| --- | --- | --- |
| [write-spec](write-spec/SKILL.md) | Pins down a feature one question at a time | `docs/design/<name>.md` |
| [write-adr](write-adr/SKILL.md) | Works a technical decision through its options and trade-offs | `docs/adr/NNNN-*.md` |
| [devils-advocate](devils-advocate/SKILL.md) | Argues against the premises and design decisions in a finished document | A report only |
| [grilling](grilling/SKILL.md) | General-purpose interrogation, leaves no document | None |
| [commit](commit/SKILL.md) | Analyzes the changes and builds a commit message | A commit |
| [create-pr](create-pr/SKILL.md) | Self-reviews the diff and builds the PR body | A PR |

## The order they're used in

```
the idea hasn't taken shape
  └─ /grilling                      … sort out the thinking before writing it down

what to build is getting clearer
  └─ /write-spec                    … settle the spec, into docs/design/
       └─ /write-adr                … split off a heavy technical call, into docs/adr/
            └─ /devils-advocate     … have the finished document argued against
                 └─ implement
                      └─ /commit          … commit the changes
                           └─ /create-pr  … self-review and open the PR
```

`/devils-advocate` works better **after some time has passed** than immediately after writing. Right after writing, the premises are still in your head and it's easy to dismiss an objection without noticing.

## Why they're written this way

Solo development is missing more than a critic. Each skill carries these as obligations.

- **Someone to supply options** — otherwise only the ideas you thought of get considered. `/write-spec` and `/write-adr` always research an alternative and put it alongside
- **Someone to question premises** — a premise held in your head is never challenged. They write implicit premises down and confirm them
- **Someone to stop the scope** — the main reason a personal project never finishes is scope creep. Every goal gets a paired non-goal
- **Someone to record decisions** — reasoning that stays in a conversation is gone when you need it. `/write-spec` and `/write-adr` always write a file

## Language

The skill instructions are English, and so is everything they write into the repository. **Interactive skills conduct the conversation in whatever language the user writes in**, and each skill's `description` keeps its Japanese trigger phrases so a request in Japanese still invokes it. Both points are recorded in [ADR-0005](../../docs/adr/0005-repository-language.md).

Those Japanese phrases in `description` are matching text, not prose. Removing them stops the skill from firing, silently.

## Attribution

`grilling` comes from Matt Pocock's public skill. It is unchanged apart from Japanese trigger phrases added to its `description` and one appended sentence telling it to follow the user's language.

- [mattpocock/skills — grilling](https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling)

`write-spec`, `write-adr`, and `devils-advocate` were written for this repository.
