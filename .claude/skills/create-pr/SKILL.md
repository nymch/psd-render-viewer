---
name: create-pr
description: Analyze the branch diff and commit history, fill in the PR template, and open the pull request. Use for requests like "open a PR", or Japanese phrasings such as 「PRを作って」「プルリクを出して」.
user-invocable: true
allowed-tools: Bash(git *), Bash(gh pr *), Bash(gh auth status), Bash(gh repo view *), Bash(npm run *), AskUserQuestion, Read, Grep
---

# create-pr

Analyze the branch diff and open a PR whose body follows [.github/pull_request_template.md](../../../.github/pull_request_template.md).

On a solo project the PR body is the only review record. **Write down the judgment calls the diff cannot show, not what the diff already says.**

Conduct the conversation in the user's language — if they write in Japanese, reply in Japanese. **The PR title and body are always English**, per [ADR-0005](../../../docs/adr/0005-repository-language.md).

## Branching (simplified git-flow)

| Branch | Base | Purpose |
| --- | --- | --- |
| `main` | — | Released state |
| `develop` | — | Integration branch, and the GitHub default |
| `feature/*` | `develop` | New features |
| `fix/*` | `develop` | Bug fixes |
| `refactor/*`, `docs/*`, `chore/*` | `develop` | Everything else |
| `hotfix/*` | `main` | Urgent fix to a release. **Merge back into `develop` afterwards** |
| Release (`develop` → `main`) | `main` | A release |

There are no `release/*` branches.

## Procedure

### 1. Check the prerequisites

Run in parallel:

```bash
gh auth status
git branch --show-current
git status --short
git remote -v
```

- **Not authenticated** — say so and stop
- **On `main` or `develop`** — ask the user to switch to a working branch and stop. The exception is being on `develop` with a clear intent to open a release PR, in which case continue as `develop` → `main`
- **Uncommitted changes** — use `AskUserQuestion` to ask whether to open the PR with what is committed, or commit first

### 2. Determine the base branch

**Derive it from the branch name prefix. Do not default to the repository's default branch.**

- `hotfix/*` → `main`
- `develop` (release PR) → `main`
- Anything else → `develop`

Then bring it up to date:

```bash
git fetch origin <base>
```

Compare against `origin/<base>` from here on. A stale local base pulls already-merged changes into the diff.

### 3. Gather information

Run in parallel:

```bash
git log origin/<base>..HEAD --oneline
git diff origin/<base>...HEAD --stat
git diff origin/<base>...HEAD
git ls-remote --heads origin <branch>
```

If there are no commits, say there is no difference from the base branch and stop.

### 4. Self-review

**Read the diff yourself before opening the PR.** There is no reviewer, so skipping this means nobody ever looks at it.

- Check for anything that violates the conventions in `.claude/rules/`
- Check for leftover debug code, commented-out remnants, and `console.log`
- Check for unrelated changes mixed into the diff. If there are, propose splitting the PR

When grepping for leftovers, watch for **false positives from documentation and from the skills' own prose**. Searching for `console.log` matches the very sentence that forbids it. Confirm a hit is real code before reporting it.

### 4.1. Verification

Run these to fill in the template's verification section:

```bash
npm run lint
npm run build
npm test
```

If any of them fails, do not open the PR. Report what failed and stop. Never open a PR on a broken state.

Run `npm test` only when `package.json` has a `test` script. If there is none, skip it and leave that checkbox unchecked.

E2E is slow, so it does not run by default, and **`package.json` has no `test:e2e` script today** — Playwright is not set up. Check before running it. Once the script exists, run it when the change touches canvas rendering or opening a file; until then there is nothing to run and the E2E line stays out of the verification section.

Run both even when the diff is docs or config with no application code, to confirm nothing broke.

**Never check a box for something that was not actually done.** Check "verified by running it" only after observing the behavior in a browser or CLI.

Report anything found to the user before opening the PR.

### 5. Write the body

Follow the structure of `.github/pull_request_template.md`.

- **Summary** — one to three lines
- **Type** — check the box implied by the branch prefix (`feature` → feature, `fix`/`hotfix` → bug fix, `refactor`/`chore`/`perf` → improvement, `docs` → documentation)
- **Background** — why the change is needed. Link the relevant `docs/design/` or `docs/adr/` if there is one
- **Approach** — **how it was solved, which alternatives were considered, and why they were rejected.** What changed belongs under Changes, not here
- **Changes** — the main points from the diff, as a list. File names in backticks
- **Verification** — check only what was actually verified. **Never check something that was not**
- **Documentation updates** — infer from the paths that changed, per the table below. If none apply, check "none of the above"
- **Notes** — open questions, things deferred, anything worth a closer look. Leave empty if there is nothing

| Changed path | Item |
| --- | --- |
| A new term, or a renamed identifier | `docs/glossary.md` |
| Library calls in `lib/`, added or changed dependencies | `docs/ag-psd-notes.md` |
| A change involving library choice or structure | `docs/adr/` |
| A change to what a feature does | `docs/design/` |
| Anything under `.claude/rules/` | `.claude/rules/` |

### 6. Write the title

```text
type(scope): description
```

`type` and `scope` are chosen the same way as in the [commit](../commit/SKILL.md) skill. Say what changed, not what you did.

### 7. Apply the style rules

Follow [.claude/rules/documentation-style.md](../../rules/documentation-style.md), in particular:

- Backticks around file names, commands, and type names
- No hollow phrasing
- Name what a demonstrative refers to

### 8. Present and confirm

Show the full title and body, then use `AskUserQuestion` to offer create / revise / cancel. If revise is chosen, apply the instructions and present again.

### 9. Push and create

If the branch is not on the remote, confirm before pushing:

```bash
git push -u origin <branch>
```

**Write the body to a temporary file under the scratchpad directory and pass that.** Embedding backticks and `#` directly in a heredoc causes shell escaping accidents.

```bash
gh pr create --base <base> --title "<title>" --body-file <temp file>
```

### 10. Report

Give the PR URL, and say:

- Which base branch it targets (`hotfix` and release PRs go to `main`)
- For `hotfix/*`, that it also needs merging into `develop` after it lands in `main`

**This skill does not merge.**
