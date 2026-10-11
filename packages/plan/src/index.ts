/**
 * `@ibasho/plan`: integer-millimetre plan kernel (ARCH 15.1, BE 2). Owner: WP-14. Layer L1.
 * Pure functions; safe for the editor and the scene (L3) to call for live previews.
 */
export { atan2, azimuthMdeg, normMdeg, sinCosMdeg } from './angle.ts';
export { difference, intersect, offset, triangulate, union } from './clip.ts';
export { type CompileOptions, compile, effectiveStoreys, roomAnchor } from './compile.ts';
export {
  edgeAzimuthMdeg,
  projectionFactor,
  type SegmentFacade,
  segmentFacade,
  type WindowGeom,
  windowGeom,
  wwrPm,
} from './facade.ts';
export { fromPlaceFrame, toPlaceFrame, trueAzimuthMdeg } from './frame.ts';
export {
  bounds,
  centroid,
  edgeLength,
  isCCW,
  m2,
  normaliseRing,
  onSegment,
  perimeter,
  pointInPolygon,
  pointInRing,
  polygonAreaMm2,
  rectRing,
  ringArea2,
  ringAreaMm2,
} from './polygon.ts';
export { rectPolygon, splitPolygon } from './rooms.ts';
export { CURATED_ALIASES } from './search/aliases.ts';
export { buildPlaceIndex, type PlaceIndex, type PlaceIndexInput, searchPlaces } from './search/index.ts';
export { editDistance, normalise as normaliseName } from './search/text.ts';
export { snapOrthogonal, snapToGrid, snapToPoints } from './snap.ts';
export {
  adjacencyOf,
  adjacencySymmetric,
  insertTJunctions,
  type RoomSpec,
  type WeldOptions,
  weldRooms,
} from './weld.ts';
export { autoZone, type ZoneShape } from './zoning.ts';
