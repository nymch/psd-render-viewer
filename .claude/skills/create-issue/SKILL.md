---
name: create-issue
description: Work out what is actually wrong, or what is actually being deferred, and file it as a GitHub issue matching the repository's issue forms. Use for requests like "file an issue", "report this bug", "leave this for later", or Japanese phrasings such as 「issueを作って」「バグを報告して」「あとでやることを残しておいて」.
user-invocable: true
allowed-tools: Bash(gh issue *), Bash(gh label list*), Bash(gh pr view *), Bash(git log *), Bash(git diff *), Read, Glob, Grep, AskUserQuestion
---

# create-issue

File an issue whose body matches the forms in [.github/ISSUE_TEMPLATE/](../../../.github/ISSUE_TEMPLATE/).

An issue written for one person is read by that same person weeks later, with none of the context still in their head. **Write down what was observed and how it was established, not the conclusion reached in the moment.**

Conduct the conversation in the user's language — if they write in Japanese, reply in Japanese. **The issue title and body are always English**, per [ADR-0005](../../../docs/adr/0005-repository-language.md).

## The trap this skill exists to avoid

`gh issue create` **does not apply an issue form.** The body goes up exactly as passed, so an issue filed from here comes out unstructured unless the structure is rebuilt by hand. Nothing errors; the issue just looks different from every issue filed through the browser.

So step 4 reads the form and reproduces its headings. Do not skip it, and do not hardcode the headings here — they live in the `.yml` and would drift.

## Procedure

### 1. Check the prerequisites

```bash
gh auth status
gh issue list --state all --limit 30
```

- **Not authenticated** — say so and stop
- **An existing issue covers this** — say which, and ask whether to comment on it instead of filing another. Nobody else is watching for duplicates

### 2. Decide which form

`Glob` `.github/ISSUE_TEMPLATE/*.yml` and pick from what is actually there.

| The situation | Form |
| --- | --- |
| The app does something it should not | `bug_report.yml` |
| Work put off on purpose, or a gap noticed and not filled | `task.yml` |

**If a spec or an ADR already settled the behavior, it is a bug, not a task.** A task is for something still undecided. Search `docs/design/` and `docs/adr/` for the behavior in question before choosing — a mismatch against a written decision is a defect, and filing it as a task hides that the answer already exists.

If neither form fits, say so and offer a blank issue. Blank issues are enabled.

### 3. Gather the content

**Look facts up; ask the user only for what cannot be found.** Read the code, the spec, and the ADRs before asking anything.

For a bug, the one thing that must be right:

- **Separate what was observed from what is inferred, and say which each one is.** "The overlay covers the panel" read off the source is not the same claim as "the panel does not respond", seen in a browser. If it has not been reproduced, say so in the first field and write the steps as *how to confirm* rather than as a record
- Get what actually happened before any theory. A cause offered first tends to decide which facts get collected
- The suspected-cause field is optional and last. Leave it empty rather than filling it with a guess

For a task, the field that carries the weight is where it came from: **the reason something was deferred is what later decides whether it is still worth doing.** "Left out of #14 because narrowing the overlay changes behavior and that PR was a translation" is useful. "Found in #14" is not.

Ask one question at a time. Do not batch them.

### 4. Build the body from the form

`Read` the chosen `.yml`. For each field in `body` order, skipping `type: markdown`:

- Write its `attributes.label` as a `###` heading
- Put the value underneath
- For a `dropdown`, use one of its `options` verbatim
- A field with `validations.required` must be filled. **Do not file with a required field empty or padded with "unknown"** — if it cannot be answered, that is worth saying out loud before filing

This is what GitHub produces from a form submission, so an issue filed here sits alongside one filed in the browser without looking odd.

Note the form's `labels:`, which `gh` also does not apply. Pass them with `--label`.

### 5. Write the title

One line, saying what is wrong or what needs doing — not the area it is in.

```text
Bad:  Loading overlay bug
Good: Loading overlay covers the layer panel, so collapsing a group does not work during a load

Bad:  test fixtures
Good: test/fixtures/ does not exist, so the spec's side-by-side comparison cannot be carried out
```

Follow [.claude/rules/documentation-style.md](../../rules/documentation-style.md): backticks around file names and identifiers, no hollow phrasing, name what a demonstrative refers to.

### 6. Present and confirm

Show the title, the label, and the full body. Use `AskUserQuestion` to offer create / revise / cancel.

### 7. File it

**Write the body to a temporary file under the scratchpad directory and pass that.** Backticks and `#` in a heredoc cause shell escaping accidents.

```bash
gh issue create --title "<title>" --label <label> --body-file <temp file>
```

### 8. Report

Give the issue URL. If a branch should follow, say which prefix fits (`fix/*` for a bug, otherwise `chore/*`, `docs/*`, or `refactor/*`) and remind that [create-pr](../create-pr/SKILL.md) writes `Closes #N` into the PR body.

**This skill does not close, edit, or comment on issues, and it does not start the work.**
