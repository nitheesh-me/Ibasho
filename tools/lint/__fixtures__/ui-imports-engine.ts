// G0-2 fixture: stands in for a file in packages/ui. Importing the engine is forbidden (ARCH 3),
// so dependency-cruiser must report rule `ui-not-engine` here.
export * from '../../../packages/engine/src/index.ts';
