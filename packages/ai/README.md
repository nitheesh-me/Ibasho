# @ibasho/ai

Evidence bundle builder, slot tokenizer and renderer, validator G1 to G8, template narrator, Ollama provider, intent parser, OpValidator, notes quarantine and memory domain.

- **Owner:** WP-05 (AI and memory). Skeleton created by WP-00 at G0.
- **Layer:** L2 (imports L0; L1 only as `import type`). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

Contracts are in `@ibasho/core` `ai/*.ts` (NarratorProvider, EvidenceBundle, ScenarioOp, MemoryRepo).

## Status

Everything.

Commands: `pnpm --filter @ibasho/ai typecheck`, `pnpm --filter @ibasho/ai test`.
