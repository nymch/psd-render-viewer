# ADR (Architecture Decision Record)

Where a technical decision and its reasoning are kept. Use [template.md](template.md).

The template is based on the minimal variant of [MADR 4.0.0](https://adr.github.io/madr/). MADR is dual-licensed under MIT and CC0-1.0; taking CC0 allows use and modification without an attribution requirement.

## When to write one

When a judgment call is made that you will later want to remember the reason for. Roughly:

- Choosing a library or an approach (the PSD parser, state management, how rendering works)
- Deciding a structure that is expensive to change afterwards (splitting work into a worker, how data is held)
- Picking an implementation that looks like the long way round

What does not need one:

- Implementation detail that can be read off the code
- A small choice that can be undone at any time

## How to write one

- The filename is `0001-a-short-english-title.md` — a serial number plus kebab-case. The number is the highest existing one plus 1
- One decision per file. Split them if several judgment calls are mixed together
- `status` goes `proposed` → `accepted`. If a decision is later overturned, write `superseded by ADR-0007` and **do not delete the original**. That it was overturned is itself part of the record
- **Always write down the options that were not chosen, and why.** Most of an ADR's value is there. The conclusion on its own can be read off the code
