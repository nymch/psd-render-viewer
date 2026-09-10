# {Feature name}

<!--
A spec, written before implementation starts. The filename is `a-short-english-title.md` (kebab-case).
A section that cannot be written is a section not yet decided. Move it to open questions.
Delete a section that stays empty. Filling in the template is not the point.
-->

## Overview

{What is being built, in one or two sentences. Written so that this section alone is enough to explain it to someone.}

## Background

{Why it is being built. What the trouble is today.}

## Goals

- {What becomes possible once this is finished}

## Out of scope

- {What is deliberately not being done, stated so that "I thought this was included" cannot happen later}

## Specification

### Interaction and screen

{What the user does and what happens. The elements on screen and the actions on them. If a diagram helps, plain ASCII or mermaid.}

### Data

{Input — which parts of the PSD get read — and the state the app holds, down to where it lives: a Jotai atom, a ref, or a Server Component.}

### Failure cases

{Unreadable files, unsupported layer types, size limits. What gets shown, and what gets given up on.}

## Technical design

{How it gets implemented. The files touched and the flow of data. What happens during parsing, compositing, and rendering, and whether any of it moves to a worker.}

## Alternatives considered

{Other ways of building it, with the reason each was rejected. A heavy design decision gets split out into an ADR ([../adr/](../adr/)).}

## Open questions

- {What could not be settled. State what gets decided during implementation}

## How to verify

{How completion gets checked. Which PSD to try, and what to look for in the result.}
