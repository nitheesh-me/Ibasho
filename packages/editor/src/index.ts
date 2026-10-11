/**
 * @ibasho/editor: Make mode (SPEC 20, ARCH 15.1). Owner: WP-15. Layer L3 (L0, ui, plan).
 *
 * `PlanEditor` draws and edits one storey of an `ibasho.building/1` document; `Inspector`,
 * `StoreyStack`, `FacadePanel` and `PlanOutline` are the properties sheet. Edits are recipes
 * recorded as Immer patch commands (`edit`, `record`, `undo`, `redo`). Import the styles with
 * `import '@ibasho/editor/editor.css'`.
 */
export {
  ECBC_WWR_LIMIT_PM,
  type FacadeMeter,
  facadeMeters,
  overallWwrPm,
  type QuickQuantities,
  quickQuantities,
  storeyChecks,
} from './checks.ts';
export * from './geom.ts';
export {
  FacadePanel,
  Inspector,
  type InspectorProps,
  MeterChip,
  PlanOutline,
  presetOf,
  SHADE_PRESETS,
  StoreyStack,
  type StoreyStackProps,
} from './Inspector.tsx';
export {
  addCore,
  addRoom,
  addStoreyAbove,
  classifyStorey,
  deleteRooms,
  type EditCommand,
  type EditOrigin,
  edit,
  emptyHistory,
  type History,
  mergeRooms,
  moveRooms,
  newId,
  type Recipe,
  record,
  redo,
  removeCore,
  removeStorey,
  renameRoom,
  restack,
  segmentsFor,
  setFacade,
  setRoomFunction,
  setRotation,
  setShading,
  setStorey,
  setUnderlay,
  setWindow,
  splitRoom,
  undo,
} from './ops.ts';
export { PHONE_TOOLS, PlanEditor, type PlanEditorProps, TOOLS, type ToolId } from './PlanEditor.tsx';
export { parseLength, parseSize, type SnapContext, snapPoint } from './snap.ts';
export { type Hatch, SPACE_FUNCTIONS, type SpaceFunction, spaceFunction, TYPE_FUNCTIONS } from './spaces.ts';
