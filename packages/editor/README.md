# @ibasho/editor

Make mode: the plan editor for `ibasho.building/1` documents (SPEC 20, BE 3, DESIGN_SYSTEM 13.4).

- **Owner:** WP-15. **Layer:** L3 (imports `@ibasho/core`, `@ibasho/ui`, `immer`).

## Use

```tsx
import '@ibasho/editor/editor.css';
import { edit, emptyHistory, Inspector, PlanEditor, record, StoreyStack, undo } from '@ibasho/editor';

<PlanEditor doc={doc} storeyId={id} selection={sel} onSelect={setSel}
  onEdit={(label, recipe) => { const { doc: next, cmd } = edit(doc, label, recipe); ... record(history, cmd) }} />
```

The editor never owns the document: every tool calls `onEdit(label, recipe)`; `edit()` turns the recipe into a command of Immer patches with its inverse and origin (person, agent, partner, import), and `undo`/`redo` apply them.

## Public API

| Export | What |
|---|---|
| `PlanEditor`, `TOOLS`, `PHONE_TOOLS` | SVG plan on washi: ink poche walls, windows as three lines, shading dashed beyond the wall with its depth, function hatches (never colour), overlap warm hatch, untyped rooms dashed, ghost storey below, underlay image. Tools V select, R room, P polygon, S split, M merge, O window, H shade, F function brush, D measure; typed sizes ("12 x 8", "4.2", feet and inches); pinch and two finger pan; tool rail, zoom and pan buttons, north arrow, scale bar. Phone: light edits only |
| `Inspector`, `StoreyStack`, `FacadePanel`, `PlanOutline`, `MeterChip`, `SHADE_PRESETS` | Properties sheet: name, function (`Picker`), window share per wall (`Range`), shading presets (chajja, deep, fins, box, jaali), facade levers on every floor, live WWR and PF meters, storeys (add above with rooms, walls or empty; floor height; repeat), keyboard outline of every room (AC-ED3) |
| `edit`, `record`, `undo`, `redo`, `emptyHistory`, recipes (`addRoom`, `splitRoom`, `mergeRooms`, `moveRooms`, `deleteRooms`, `setRoomFunction`, `setWindow`, `setShading`, `setFacade`, `addStoreyAbove`, `removeStorey`, `setStorey`, `setUnderlay`, `setRotation`) | Commands as Immer patches |
| `storeyChecks`, `facadeMeters`, `overallWwrPm`, `quickQuantities` | Live plan checks and meters while drawing (canonical checks come from `@ibasho/plan` `compile`) |
| geometry helpers, `snapPoint`, `parseLength`, `parseSize` | Exact mm² areas, splits, overlap, facade bins; snapping vertex, edge, grid, 15° |
| `SPACE_FUNCTIONS`, `TYPE_FUNCTIONS`, `spaceFunction` | Room functions (ids match the Preview space loads and the golden fixtures) |

## Stubs

- PLACEHOLDER: PDF underlay needs `pdfjs-dist` (not installed); images (PNG, JPG, SVG, WebP) work, calibrated by drawing width. Trace assist (BE 4.1) is not built.
- Wall chain tool, doors and detailed openings by placement, louvres and light shelves in the inspector, and named branches of the log are not built yet.

## Tests

`test/editor.test.ts`: exact areas and split conservation, facade bins, snapping and typed lengths, draw, split (symmetric adjacency), merge with undo and redo, facade WWR and PF meters.
