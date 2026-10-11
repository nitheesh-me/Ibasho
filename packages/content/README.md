# @ibasho/content

The words: v3 studio microcopy, building type copy, glossary, voice guide and checkers, landing chapters, "What we prove" intro copy and the UK home measure guidance.

- **Owner:** WP-09 (Content and landing).
- **Layer:** L0 data consumed by apps (imports `@ibasho/core` only). See ARCHITECTURE 3.

## Public API (`src/index.ts`)

| Export | What |
|---|---|
| `MEASURE_GUIDANCE`, `guidanceFor(id)`, `GUIDED_MEASURE_IDS` | Disruption (typical days, rooms out of use, can you stay in, mess, note) and next step (installer type, accreditations, why, exactly three questions) for every measure id in `packs/home-uk/src/ids.ts`, with `Provenance` (grade `estimate`). SPEC 5.9, AC-P2. |
| `ASSESSMENT_GUIDANCE` | The same for `assess-moisture` and `assess-pas2035`. |
| `ACCREDITATIONS` | TrustMark, PAS 2035, MCS, RECC or HIES, Gas Safe, competent person schemes, FENSA or CERTASS, NIA: plain meaning and where to check. |
| `GLOSSARY`, `termOf`, `definitionOf` | About 80 terms with plain definitions, including v3 terms (EUI, end uses, sDA, ASE, sun hours, ECBC, ECSBC, ENS, Part L, Future Homes Standard, LEED points, pre-check, Preview, variant). |
| `segments`, `plainText`, `markedTerms` | Glossary marks in copy: `[[g:u-value]]` or `[[g:u-value\|U-values]]`. Render a `term` segment with a dotted underline and its definition (UX 15). |
| `VOICE`, `checkVoice`, `BANNED` | The voice guide as data, and a checker (banned phrases such as "guaranteed", "save up to", "compliant" and certification claims, exclamation marks, dashes, sentences over 28 words). |
| `checkCustomerCopy`, `DEV_ARTEFACTS` | `checkVoice` plus development artefacts (work package and milestone ids, "placeholder", "stand in", "fixture", "tier", spec references, file names). Apps can run it over their own strings. |
| `STAGE_COPY`, `STAGE_STATUS_WORD`, `TIER_WORD`, `APPLICABILITY_COPY`, `PRECHECK_WORD`, `GAP_COPY`, `RATING_COPY`, `OBJECTIVE_COPY`, `GOAL_PRESET_COPY`, `STUDIO_COPY` | v3 studio microcopy keyed by the core unions (stages, statuses, applicability, goal gaps, objectives, goal presets), plus Preview, stale, cancelled, empty and phone lines. Never "compliant". |
| `BUILDING_TYPE_COPY`, `typeLabel`, `countOf`, `roomLabel` | Label, singular and plural, blurb, who is inside, what to watch and usual goals for each of the eight types; "Library, IIIT Library" style room labels (function first). |
| `LANDING_CHAPTERS`, `visibleChapters(presence)`, `LANDING_AUDIENCES`, `LANDING_INVITATION`, `LANDING_META`, `STUDIO_LINKS` | The nine landing chapters with `requires`, the five audiences, the closing invitation. |
| `PluginPresence`, `presenceOf(registry)`, `presenceFromList(plugins, stages)`, `parseRequirement`, `needsPreview` | A requirement is a plugin id, `kind:<PluginKind>` or `stage:<StageId>`. Unknown kinds and stages throw. `needsPreview` says a chapter rests on a Preview stage. |
| `PROOFS_INTRO` | Intro, seal meanings with "Not proved" lines, group headings and the boundary list for `/app/proofs`. The theorem list itself comes from `seals.json`. |
| `collectCopy()` | Every user-facing string with a path, for audits. |

Spec paths `packages/content/measures/` and `landing/chapters.ts` live under `src/` here.

Typical days are for a two or three bedroom home, from consumer guidance (Energy Saving Trust, Historic England, MCS, TrustMark). They are not quotes. If the app shows them, show them as typical, with the provenance.

## Tests

`pnpm --filter @ibasho/content test`: completeness against `ids.ts` (AC-P2), every glossary mark resolves (I5), every string passes `checkCustomerCopy`, studio copy covers every core union, chapter `requires` parse and hide chapters (I4), stage presence and Preview marks, `presenceOf` against a live core registry.

## Status

Done: v3 studio and landing copy (en-GB) on top of the UK home guidance. Not yet: India measure guidance, en-IN number wording, translations.
