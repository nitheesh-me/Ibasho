---
name: ibasho
description: Explore a home with Ibasho, the local-first digital twin. Use whenever a task involves a home's energy, heat loss, bills, carbon, retrofit options (loft, walls, glazing, heat pump, solar), why an option is missing, the evidence behind a number, or the open Ibasho app (Settings > Agent link).
---
<!-- installed-by:ibasho -->

# Ibasho home explorer

Ibasho is a digital twin of a home. A deterministic engine simulates it, a search finds retrofit futures, a checker re-derives the bookkeeping, and every number carries evidence. You explore it the way the owner does: with the same typed operations as their hands, never more.

There are two ways in:

- **MCP tools** (`ibasho_*`), preferred. Headless tools work on fixtures and saved homes without the app. Live tools drive the open app.
- **The bridge over HTTP**, through the `iq` helper. Use it only when the MCP tools are not loaded in this session.

## Ground rules

These are not style. The app enforces them, and breaking one gets your output refused.

1. **Every number you state comes from evidence.** Tools return numbers only inside evidence views `{ ev, quantity, value, unit, seal }`. Quote the value with its `ev` id, for example "about 15,000 kWh of gas a year (ev_3f2a)". Never do arithmetic on values: no sums, differences, percentages or "twice as much". If you need a difference, ask the engine for it (`ibasho_what_if` returns `acct.saving.*` deltas). If the engine did not compute it, do not say it.
2. **Change a home only with typed ops.** `ScenarioOp`s are the only edit path (schema at `ibasho://schema/ops`). There is no way to run code in the app, and you should not look for one.
3. **Memory is the person's words, not yours.** Record a preference only when they said it, with `ibasho_memory_remember` and their quote. Ask before `ibasho_memory_forget`.
4. **In the app, write slots, not digits.** `ibasho_live_say` refuses any digit, `%` or number word outside a slot. Write `[[e:ev_3f2a]]` (or `[[e:ev_3f2a|approx]]`, `[[e:ev_3f2a|abs]]`) for a number and `[[m:loft]]` for a measure. The app fills the value from evidence and runs its narrator validator.
5. **Seals mean something.** Checked: the certificate re-derives the number. Modelled: computed by the engine, not independently checked. Unverified: no check ran yet. Cracked: a check failed; say so plainly. Proved seals sit on claims ("nothing better is hidden"), never on numbers.
6. **Privacy.** The person turned on Agent link knowing that what you read may go to your model provider. Read what the task needs, not everything. Every live call is listed in the app's outbound ledger.

## Headless workflow

1. `ibasho_list_homes`: fixtures (GH1 is a 1905 London mid-terrace in a conservation area), saved `.ibasho` homes, and live sessions.
2. `ibasho_get_home { homeId }`: form, elements, systems, designations, recorded checks, every input as known, estimated or unknown with provenance, and the **measure catalogue** (measure id, group, option ids). Numeric inputs are deliberately not shown here.
3. `ibasho_simulate { homeId, modes?, quantities? }`: the home as it is. Modes: `standard` (default, used for the score), `rating` (EPC-like), `your-home` (the household as described). Returns a `resultHash` and evidence views.
4. `ibasho_what_if { homeId, ops }`: apply ops to a copy, simulate before and after. Returns `accepted`, `rejected` (with reasons), before and after evidence, and `deltas` when the engine emits savings. Never changes the saved home.
5. `ibasho_search_futures { homeId, target?, budgetGBP?, horizonYears? }`: the full search. Returns the three picks (`leastUpfront`, `bestReturn`, `lowestRunningCarbon`), the front with evidence, `needsCheck`, `whyNot` rows (status, rule ids, the package that dominates it), and the certificate hash. It reads the memory log, so ruled-out measures never come back.
6. `ibasho_why_not { resultHash, measure }`: why a measure is absent: ruled out by the person, blocked by a rule, needs a check (and which rule asks for it), misses the target, or dominated (and by which package).
7. `ibasho_evidence { evidenceId, resultHash? }`: one node: value, formula id (SPEC or brief), input ev ids with roles, sources, grade, seal. Follow inputs to pull the red thread.
8. `ibasho_verify { resultHash }`: check the certificate with the TypeScript mirror of the Lean checker. Report failed checks plainly. If no checker is available it says so; never call a number Checked on your own.
9. `ibasho_compare`: two homes (`homes: [a, b]`) or two packages from one search (`resultHash`, `packages: [a, b]`), side by side. Quote both sides; do not subtract.
10. Memory: `ibasho_memory_list`, `ibasho_memory_remember`, `ibasho_memory_forget`.

Resources: `ibasho://docs/vision`, `ibasho://docs/spec`, `ibasho://schema/twin`, `ibasho://schema/ops`, `ibasho://home/{id}` (the stored inputs, not results), `ibasho://cert/{hash}`. Prompts: `explore-my-home`, `compare-futures`, `audit-the-numbers`.

## Ops

Build ops from the catalogue in `ibasho_get_home`. Ids are kebab-case and frozen per pack.

```json
[
  { "op": "addMeasure", "measureId": "loft", "params": { "option": "loft-300" } },
  { "op": "addMeasure", "measureId": "ashp", "params": { "option": "heat-ashp-radiators-plus" } },
  { "op": "addMeasure", "measureId": "draught" },
  { "op": "removeMeasure", "measureId": "pv" },
  { "op": "setParam", "path": "occupancy.setpointC", "value": 19 },
  { "op": "setBudget", "capGBP": 12000 },
  { "op": "setHorizon", "years": 20 }
]
```

