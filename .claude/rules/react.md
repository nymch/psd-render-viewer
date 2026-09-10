---
paths:
  - "app/**/*.tsx"
  - "app/**/*.ts"
  - "components/**/*.tsx"
  - "components/**/*.ts"
  - "hooks/**/*.ts"
  - "atoms/**/*.ts"
  - "lib/**/*.ts"
---

# React, hooks, and Canvas rendering conventions

How React components, hooks, and Canvas rendering are written here. Language-level TypeScript conventions are in [typescript.md](typescript.md); prose and comment style in [documentation-style.md](documentation-style.md).

This repository has no `src/`; directories sit at the root.

| Directory | Contents |
| --- | --- |
| `app/` | Routing only (`page.tsx`, `layout.tsx`, `route.ts`). No components |
| `components/` | React components, in per-feature subdirectories (below) |
| `hooks/` | Custom hooks |
| `atoms/` | Jotai atoms |
| `lib/` | Non-React code: fetchers, PSD parsing, zod schemas |

## Where components go

Components live under `components/` in a **subdirectory per feature**.

```
components/
├─ ui/                    ← generic parts that know nothing about PSD
│  ├─ Button.tsx
│  └─ Slider.tsx
├─ layers/                ← a feature
│  ├─ LayerPanel.tsx
│  └─ LayerRow.tsx
├─ viewer/
│  └─ CanvasViewport.tsx
└─ file-import/
   └─ DropZone.tsx
```

### Feature directories

- Size a feature as **a coherent role on screen** (`viewer`, `layers`, `toolbar`, `file-import`). Do not create a directory for a single component
- Directory names are kebab-case. Plural when the feature handles several of something (`layers`), singular for a single role (`viewer`)
- File names are PascalCase and match the component name

### `ui/` versus a feature directory

The test is **whether it knows about the PSD domain**, not how many places use it.

- **`ui/`** — generic parts that know nothing about PSD (buttons, sliders, dialogs). Things that would still make sense in another project
- **Feature directory** — anything PSD-specific

**When a PSD-specific component starts being used by other features, leave it with its owning feature and import it from there.** A "move it once two places use it" policy makes files migrate every time usage changes, and turns the shared directory into a pile of unrelated parts.

### No components in `app/`

`app/` holds only `page.tsx`, `layout.tsx`, and `route.ts`. Components that look page-specific still go in `components/`. Allowing `app/<route>/_components/` means deciding "is this page-specific?" every time, and moving the file the moment it is shared.

### No barrel files

Do not re-export through `index.ts`. Import the file directly.

```typescript
// Good
import {LayerPanel} from "@/components/layers/LayerPanel";

// Bad — through a barrel
import {LayerPanel} from "@/components/layers";
```

Barrels defeat tree shaking, invite circular imports, and need updating every time a file is added.

One component per file, as a rule. A small subcomponent used only within that file may live alongside it.

### Hooks and atoms are not split by feature

`hooks/` and `atoms/` stay organized by kind (`hooks/psdHooks.ts`, `atoms/layers.ts`). Only `components/` is split by feature.

## Components

- Write function components. Define props with `type`.
- Default to Server Components. Fetch data on the server side wherever possible.
- Components that depend on browser APIs or state get `"use client"` at the top of the file.
- Put `"use client"` on the leaf components that actually use state, event handlers, or browser APIs, pushing the boundary down away from `page` and `layout`. The higher the boundary sits, the more server-renderable markup ends up in the client bundle, hurting bundle size and first paint.
- Load libraries that touch `window` or `document` at module top level through `next/dynamic` with `ssr: false`.
- Use `next/image` for images, as `eslint-config-next/core-web-vitals` requires. PSD pixel data drawn to a canvas is not covered by this.

## Hooks

### Placement and naming

- Custom hooks go in `hooks/`, grouped by domain (`psdHooks.ts`, `canvasHooks.ts`). Do not put them in feature directories.
- Name a hook `use` + resource (+ action): `usePsdDocument`, `useLayerList`. Extract reusable logic into a custom hook.
- Follow the Rules of Hooks. Call hooks only at the top level of a component or another hook — never after a conditional, a loop, or an early return. Do not leave `eslint-plugin-react-hooks` warnings in place or silence them with `eslint-disable`.

### useEffect

- Use `useEffect` only to synchronize with an external system (DOM, canvas, timers, subscriptions). Do not mirror a value derivable from props or state with `useState` + `useEffect`. Compute it during render, or use `useMemo`.
- Return a cleanup function for anything that needs tearing down: subscriptions, event listeners, timers, `requestAnimationFrame`, observers. An effect that only notifies needs no cleanup.
- Write the dependency array accurately. Depend on the source value, not something derived from it.

