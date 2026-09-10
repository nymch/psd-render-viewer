---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mts"
---

# TypeScript conventions

Conventions for writing `.ts` / `.tsx` in this repository. React components and hooks and Canvas rendering are covered in [react.md](react.md); prose and comment style in [documentation-style.md](documentation-style.md).

## Strictness

- Type checking is governed by the root `tsconfig.json`, which enables `strict`. Do not loosen it.
- Treat indexed access on arrays and objects as possibly `undefined`. Check for existence or narrow before using the value. PSD layer arrays get indexed often, so this comes up a lot.
- Do not use `any`. Receive values of unknown shape as `unknown` and narrow.
- Keep type assertions (`as`) to a minimum. Prefer narrowing when it is safe.
- Do not use `@ts-ignore`. When a type error must be suppressed deliberately, use `@ts-expect-error` with a comment giving the reason. `@ts-expect-error` becomes an error itself once the underlying problem is fixed, so stale suppressions surface.

## Type definitions

- Default to `type`. Use `interface` only where it clearly fits, such as when declaration merging is needed.
- Do not use `enum`. Use a union of literals (`type BlendMode = "normal" | "multiply"`), or derive one from an `as const` object with `type Status = (typeof STATUS)[keyof typeof STATUS]`.
- When a union models state and a `switch` branches on it, add an exhaustiveness check in the `default` branch: `value satisfies never`. Adding a state then fails to compile until every branch is updated. Do not use `const _exhaustive: never = value` — it trips the unused-variable lint rule.
- Where a zod schema exists, derive the type with `z.infer<typeof schema>` rather than maintaining a second definition. Validate anything arriving from outside — API responses, metadata read from a file, `localStorage` contents — through a schema before use.

## Imports

- Use `import type` for type-only imports, separate from value imports. ESLint does not enforce this, so it is a review item.
- Reference files inside the repository through the `@/*` path alias, defined in `tsconfig.json` under `paths`. Do not write relative paths that climb with `../../`.

## Naming

| Subject | Style | Example |
| --- | --- | --- |
| Variables and functions | `camelCase` | `layerCount`, `parsePsd` |
| Types and React components | `PascalCase` | `LayerNode`, `LayerPanel` |
| Constant objects and env vars | `SCREAMING_CASE` | `BLEND_MODE`, `NEXT_PUBLIC_API_URL` |

### Functions

- Name functions in `camelCase`, starting with a verb (`parsePsd`, `renderLayer`, `fetchDocument`).
- Prefix functions and variables that hold booleans with `is` / `has` / `can` (`isVisible`, `hasAlpha`, `canRender`).
- Start React hooks with `use` (`usePsdDocument`).
- Prefix event handlers with `handle` and the props that receive them with `on` (pass `handleOpacityChange` to `onOpacityChange`).

## Lint

- Prettier is not installed. Do not produce large formatting-only diffs; match the surrounding style.
- Code must pass `npm run lint` (`eslint.config.mjs`, using `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`). Fix the cause rather than silencing a warning with `eslint-disable`.

## Comments

- Comment prose follows [documentation-style.md](documentation-style.md). Write comments in English.
- Say why, not what. Do not restate what the code already shows.