- `addMeasure` needs `params.option` when the measure has more than one option. One option per group: a second wall option replaces the first (`wall-ewi` and `wall-iwi` share the `wall` group).
- Sub-measures (`cylinder`, `hob-induction`) ride with a heat pump.
- `setParam` takes only owner-editable paths (`occupancy.setpointC`, `occupancy.heatingHours`, `occupancy.people`, `ventilation.draughtProofedFrac`, `ventilation.chimneysOpen`, `ventilation.chimneysBlocked`, `ventilation.extractFans`). Anything else is rejected with the list.
- `compare` and `explain` are read-only: use `ibasho_compare` and `ibasho_evidence`. `rejectMeasure` is memory: use `ibasho_memory_remember` with the person's quote.
- The numbers in ops (a set point, a budget) are the person's inputs, not results. You may repeat them as what they asked for.

## Live app

Live tools need the companion running and the app open with **Settings > Agent link** on and paired.

- `ibasho_live_sessions`: open tabs. When none is paired it returns a pairing code such as `K7QM-2XPA`. Ask the person to type it in Settings > Agent link. Codes are single use and expire; never guess one.
- `ibasho_live_state`: home, route, chapter, layer, selection, current result hash. Prefer this to a screenshot for facts.
- `ibasho_live_apply { ops, label? }`: apply ops in the app. The change carries an "agent" mark and is undoable. Tell the person what you changed and that they can undo it.
- `ibasho_live_view { layer?, camera?, time?, chapter?, focus? }`: show something. Camera presets: `street`, `cutaway`, `plan`, `loft`, `garden`, `section`.
- `ibasho_live_thread { evidenceId }`: draw the red thread from a number to its inputs on screen.
- `ibasho_live_screenshot`: a PNG of the stage, for you to look at when placement is uncertain or the person asks.
- `ibasho_live_say { section, text }`: put slotted narration in the narrator strip (sections: `overview`, `package`, `tradeoff`, `answer`, `chapter`, `welcome-back`, `why-not`).

With more than one tab open, pass `sessionId` from `ibasho_live_sessions`.

## The bridge without MCP: `iq`

If the MCP tools are not loaded, use the helper. Its path is in your context when the subagent hook injected it; otherwise it is `~/.config/ibasho/bin/iq.mjs` after `pnpm agent:install`. It re-reads the port and the per-launch token from `~/.config/ibasho/server.json` on every call, so you never handle the token.

**Each Bash call runs in a fresh shell; exported variables do not survive.** Do not export the token and reuse it. Use `iq`, or the literal values injected into your context.

```bash
node ~/.config/ibasho/bin/iq.mjs GET  /agent/sessions
node ~/.config/ibasho/bin/iq.mjs POST /agent/call '{"method":"state","params":{}}'
node ~/.config/ibasho/bin/iq.mjs POST /agent/call '{"method":"apply","params":{"ops":[{"op":"addMeasure","measureId":"loft","params":{"option":"loft-300"}}]}}'
node ~/.config/ibasho/bin/iq.mjs POST /agent/call '{"method":"say","params":{"section":"answer","text":"Topping up [[m:loft]] saves [[e:ev_3f2a|approx]] a year."}}'
```

Raw HTTP, when you must: the bridge is at `http://127.0.0.1:<port>/agent-link` (port in `server.json`). `GET /health` needs no token; every `/agent/*` route needs `Authorization: Bearer <token>`. Always use `127.0.0.1`, never `localhost`. A `server.json` whose `pid` is not alive is stale: the app quit uncleanly and is not running.

## Errors and recovery

| Error | Meaning | Do |
|---|---|---|
| `engine-unavailable` | The engine package is not built into this checkout yet | Say so. Use `ibasho_get_home` and memory; do not invent numbers |
| `app-not-running` | No companion, or a stale `server.json` | Work headless, or ask the person to start the app and turn on Agent link |
| `live-no-session` | Companion up, no tab paired | Give the pairing code from `ibasho_live_sessions` |
| `live-ambiguous-session` | Several tabs | Pass `sessionId` |
| `live-bad-request` | Params or ops outside the schema | Read the message, fix the op, retry once |
| `live-timeout` | The tab did not answer | Check `ibasho_live_sessions`; the tab may have closed. Do not retry blindly |
| `live-closed` | The tab closed or reloaded | Re-read sessions; never assume another tab is the same home |
| unknown result hash | Results live in memory for this MCP session | Run the simulate or search again |

If a tab you were working in disappears, do not switch to another tab and keep editing. Check its `homeId` first, and ask if it is not the home you started with.

## Never

- Never edit `.ibasho` files, the app's IndexedDB, `server.json` or anything under `~/.config/ibasho` by hand.
- Never invent measure or option ids; take them from the catalogue.
- Never present a twin input (a footprint, a U-value the owner stated) as a computed result, and never present an estimate as a fact: check the field's state and the evidence grade.
- Never claim a seal the tools did not report.

## Reporting

Keep it short and concrete: the home id, what you ran (result hash), the two or three numbers that matter with their ev ids and seals, and what is unknown or needs a check. In the app, one or two slotted sentences beat a paragraph.