### useCallback and useMemo

- Memoize handlers passed to children, and any function whose identity should be stable, with `useCallback`.
- Compute derived values such as a formatted layer list with `useMemo`.

## Canvas and PSD rendering

The core of this project: parse a PSD with `ag-psd` and draw it with Canvas 2D. The choice of parser is recorded in [ADR-0001](../../docs/adr/0001-psd-parser.md); the library's real behavior is documented in [docs/ag-psd-notes.md](../../docs/ag-psd-notes.md).

- `ag-psd` parsing depends on browser APIs, so keep it inside `"use client"`. Put the parsing itself in `lib/`, separate from components. Pass `useImageData: true`, `skipCompositeImageData: true`, and `skipThumbnail: true` to `readPsd`.
- Parsing and compositing run in a Web Worker so the main thread is never blocked. See [ADR-0004](../../docs/adr/0004-worker-offloading.md) for the design: a fresh worker per load, terminated on completion, failure, or replacement.
- **Do not transfer an `ImageBitmap` out of the worker.** In Chrome its backing store is tied to the worker's lifetime, so terminating the worker empties a bitmap that was already transferred — the receiver gets correct dimensions and no pixels. Transfer an RGBA `ArrayBuffer` and `putImageData` it on the main thread. `transferControlToOffscreen` is also unusable here, since a canvas element can only be transferred once and the worker is disposable.
- Reference the canvas element through `useRef<HTMLCanvasElement>` and draw inside `useEffect`, as synchronization with an external system. Never draw during render.
- Do not redraw on every state change. Coalesce into one frame with `requestAnimationFrame`, and `cancelAnimationFrame` in cleanup. Without this, dragging something like an opacity slider queues a draw per change and the interaction goes sluggish.
- Release resources in cleanup: `bitmap.close()`, `URL.revokeObjectURL(url)`, and anything holding an `OffscreenCanvas`. A single PSD can hold hundreds of megabytes of pixel data, so a leak turns straight into memory exhaustion.
- Do not put an `ImageBitmap` or a large `ImageData` in React state. Keep them in a ref, and let state hold only rendering parameters — visibility, opacity, transform, selection. Pixel data in state means dragging a huge object through every comparison and re-render.

## Data fetching (SWR)

- Client-side fetching goes through SWR. Do not hand-roll it with `useState` and `useEffect`.
- Define fetchers in `lib/` and use them from hooks. Validate responses with a zod schema and derive the type with `z.infer`.
- Fetchers throw on non-2xx responses. Without a throw, SWR's `error` never populates.
- Use an array for a compound cache key that includes parameters (`["psd", fileId]`), and a string for a fixed resource with none (`"document-list"`). Do not build keys by concatenation (`` `psd-${fileId}` ``) — the separator can appear inside an id and collide.
- **Watch key uniqueness especially closely.** Reusing a key across different fetches makes caches collide, mixing one response into the other and triggering unintended revalidation. Every value that distinguishes a resource belongs in the key.
- Wrap writes in `useSWRMutation` and use `trigger`, `isMutating`, and `error`. Do not track loading and error state by hand with `useState`. A mutation sharing its key with the corresponding GET revalidates automatically; otherwise call the matching `mutate` from `onSuccess`.

## Global state (Jotai)

- Global state uses Jotai. Define atoms in `atoms/`, split by domain (`layers.ts`, `viewport.ts`).
- Use `useAtomValue` to read, `useSetAtom` to write, `useAtom` for both. A write-only component using `useAtom` re-renders needlessly on every update.
- Split per-layer state — visibility, opacity, ordering — into per-layer atoms with `atomFamily`. Moving one slider then re-renders only that layer's controls.
- Make values computable from other atoms derived atoms. Do not store the same value in two places.

## Forms (React Hook Form)

- Use React Hook Form for **forms with a submit**: an export settings dialog, renaming a layer, a file-loading form. Combine it with `zodResolver`, taking schemas from `lib/schemas/`.
- Distribute context to nested children with `FormProvider` and `useFormContext`. Use `useFieldArray` for array fields.
- **Do not use React Hook Form for immediate-effect controls such as toggling layer visibility, opacity, or reordering.** That state feeds canvas rendering directly. Holding it in RHF duplicates it across form state and render state, and requires a `useWatch` to catch every change and sync it — which is exactly the "do not mirror derivable state with `useEffect`" problem. Put this state in Jotai atoms.
