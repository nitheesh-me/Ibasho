# @ibasho/ai

Grounded local-first narration, typed ops and the memory domain (AM, SPEC 10, R10, R11).

- **Owner:** WP-05 (AI and memory).
- **Layer:** L2 (imports L0 `@ibasho/core` only, plus `zod` and the `ollama` browser client). Engine evidence enters as data (`storyFromEngine`, generated fixture), never as an import.

## Public API (`src/index.ts`)

| Area | Exports |
|---|---|
| Evidence | `buildBundle`, `buildStory` (synthetic stories), `storyFromEngine` (real engine graph) |
| Grounding | `tokenize`, `renderText`, `validateSection` (G1 to G8), `groundDraft` (one structured repair, then template), `renderTemplate` |
| Narrator | `narrateSection`, `narrateTemplate` (overview, 5 chapters, package, trade-off, answer, welcome back, why-not; en-GB, seeded variants) |
| Providers | `NarratorRouter` (locality badges, AC-N3 fallback), `OutboundLedger`, `OllamaProvider`, `TemplateProvider`, `narrationPayload` |
| Ops | `parseIntent` (offline), `validateOps` (OpValidator), `opPlanJsonSchema` |
| Notes | `extractFacts` (rules based), `sanitiseFacts`, `injectionFlags` |
| Memory | `InMemoryMemoryRepo` (reference `MemoryRepo`), `preferencesOf`, `seedsOf`, `digestOf`, `searchMemory`, `offerable`, `purgeCompost` |

Contracts live in `@ibasho/core` `ai/*.ts`. `packages/store` (WP-08) implements `MemoryRepo` with the same views.

## Acceptance (BUILD_PLAN WP-05)

| | Test |
|---|---|
| E1 | `test/ac-n1.test.ts` (2 bundles x 9 providers x 3 voices), `test/quarantine.test.ts` (AC-N2, 60 notes), `test/router.test.ts` (AC-N3) |
| E2 | `test/memory.test.ts` (AC-M1 500 sessions against an oracle, AC-M2, AC-M3) |
| E3 | `test/intent.test.ts` (120 utterances, at least 70% exact) |
| E4 | `test/template.test.ts`, `test/engine-story.test.ts`; `renderGh1` in `test/helpers.ts` is DOM free for the browser matrix (WP-10) |
| E5 | `test/validator.test.ts` |
| E6 | `test/ollama.test.ts` |
| E7 | `test/quarantine.test.ts` payload inspection (narrate, repair, plan, extract) |

## Stubs

- `measures.ts` is a LOCAL ADAPTER for measure names until the pack catalogue reaches ai through the narrator registry.
- WebLLM, Claude and Chrome AI providers are later milestones (M-F, M-I).

Commands: `pnpm --filter @ibasho/ai typecheck`, `pnpm --filter @ibasho/ai test`, `pnpm --filter @ibasho/ai gen:engine-graph` (`-- --check` fails on drift).
