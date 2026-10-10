# Ibasho: guide for agents

Ibasho is a local-first digital twin of a home: a deterministic engine, retrofit search, Lean-checked bookkeeping and a grounded narrator. Read the docs before you code.

## Sources of truth

| Doc | What |
|---|---|
| `docs/BUILD_PLAN.md` | Your work package (WP), ownership (section 2), order (section 3), gates |
| `docs/ARCHITECTURE.md` | Layout, layering, contracts, dependency versions |
| `docs/SPEC.md` | Rulings R1 to R24, quantities, acceptance criteria |
| `docs/DESIGN_SYSTEM.md` | Andon tokens and components |
| `docs/review/DECISIONS.md` | Red-team rulings that override older text |
| `docs/research/*.md` | Briefs cited as BP, SF, RP, LV, AM, SV, UX |

## Layout

```
packages/  core (contracts, kernel)  dmath  spec-gen (Lean generated)  engine  verify  ai  store
           ui  scene  content  agent-bridge  fixtures (per-owner folders, no index)
packs/     climate  home-uk  home-in  money-uk  money-in  rules-uk  rules-in   (./engine and ./ui exports)
apps/      web (/app/)  landing (/)  companion (127.0.0.1:7357)  mcp
tools/     lint  verify  assets  agent-install          tests/  smoke contracts m0 e2e ...
proofs/    Lean 4 (WP-04)                                integrations/claude-code (WP-12)
```

Every package README names its owner WP, layer and public API.

## Commands

Node 26.1.0, pnpm 11.1.1. Run from the repo root.

| Command | Does |
|---|---|
| `pnpm install --frozen-lockfile` | Install (exact versions, strict peers) |
| `pnpm lint` | Biome, dependency-cruiser (layers), knip, `tools/lint` (no-dash, no-math, legend, ownership) |
| `pnpm -r typecheck` | `tsc` in every package |
| `pnpm test` | Vitest in every package (turbo) |
| `pnpm build` | Build the apps |
| `pnpm smoke` | Playwright: both apps boot (Chromium, Firefox) |
| `pnpm contracts` / `pnpm m0` | Cross-WP contract tests / the M-0 slice (WP-10 fills them) |
| `pnpm --filter @ibasho/<pkg> test` | One package |

## Rules

- **Edit only paths your WP owns** (BUILD_PLAN 2, encoded in `tools/lint/ownership.ts`). Read anything. Need a change elsewhere? Write an INTERFACES entry on the blackboard and build against a local adapter.
- **Contracts live in `@ibasho/core`.** Do not redefine them. Untrusted input goes through `@ibasho/core/schemas`.
- **Layers are enforced** (ARCH 3, `.dependency-cruiser.cjs`). Cross-layer type imports use `import type`. Every workspace import must be a declared dependency.
- **Engine determinism.** No `Math.*` beyond exact ops in `packages/engine` or `packs/*/src/engine`; use `@ibasho/dmath` and the core PRNG. No `**` on floats. Money and energy are bigint fixed point after `quantise`.
- **No default exports** except an `IbashoModule` in `src/engine/module.ts` or `src/ui/module.ts`.
- **Real code only.** Mark intentional stubs as `SKELETON` or `PLACEHOLDER` in code and README.
- **No em dashes or en dashes** anywhere: copy, docs, comments, code. `pnpm lint` fails on them.
- **Do not commit.** The orchestrator commits at gates. Never run `git stash`, `reset` or `checkout` on others' work.

## Reuse and acknowledge

Stand on the shoulders of giants. Prefer proven open-source libraries, algorithms, shaders, datasets and tools over writing from scratch. Licensing is not a constraint here (personal use), but credit is required: vendored files keep a header with source URL, author and licence, and every borrowed library, snippet, dataset or asset gets a line in `ACKNOWLEDGEMENTS.md`. During an install freeze, request new npm packages on the blackboard (INTERFACES) instead of installing.

## Blackboard protocol (`docs/BLACKBOARD.typ`)

- Append only. Use `#entry(who, kind, status: ...)[body]` in the right section: Claims, Interfaces, Decisions, Blockers, Handoffs.
- Add a CLAIM when you start and a HANDOFF when you finish (what exists, how to use it, what is stubbed).
- Insert with one read-modify-write (a short script that inserts before the next `== ` heading), so parallel agents do not clobber each other.
- Check it compiles: `typst compile docs/BLACKBOARD.typ deliverables/BLACKBOARD.pdf` (snap typst cannot write to `/tmp`).
- When work lands, add a row to the Features table in `docs/STATUS.typ` and cite sources in `docs/refs.yml`.

## Checkpoints

An agent session can end at any time; files persist, context does not. So:

- Keep `docs/progress/<WP>.md` (for example `docs/progress/WP-07.md`; local working state, git-ignored). Sections: **Done**, **Next** (ordered, concrete), **Decisions**, **Gotchas**, **Test status** (last command and result).
- **Read it first** when you start. If it is missing but your owned paths have work in them, reconstruct it from the files before coding.
- **Update it after every milestone** (a module working, a test suite green, a design decision), at least every 15 tool calls. Keep it under 80 lines; rewrite rather than append.
- Write files whole and atomically where you can (write to a temp name, then rename), so an interrupted session never leaves a half-written source file.

Machine-specific rules, if any, live in `CLAUDE.local.md` (git-ignored). Follow them when present.

## Never wait

Never sleep, poll, tail logs or wait for another agent or a long process. If a dependency is missing, write a BLOCKER entry, build against a fixture or adapter, finish what you can and return. The orchestrator resumes you.

## Done means

Your WP acceptance tests pass, `pnpm lint`, `pnpm -r typecheck`, `pnpm test` and `pnpm contracts` are green, your README is current, and STATUS and the blackboard are updated. Report exact commands and results.
