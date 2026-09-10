---
status: accepted
date: 2026-09-10
---

# Write everything committed to the repository in English, and localize the UI separately

## Context

Everything written for this repository so far is Japanese: the specs and ADRs under `docs/`, the conventions and skills under `.claude/`, code comments, test names, commit messages, and the strings the app renders in the browser. 52 tracked files contain Japanese.

Going forward the repository should be English. Deciding that is not enough on its own, because "the repository" covers text with very different jobs:

- prose a reader consumes (`docs/`, comments, test names)
- instructions a model consumes (`.claude/rules/`, `.claude/skills/`)
- strings a **product user** sees (the layer panel, error messages, tooltips)

Those three do not want the same answer, and a blanket "translate it all" breaks two of them. This ADR fixes the line so the migration does not have to re-decide it file by file.

## Decision criteria

1. **A rule must still mean something after translation.** Some of what is written here is *about* Japanese; translating it produces a rule that contradicts itself.
2. **Nothing that changes Claude's behavior may change silently.** Some text is functional, not prose. Breaking it produces no error.
3. **The product's language is not the repository's language.** Who reads a string decides its language, not where the string lives.

## Options considered

**Scope**

- Translate every Japanese string in the repository, UI included
- Translate the repository, leave the UI Japanese
- Translate the repository, make the UI switchable

**ADRs and the spec**

- Translate them
- Leave them in the language they were written in, as historical records, and write only new ones in English

**Skill instructions**

- Translate the whole file, frontmatter included
- Translate the body, keep the Japanese trigger phrases in `description`
- Leave the skills Japanese

## Decision

**Everything committed to the repository is English. User-facing UI strings are excluded and become bilingual through i18n instead.**

### The three exceptions, and why each exists

**1. Japanese trigger phrases stay in each skill's `description` frontmatter.**

`description` is not prose. It is the only field the model matches a request against when deciding whether to invoke a skill. Translating 「コミットして」「PRを作って」「仕様書を書いて」 out of it means those requests stop firing the skill — with no error, no warning, and nothing in a diff that looks wrong. `.claude/skills/grilling/SKILL.md` already carries this shape: an English description that names its Japanese triggers. Every skill follows it now.

**Do not "clean up" the Japanese in those lines.** That is the single most likely way this migration silently degrades the repository.

**2. Interactive skills follow the user's language; their artifacts are always English.**

These are two independent axes and both need stating in each skill. An English instruction body with nothing said about interview language makes Claude conduct the interview in English. Meanwhile `write-spec` and `write-adr` write files into `docs/`, which are English regardless of what language the interview ran in.

**3. UI strings are out of scope, and get i18n instead.**

The repository being English is a working preference. The app's language is a product question with a different answer: it stays available in Japanese, because its vocabulary is aligned with Photoshop's Japanese UI and that is what makes it legible to the people who use it. Replacing those strings with English would be a product regression disguised as a cleanup.

That work is a feature, not a translation, so it gets its own spec via `/write-spec` after this migration lands. Until then the migration does not touch them.

### Consequences

- Good: conventions, specs and ADRs can be read by anyone, and future ADRs stop being bilingual with the old ones
- Good: `.claude/rules/documentation-style.md` gets rebuilt rather than translated, which is the only honest option — half of it was Japanese typography (spacing between ASCII and Japanese, 中黒 vs 読点, 常体) that has no English meaning
- Good: `docs/glossary.md` had accumulated two unrelated jobs; forcing the language question surfaced that and splits it
- Bad: `git log` becomes bilingual at a fixed point. History is not rewritten
- Bad: three glossary rows are rules *about Japanese wording* whose literal translation is self-contradicting. 描画モード carried "never write ブレンドモード" — in English the UI label *is* "Blend Mode", so the rule inverts. Same for 分離 and 未対応. These are re-authored, not translated
- Bad: ADRs lose some nuance. Their value is in the reasoning for rejected options, not the conclusion, and that is the part translation damages most. Accepted deliberately: all four ADRs are actively linked from other documents and 0003 is still `proposed`, so leaving them Japanese would mean a permanently mixed `docs/`
- Bad: the app is momentarily inconsistent — an English repository shipping a Japanese-only UI — until the i18n spec lands

## Notes

- The migration's ordering, per-PR scope and verification steps live in the plan, not here. This ADR records only what is English and why
- `AGENTS.md` lines 1-9 and all of `CLAUDE.md` are generated by `next dev` and are outside this decision
- Revisit if the app gains users who need an English UI, which would make the i18n work urgent rather than deferred
