---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "e2e/**/*.spec.ts"
  - "test/**/*.ts"
  - "vitest.config.mts"
  - "playwright.config.ts"
---

# Testing conventions

How tests are written in this repository. Language-level conventions are in [typescript.md](typescript.md); React and rendering conventions in [react.md](react.md).

## What gets tested

**Two layers only: pure functions in `lib/`, and E2E.** No unit tests for React components.

| Layer | Tool | Subject |
| --- | --- | --- |
| Unit | Vitest | Data transforms and calculations in `lib/`: building the PSD layer tree, coordinate math, zod schemas |
| E2E | Playwright | Behavior in a real browser, through opening a PSD and seeing it drawn on the canvas |

The split follows where bugs actually appeared. All three traps hit during development were in the pure transform from PSD to layer tree.

- Layer order was handled backwards, so the background covered every layer
- Group opacity is not inherited by children — `ag-psd` does not hand back an accumulated value, so it has to be multiplied in
- The visibility property was misread, and every layer disappeared

Canvas rendering does not work under jsdom, and mocking it does not verify what is actually drawn. **Rendering correctness is verified by E2E.** So the calculation of rendering parameters — which layer, in what order, at what opacity — is extracted into pure functions in `lib/` and unit tested there. Keep the writes to the canvas itself as thin as possible.

## When to write one

Coverage percentage is not a target. Chasing a number adds tests without reducing breakage. Use these triggers instead.

- **A pure function is added to `lib/`** — write the test then and there
- **A bug is being fixed** — write a test that reproduces it first, confirm it fails, then fix. The same breakage does not get to happen twice

Everything else is optional. Do not add tests for UI tweaks or style changes.

## Unit tests (Vitest)

- Put the test file **next to its subject** (`lib/psd.test.ts` for `lib/psd.ts`)
- One test verifies one thing. Do not line up `expect` calls covering separate concerns
- Write test names in English, saying **what becomes what** (`"multiplies group opacity into its children"`). Do not write names like `"works correctly"`
- Use real data. Put PSD fixtures in `test/fixtures/` and record what each file is meant to verify, in a comment or a README

### Config file extension

**Use `vitest.config.mts`, not `.ts`.** With `.ts` it is read as CommonJS, and the ESM syntax it uses raises a warning.

The `paths` alias (`@/*`) from `tsconfig.json` is resolved by Vite's own `resolve.tsconfigPaths`. `vite-tsconfig-paths` is not needed.

### ag-psd setup

**Under Node, `readPsd` throws unless `initializeCanvas` is called first.** It asks for a canvas internally even with `useImageData: true`. `test/setup.ts` passes a stub, loaded through `setupFiles` in `vitest.config.mts`.

Browsers need no such initialization, so treat the stub as test-only.

## E2E (Playwright)

**Not set up yet.** Playwright is not installed, there is no `e2e/` directory, and `package.json` has no `test:e2e` script. What follows is how it works once it is, not what can be run today. The spec's out-of-scope list keeps E2E outside the first version.

- Files go in `e2e/` as `*.spec.ts`
- **Exclude `e2e/` in `vitest.config.mts` so Vitest does not pick it up.** Vitest matches `.spec.ts` by default, and without the exclusion it runs the Playwright tests and fails
- Cover canvas rendering and opening a file. **Do not write an E2E test for something a unit test can verify** — E2E is slow and brittle
- Prefer decidable facts ("it rendered", "the layer count matches") over screenshot comparison

## Running

```bash
npm test  # Vitest
```

`npm test` must pass before opening a PR. See [create-pr](../skills/create-pr/SKILL.md) for the procedure.

There is no E2E command yet — see the section above.
