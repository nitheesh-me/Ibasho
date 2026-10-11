# Ibasho 居場所

See how a building will live in its city. Ibasho is a local-first studio for designing and improving buildings: place a building in its real city, draw it floor by floor, and see its sun and shade, daylight, energy by end use, bills, carbon, code standing and green rating path. Numbers come from documented models, unknowns are shown as unknown, and Lean 4 checks the bookkeeping.

A personal project, not for commercial use.

## Run it

Node 26.1.0 and pnpm 11.1.1.

```
pnpm install --frozen-lockfile
pnpm --filter @ibasho/web dev        # the studio
pnpm --filter @ibasho/landing dev    # the landing page
```

## Where things are

- Plan and design: [`docs/PLAN-V3.md`](docs/PLAN-V3.md), [`docs/SPEC.md`](docs/SPEC.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)
- Progress: [`docs/STATUS.typ`](docs/STATUS.typ) (PDF in `deliverables/`)
- Milestone reports: [`report/`](report/)

## Building plans and layouts

Where each sample building's plan or layout comes from. Floor plans are used where public; otherwise the closest public layout source (map outline, developer or architect description, listing) and the floors are marked estimated.

| Building | Plan or layout source | Other layout sources |
|---|---|---|
| Vindhya Bhavan, IIIT Hyderabad | [Floor plans, IIIT Hyderabad estate office (PDF, Dec 2022)](https://intranet.iiit.ac.in/offices/static/files/Vindhya_bhavan.pdf) | [OpenStreetMap relation 2829427](https://www.openstreetmap.org/relation/2829427) |
| Himalaya Building, IIIT Hyderabad | [Floor plans, IIIT Hyderabad estate office (PDF, Dec 2022)](https://intranet.iiit.ac.in/offices/static/files/Himalaya_Building.pdf) | [OpenStreetMap way 187896823](https://www.openstreetmap.org/way/187896823), [way 211078709](https://www.openstreetmap.org/way/211078709) |
| Lloyds Technology Centre (Octave Block, Sattva Knowledge City) | No public floor plan. Footprint: [OpenStreetMap way 852979202](https://www.openstreetmap.org/way/852979202) | [Sattva Knowledge City, developer page](https://sattvagroup.com/commercial/sattva-knowledge-city/), [office address, floor 10](https://lloydstechnologycentre.com/corporate-details) |
| Qualcomm (KRC Commerzone, Raidurg) | No public floor plan. Massing and cores: [KRC Commerzone, World Architects](https://world-architects.com/en/projects/view/krc-commerzone-hyderabad) | [OpenStreetMap way 1133460476](https://www.openstreetmap.org/way/1133460476), [K Raheja Corp release](https://krahejacorp.com/newsroom/mindspace-reit-to-acquire-18-million-sq-ft-it-park-in-hyderabad-for-rs-2038-cr) |
| Vanguard (Sattva Knowledge Park) | No public floor plan. Typical floor plate: [myHQ listing, Tower 1](https://myhq.in/managed-office/redbrick-offices-madhapur-2) | [OpenStreetMap way 1133269186](https://www.openstreetmap.org/way/1133269186), [Sattva Hyderabad commercial](https://sattvagroup.com/commercial/hyderabad-commercial/) |
| HITEC City office (typical) | No plan; modelled on a public listing. Footprint: [OpenStreetMap way 776432080](https://www.openstreetmap.org/way/776432080) | |
| Gachibowli apartments, London terrace | Typical buildings, not real addresses; layouts are our own | |

## Sources and credits

- Full source notes for every reference building (what is measured, estimated or assumed, all public sources and unknowns): [`docs/sources/REFERENCE-BUILDINGS.md`](docs/sources/REFERENCE-BUILDINGS.md).
- Libraries, data, algorithms, assets and ideas: [`ACKNOWLEDGEMENTS.md`](ACKNOWLEDGEMENTS.md).
- Map data © OpenStreetMap contributors (ODbL).
