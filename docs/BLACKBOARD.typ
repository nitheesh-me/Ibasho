// Ibasho agent blackboard. Shared coordination surface for all agents.
// Compile (optional):  typst compile docs/BLACKBOARD.typ deliverables/BLACKBOARD.pdf
//
// PROTOCOL (read before writing)
// 1. Append only. Never delete or rewrite another agent's entry; mark it resolved instead.
// 2. One entry per fact. Use the #entry helper below. Newest at the bottom of each section.
// 3. Never wait, sleep or poll for another agent. If you are blocked, add a BLOCKER entry,
//    finish your work as far as possible, and return. The orchestrator will resume you.
// 4. Claim directories before editing them (CLAIMS). Do not edit directories claimed by others.
// 5. Interface changes go in INTERFACES with the file path of the source of truth.
// 6. No em dashes or en dashes as punctuation.

#let entry(who, kind, body, status: "open") = block(
  width: 100%, inset: 6pt, radius: 3pt, stroke: 0.5pt + luma(200),
)[
  #text(8pt, weight: "bold")[#who] #h(4pt) #text(8pt, fill: luma(110))[#kind · #status] \
  #body
]

#set document(title: "Ibasho · Agent Blackboard")
#set text(font: "Inter", size: 9.5pt)
#set page(paper: "a4", margin: 1.6cm)

= Ibasho agent blackboard

== Claims
// #entry("builder:engine-physics", "claim")[packages/engine/src/physics/**]
#entry("orchestrator", "claim", status: "active")[`docs/research/**`, `docs/*.md`, `docs/review/**`: research and director workflow (phase 1).]

== Interfaces
// #entry("architect", "interface")[`Measure` plugin contract lives in packages/core/src/plugins/measure.ts]

== Decisions
#entry("orchestrator", "decision", status: "final")[Stack: pnpm monorepo, Vite + React + TS + R3F, IndexedDB, Lean 4 lake package, Vitest + Playwright. Local-first, offline-first.]
#entry("orchestrator", "decision", status: "final")[LLM narrator is a plugin. Local first: templated fallback always on, then WebLLM, Ollama, Claude.]
#entry("orchestrator", "decision", status: "final")[Hobby project. Asset and library licensing is not a constraint (personal use).]
#entry("director", "decision", status: "final")[Definitive plan: `docs/VISION.md`, `docs/SPEC.md` (director rulings R1 to R18 in section 0), `docs/ARCHITECTURE.md` (contracts and exact dependency versions), `docs/DESIGN_SYSTEM.md` (Andon), `docs/BUILD_PLAN.md` (WP-00 to WP-11, disjoint ownership, gates G0 and M-A to M-H).]
#entry("director", "decision", status: "final")[Hero home GH1: 1905 London mid-terrace in a conservation area. Score weights F 1/5, C 1/5, E 3/20, A 3/20, H 1/10, R 1/10, T 1/10; score always from Standard mode. Futures Gentle, Wise, Bold per SPEC R7 and R8.]
#entry("director", "decision", status: "final")[TypeScript 6.0.3 (not 7), Biome (no ESLint), no Theatre.js, no `@react-three/a11y`. Lean v4.34.0 core only.]

#entry("director", "decision", status: "final")[Plan v2 after red-team review. Rulings: `docs/review/DECISIONS.md`. Supersedes the earlier v1 entries on futures names (now Least upfront, Best return, Lowest running carbon), the score display (number plus four groups, no letter; letters only for the estimated EPC band), and the Lean role (owns spec and predicates; pack data travels in certificates). New: three run modes (rating, standard, your-home), factorised search (GH1: 432 heavy, 10,800 packages), fixed-point bookkeeping, explicit psi junctions, hourly 5R1C, Kleene rules in Lean, M-0 walking skeleton, per-owner pack and fixture folders (`docs/BUILD_PLAN.md` section 2). T1 local LLM: Ollama.]

== Blockers
// #entry("builder:scene", "blocker")[Needs `HomeTwin` geometry type from packages/core. Returned early.]

== Handoffs
// #entry("builder:engine-physics", "handoff")[Physics done; optimiser can consume `simulate(twin)`; see packages/engine/README.md]
