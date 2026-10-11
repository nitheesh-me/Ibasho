# Ibasho 居場所

## Problem statement

The brief asked for a green score and retrofit advice for a home. We widened it. Sustainability does not stop at the front door, and no two houses are the same under its lens. The same building behaves differently in Hyderabad and in London, beside a tall neighbour or in the open, as a lab or as a flat. So the question starts at a desk and grows outwards: desk, room, floor, building, community, area, city.

This file covers setup and running only. The report in [`deliverables/final_report.pdf`](deliverables/final_report.pdf) describes the solution.

## Requirements

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 26.1.0 (see `.nvmrc`) | Everything |
| pnpm | 11.1.1 (`corepack enable` picks it up from `package.json`) | Everything |
| Lean 4 via [elan](https://github.com/leanprover/elan) | v4.34.0 (pinned in `proofs/lean-toolchain`) | Optional: the proofs and the native checker |
| [Ollama](https://ollama.com) | any recent release | Optional: the local narrator |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | any recent release | Optional: the agent link |

No account, API key or network service is needed to run the studio. City, weather and building data ship with the repository.

## Install

```
pnpm install --frozen-lockfile
```

## Run

```
pnpm --filter @ibasho/web dev        # the studio, at http://localhost:5173/app/
pnpm --filter @ibasho/landing dev    # the landing page, at http://localhost:5173/ (or the next free port)
```

Vite prints the address it uses. The studio opens on "Your places"; the IIIT Hyderabad campus and the London terrace are ready to explore.

Production build and preview:

```
pnpm build                                 # builds both apps
pnpm --filter @ibasho/web preview          # http://localhost:4173/app/
pnpm --filter @ibasho/landing preview      # http://localhost:4174/
```

## Demo walkthrough

With the studio running at http://localhost:5173/app/, a ten minute tour:

1. **Find a building.** On "Your places", open search and type `Vindhya`. Pick Vindhya Bhavan; the camera flies to it in the Hyderabad city model.
2. **Look.** Switch the lens to Sun, Radiation or Daylight. Drag the sun scrubber to watch shadows move. Use the day and night switch in the top bar.
3. **Go inside.** Step down the scale ladder (City, Site, Building, Floor, Room) and open a floor to see its daylight map.
4. **Ask what if.** In Choose, move a lever (glazing, overhang, rooftop solar). The progress bar runs the stages again; compare current and what if side by side.
5. **Prove and tell.** Open Prove for the energy use, the codes and ratings, then Tell for the narrator. Click any number to open where it came from.
6. **Design before you build.** Choose Design in the top bar: write a short brief, draw rooms in the plan editor, place the plot in Hyderabad or London, compare sites and save.
7. **Homes.** Open Homes in the top bar: homes ranked by improvement potential. Open P10001 to see its Green Home Score, why it scored that way, suitable retrofits with electricity and gas savings, carbon and an indicative value range. Tick a retrofit to rerun every figure.
8. **Come back.** Reload the page and reopen the place: the studio greets you with what changed since your last visit.

## Tests and checks

```
pnpm --filter @ibasho/<package> test       # one package, for example @ibasho/site or @ibasho/plan
pnpm test                                  # every package
pnpm -r typecheck                          # TypeScript in every package
pnpm lint                                  # Biome, layer rules, unused code, house rules
pnpm contracts                             # cross package contract tests
pnpm smoke                                 # both apps boot in Chromium and Firefox (Playwright)
```

On a small machine, limit parallel work, for example `pnpm exec turbo run test --concurrency=2` or `pnpm --filter @ibasho/site exec vitest run --maxWorkers=2`.

## Optional: Lean proofs and checker

```
cd proofs
lake build                                          # the proved specification
lake build IbashoCheck ibasho-check ibasho-gen      # the checker and the code generator
lake exe ibasho-gen --check                         # generated constants match the Lean source
```

Or `pnpm proofs` from the root, which builds and regenerates. `pnpm verify` runs the checker and its TypeScript mirror over the sample certificates.

## Optional: local narrator (Ollama)

```
ollama pull qwen3:8b       # or qwen3:4b on a smaller machine
ollama serve
```

The studio finds Ollama on your machine and uses it only to polish wording. Without it, the narrator uses its built in templates. If the browser cannot reach Ollama, start the companion below, which passes requests through on 127.0.0.1 only.

## Optional: companion and agent link

```
pnpm --filter @ibasho/companion start      # local helper on 127.0.0.1:7357 (Lean checker, Ollama pass through)
pnpm --filter @ibasho/mcp start            # MCP server for AI agents, over stdio
node tools/agent-install/src/cli.ts --dry-run     # show what installing into Claude Code would change
pnpm agent:install                              # install as a Claude Code plugin
node tools/agent-install/src/cli.ts --uninstall   # remove it again
```

## External data and model weights

Everything the app needs is already in the repository, rebuilt from these sources. Links are for reference and for rebuilding.

| Source | Used for | Licence |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/copyright) via the [Overpass API](https://overpass-api.de) | Building outlines, levels, names and trees for Hyderabad and London | ODbL 1.0 |
| [Climate.OneBuilding TMYx 2011 to 2025, Hyderabad (431285)](https://climate.onebuilding.org/WMO_Region_2_Asia/IND_India/TG_Telangana/IND_TG_Hyderabad-Gandhi.Intl.AP.431285_TMYx.2011-2025.zip) | Hourly Hyderabad weather (EPW) | CC BY 4.0 |
| [PVGIS 5.2 TMY (European Commission JRC)](https://re.jrc.ec.europa.eu/pvg_tools/en/) | Hourly London weather | Free reuse with attribution |
| [NASA POWER](https://power.larc.nasa.gov) | Monthly climate for the home model | Open, NASA |
| [IIIT Hyderabad estate office floor plans](https://intranet.iiit.ac.in/offices/static/files/Vindhya_bhavan.pdf) ([Himalaya](https://intranet.iiit.ac.in/offices/static/files/Himalaya_Building.pdf)) | Room layouts of Vindhya Bhavan and Himalaya, simplified; the PDFs are not shipped | Public documents, reference only |
| [Poly Haven](https://polyhaven.com) | Skies and textures | CC0 |
| [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) | Furniture models | CC0 |
| [Quaternius Ultimate House Interior](https://quaternius.com/packs/ultimatehomeinterior.html) | Interior models | CC0 |
| [Ollama `qwen3:8b`](https://ollama.com/library/qwen3) | Optional local narrator; downloaded by you, never shipped | Apache 2.0 |

Codes, tariffs, benchmarks and other published sources are listed with their licences in [`ACKNOWLEDGEMENTS.md`](ACKNOWLEDGEMENTS.md).

## Sources and credits

- Where each sample building's plan and facts come from, and what is measured, estimated or unknown: [`docs/sources/REFERENCE-BUILDINGS.md`](docs/sources/REFERENCE-BUILDINGS.md).
- Libraries, algorithms, data, assets and ideas we build on: [`ACKNOWLEDGEMENTS.md`](ACKNOWLEDGEMENTS.md).
- Map data © OpenStreetMap contributors (ODbL).

## Licence

MIT, see [`LICENSE`](LICENSE).
