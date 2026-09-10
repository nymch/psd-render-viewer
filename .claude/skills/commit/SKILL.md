---
name: commit
description: Analyze the staged changes, propose commit message candidates, and commit once confirmed. Use for requests like "commit this", or Japanese phrasings such as 「コミットして」「commitして」.
user-invocable: true
allowed-tools: Bash(git *), AskUserQuestion, Read, Grep
---

# commit

Analyze the changes and propose a message following the commit convention in [.claude/rules/documentation-style.md](../../rules/documentation-style.md), then commit.

On a solo project the commit message is the only record of the work. **Say what changed, not what you did.**

Conduct the conversation in the user's language — if they write in Japanese, reply in Japanese. **The commit message itself is always English**, per [ADR-0005](../../../docs/adr/0005-repository-language.md).

## Procedure

### 1. Read the state

Run in parallel:

```bash
git status --short
git diff --staged --stat
git log --oneline -10
```

Then decide:

- **Nothing staged** — if there are unstaged changes, ask what to stage. If there is nothing at all, say so and stop
- **No commits yet** (`git log` fails) — treat it as the initial commit, go to step 2
- **Otherwise** — go to step 3

### 2. Initial commit

The first commit touches many files, so **always confirm before committing**:

1. List everything from `git status --short`
2. Read `.gitignore` and check that **nothing has slipped in that should not be committed**, especially:
   - Environment files such as `.env` and `.env.local`
   - Credentials, API keys, certificates (`*.pem`, `*token*`, `*credential*`)
   - Build output such as `node_modules/` and `.next/`
   - Large binaries such as sample PSDs — acceptable only if deliberate
3. If anything looks doubtful, raise it instead of committing

If it is clean, use a message like `chore: initial setup` with a body listing what went in (scaffolding, conventions, docs).

### 3. Analyze the changes

From the diff, identify:

- **Which paths changed** — used to infer `scope`
- **What kind of change it is** — addition, fix, bug fix, cleanup, docs
- **What effect it has** — what now works, what got fixed

**If the diff is large and mixes unrelated changes, propose splitting it.** With "switch the PSD parser" and "tweak the layer panel CSS" in one commit, neither can be reverted alone later.

### 4. Build the message

The form is `type(scope): description`. The `scope` is optional.

#### `type`

| `type` | Use for |
| --- | --- |
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `refactor` | Restructuring with no behavior change |
| `perf` | A performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Dependencies, config, chores |

#### `scope`

Derive it from the paths that changed. If the change spans several, pick the representative one or omit it.

| Path | `scope` |
| --- | --- |
| `app/`, `components/` | `ui`, or the feature name (`viewer`, `layers`) |
| `lib/` | What it operates on: `psd`, `canvas` |
| `hooks/`, `atoms/` | The domain name |
| `docs/` | `docs`, or `adr` for an ADR |
| `.claude/` | `rules` or `skills` |
| Config files, dependencies | Omit |

#### Wording

**Say what changed, not what you did.**

```
Bad:  feat(viewer): implement the layer panel component
Good: feat(viewer): let layers be toggled and reordered

Bad:  fix: fix a bug
Good: fix(canvas): release the ImageBitmap when a second PSD is opened
```

- Short and specific. Cut modifiers
- Start lowercase, no trailing period
- Join two parallel changes with `+`
- Follow [documentation-style.md](../../rules/documentation-style.md) — backticks for code references, no hollow phrasing

### 5. Offer candidates

Use `AskUserQuestion` to offer **three candidates that differ in viewpoint**, not three rewordings of the same sentence. Vary the granularity, what gets emphasized, and how `scope` is drawn.

The user can always type their own through "Other".

### 6. Commit

Confirm before running. Once approved, `git commit`.

Use a heredoc for a multi-line message:

```bash
git commit -m "$(cat <<'MSG'
type(scope): summary

- detail
- detail
MSG
)"
```

Afterwards show the result with `git log --oneline -1` and `git status --short`.

**This skill does not `git push`.** Whether to push is a separate decision.
