# psd-render-viewer

Opens a PSD in the browser, composites its layers onto a Canvas 2D, and shows the layer tree beside it. **Read-only — there is no editing.**

Blend modes, layer masks, clipping masks, and group opacity are reproduced. Anything that cannot be is marked in the layer panel with the reason, rather than skipped silently.

Parsing uses `ag-psd`. Parsing and compositing both run in a Web Worker, so the UI stays responsive while a 100MB-class file loads.

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4.

## Requirements

Node `v24.19.0`, pinned in [.nvmrc](.nvmrc).

## Running it

```bash
npm install
npm run dev    # development server on http://localhost:3000
npm run build  # production build
npm run lint   # ESLint
npm test       # Vitest
```

## Documentation

- [docs/README.md](docs/README.md) — the spec, the ADRs, the glossary, and what running `ag-psd` established
- [AGENTS.md](AGENTS.md) — coding conventions, the skills, and the branching model

Everything committed to this repository is written in English. The strings the app shows its users are the exception and stay Japanese until i18n lands; the reasoning is in [ADR-0005](docs/adr/0005-repository-language.md).
