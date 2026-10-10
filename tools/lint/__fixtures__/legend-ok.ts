// legend fixture: compliant layers.
export const lens = {
  kind: 'visual-layer',
  id: 'thermal-lens',
  encodesNumbers: true,
  Overlay: () => null,
  Legend: () => null,
  evidenceAt() {
    return undefined;
  },
};
export const ghost = { kind: 'visual-layer', id: 'ghost', encodesNumbers: false, Overlay: () => null };
