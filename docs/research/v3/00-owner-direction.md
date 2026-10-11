# Owner direction for v3 (read first, overrides sequencing elsewhere)

**Goal: a high-fidelity, responsive prototype of every user flow first, then work backwards to real computation.**

Build outside in:

1. **Every user flow, end to end, at full visual fidelity**, on desktop, tablet and phone:
   - **New:** pick a location, pick or create a building (type, floors, rooms, windows, overhangs), place it in the 3D city, see the first results.
   - **Revisit:** welcome back, what changed (prices, codes, weather), progress on the plan.
   - **Restart:** start over or branch a new project from an existing one, without losing the old one.
   - **Current plus what-if:** the building as it is, side by side with variations; change a lever and see everything update.
   - **Update:** edit the building or its settings (rates, levels, codes) and watch results refresh.
2. **Rendering and computing take time, so show it honestly:** a render or progress bar with stages (geometry, sun and shadows, radiation, daylight, energy, codes, optimisation), progressive results (rough first, refined next), cancel, and no frozen screens.
3. **Then work backwards:** start from realistic fixture data shaped exactly like the real engine outputs (same contracts, evidence ids, units), clearly marked as preview data. Replace each fixture with real computation one stage at a time, keeping every flow working throughout.

Implications for the plan:
- The first build wave is the app shell, design system, editor, city scene and all five flows on fixture data, plus the progress system.
- Engine and analysis work packages deliver behind the same contracts, so swapping fixture for real is a one-line change per stage.
- Preview data must be labelled in the UI ("Preview", not a real result) until the real stage lands. Never present fixture numbers as computed.
