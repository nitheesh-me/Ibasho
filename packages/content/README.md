# @ibasho/content

The words: measure guidance, glossary, voice guide, landing chapters and "What we prove" intro copy.

- **Owner:** WP-09 (Content and landing).
- **Layer:** L0 data consumed by apps (imports `@ibasho/core` only). See ARCHITECTURE 3.

## Public API (`src/index.ts`)

| Export | What |
|---|---|
| `MEASURE_GUIDANCE`, `guidanceFor(id)`, `GUIDED_MEASURE_IDS` | Disruption (typical days, rooms out of use, can you stay in, mess, note) and next step (installer type, accreditations, why, exactly three questions) for every measure id in `packs/home-uk/src/ids.ts`, with `Provenance` (grade `estimate`). SPEC 5.9, AC-P2. |
| `ASSESSMENT_GUIDANCE` | The same for `assess-moisture` and `assess-pas2035`. |
| `ACCREDITATIONS` | TrustMark, PAS 2035, MCS, RECC or HIES, Gas Safe, competent person schemes, FENSA or CERTASS, NIA: plain meaning and where to check. |
| `GLOSSARY`, `termOf`, `definitionOf` | About 50 terms with one-sentence plain definitions. |
| `segments`, `plainText`, `markedTerms` | Glossary marks in copy: `[[g:u-value]]` or `[[g:u-value\|U-values]]`. Render a `term` segment with a dotted underline and its definition (UX 15). |
| `VOICE`, `checkVoice`, `BANNED` | The voice guide as data, and a checker (banned phrases such as "guaranteed" and "save up to", exclamation marks, dashes, sentences over 28 words). |
| `LANDING_CHAPTERS`, `visibleChapters(presence)`, `LANDING_INVITATION`, `LANDING_META` | The five landing chapters with `requires`. |
| `PluginPresence`, `presenceOf(registry)`, `presenceFromList`, `parseRequirement` | A requirement is a plugin id or `kind:<PluginKind>` (any plugin of that kind). Unknown kinds throw. |
| `PROOFS_INTRO` | Intro, seal meanings with "Not proved" lines, group headings and the boundary list for `/app/proofs`. The theorem list itself comes from `seals.json`. |
| `collectCopy()` | Every user-facing string with a path, for audits. |

Spec paths `packages/content/measures/` and `landing/chapters.ts` live under `src/` here.

Typical days are for a two or three bedroom home, from consumer guidance (Energy Saving Trust, Historic England, MCS, TrustMark). They are not quotes. If the app shows them, show them as typical, with the provenance.

## Tests

`pnpm --filter @ibasho/content test`: completeness against `ids.ts` (AC-P2), every glossary mark resolves (I5), every string passes `checkVoice`, chapter `requires` parse and hide chapters (I4), `presenceOf` against a live core registry.

## Status

Done for M-D content in T1 (en-GB). Not yet: India measures and copy (T3), translations, posters (M-E).
