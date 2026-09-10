<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Language

**Everything committed to this repository is written in English** — docs, comments, test names, commit messages, PR bodies. Two exceptions, both recorded in [docs/adr/0005-repository-language.md](docs/adr/0005-repository-language.md): user-facing UI strings, and the Japanese trigger phrases in each skill's `description` frontmatter. Conversation with the user follows whatever language they write in.

## Coding conventions

Read the relevant one before writing code.

- TypeScript: [.claude/rules/typescript.md](.claude/rules/typescript.md)
- React / hooks and Canvas rendering: [.claude/rules/react.md](.claude/rules/react.md)
- Tests: [.claude/rules/testing.md](.claude/rules/testing.md)
- Writing style for docs and comments: [.claude/rules/documentation-style.md](.claude/rules/documentation-style.md)

## Documentation

[docs/README.md](docs/README.md) says where things go. Specs use [docs/design/template.md](docs/design/template.md); technical decisions are recorded with [docs/adr/template.md](docs/adr/template.md). Terms and their identifiers follow [docs/glossary.md](docs/glossary.md).

Before starting an implementation, check whether `docs/design/` has a spec for it. If not, write one with `/write-spec`.

## Skills

This is a solo project, so skills stand in for the reviewer and the person to think out loud at. See [.claude/skills/README.md](.claude/skills/README.md) for the list and the order they're used in.

- `/write-spec` — settle a spec, into `docs/design/`
- `/write-adr` — settle a technical decision, into `docs/adr/`
- `/devils-advocate` — argue against a finished document
- `/grilling` — general-purpose interrogation
- `/create-issue` — file a bug or a deferred task as an issue
- `/commit` — analyze the changes and commit
- `/create-pr` — self-review the diff and open a PR

## Branching

Simplified git-flow. `main` is the released state, `develop` is the integration branch and the GitHub default.

- `feature/*`, `fix/*`, `refactor/*`, `docs/*`, `chore/*` — branch from `develop`, merge back to `develop`
- `hotfix/*` — branch from `main`, merge back to `main`, then also into `develop`
- Release — open a PR from `develop` to `main`

There are no `release/*` branches. PRs are opened with `/create-pr`.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4.

PSDs are parsed with `ag-psd` and drawn with Canvas 2D — see [docs/adr/0001-psd-parser.md](docs/adr/0001-psd-parser.md) for why. Parsing and compositing run in a Web Worker ([docs/adr/0004-worker-offloading.md](docs/adr/0004-worker-offloading.md)). Global state is Jotai. Data fetching is SWR, validation and type derivation are zod, and forms with a submit use React Hook Form + `zodResolver`; those three are not in `package.json` yet, so install them when they are first needed.
