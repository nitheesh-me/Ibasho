# Release plan (after the trailer is final)

Order: trailer final → release package below → owner submits. Nothing is pushed.

## 1. README.md (rewrite)

Setup and run instructions only. No explanation of the solution.

- **Problem statement** (short, top of the file). Expanded from the original brief (a green home score and retrofit advice for houses): sustainability does not stop at the house, and no two houses are the same under its lens. It starts at a desk and grows: desk → room → floor → building → community → area → city. The same building behaves differently in Hyderabad and London, beside a tall neighbour or in the open, as a lab or an apartment.
- **Requirements:** Node 26.1.0, pnpm 11.1.1, optional Lean 4 (v4.34.0) for the proofs, optional Ollama for the local narrator.
- **Setup:** `pnpm install --frozen-lockfile`.
- **Run:** studio and landing dev servers, production build, preview; the optional companion and MCP agent link.
- **Tests:** per-package commands; Lean build.
- **External data and model weights (links only):** OpenStreetMap (ODbL) via Overpass; TMYx Hyderabad EPW and PVGIS London weather; IIIT Hyderabad floor-plan PDFs; NASA POWER; Poly Haven, Kenney, Quaternius assets; Ollama `qwen3:8b` (optional, local); any other dataset used. The reference-building table moves to `docs/sources/REFERENCE-BUILDINGS.md` (linked).
- Credits link to `ACKNOWLEDGEMENTS.md`.

## 2. LICENSE

MIT License, year 2026, copyright holder the owner (confirm name or team).

## 3. deliverables/final_report.pdf (max 3 pages)

Typst, same house style as M1 and M2, team number at the top of every page. Any Typst Universe package may be used where it helps (for example `fletcher` or `cetz` for diagrams, `lilaq` or `cetz-plot` for charts, `tablex`-style tables, `codly` for any code). Main body (max 3 pages): solution, approach, features, results (numbers from the built product: buildings modelled, stages real versus Preview, accuracy checks, Lean checks, tests). Then an **appendix** after the 3 pages: a screenshot gallery of the product (studio flows day and night, city stills, landing, editor, compare, phone and desktop) with one-line captions, and a full feature list grouped by area. Edited for plain, human prose (business-communication editor pass, no dashes). Compile through the CPU cap with limited jobs.

## 4. Team number on every PDF

Add the team number to the header of every PDF in `deliverables/` (M1 already has it; M2, STATUS, BLACKBOARD and the final report need it). Confirm the number (M1 says Team #124).

## 5. Code zip (backup for the submission form)

From a clean checkout of the committed tree (`git archive`), so ignored folders never enter: excludes `node_modules`, virtual environments (`videos/.tools`), datasets and downloaded sources (`docs/research/v3/sources`), model weights, build output (`dist`, `.lake/build`), the private `videos/` folder and the trailer music, and local machine files (`CLAUDE.local.md`, `docs/progress`). Check size and contents before handing over.

## 6. Final checks

No development artefacts in customer-facing text; no machine-local notes in tracked files; no dashes in copy; README links resolve; the zip builds and runs from scratch on a clean clone.
