/**
 * PlanEditor: the Make mode plan, an architect's drawing on washi (SPEC 20, DS 13.4, BE 3).
 * Owner: WP-15. Layer L3.
 *
 * Crisp SVG at every zoom: cut walls as solid ink poche, windows as three lines in the wall,
 * shading as a dashed outline beyond the wall with its depth tag, rooms named with a hatch for
 * their function (never a fill colour, so colour stays free for analysis lenses). Errors are drawn
 * on the model: overlap as a warm hatch, an untyped room dashed, an oversize window dashed warm.
 *
 * Tools (keyboard, BE 3.5): V select, R room rectangle, P room polygon, S split, M merge, O opening,
 * H shade, F function brush, D measure. Ctrl+Z and Ctrl+Shift+Z, Delete, Esc, Enter, PgUp and PgDn
 * for storeys, plus and minus to zoom, arrows to pan. Typing while drawing sets the size ("12 x 8",
 * "4.2", "23'6\""). Touch: one finger draws with a tool active, otherwise pans; two fingers pan and
 * zoom and never draw. Every drag has a button alternative (the tool rail and zoom buttons), and
 * the plan outline (`PlanOutline`) reaches every room without a pointer (AC-ED3, AC-ED4).
 *
 * The editor never owns the document: it calls `onEdit(label, recipe)` and the app records the
 * command (Immer patches) on its history.
 */
import type { BuildingDoc, PlanCheck, PointMm, Room2D, Storey } from '@ibasho/core';
import {
  type KeyboardEvent,
  type ReactNode,
  type PointerEvent as RPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent,
} from 'react';
import { storeyChecks } from './checks.ts';
import { areaM2, bbox, centroid, distToSegment, edge, edgeLength, pointInPolygon, rect } from './geom.ts';
import {
  addRoom,
  deleteRooms,
  mergeRooms,
  moveRooms,
  type Recipe,
  setRoomFunction,
  setShading,
  setWindow,
  splitRoom,
} from './ops.ts';
import { parseLength, parseSize, snapPoint } from './snap.ts';
import { SPACE_FUNCTIONS, spaceFunction } from './spaces.ts';

export type ToolId =
  | 'select'
  | 'rect'
  | 'poly'
  | 'split'
  | 'merge'
  | 'opening'
  | 'shade'
  | 'brush'
  | 'measure';

export const TOOLS: readonly { id: ToolId; key: string; label: string; hint: string; draws: boolean }[] = [
  { id: 'select', key: 'V', label: 'Select', hint: 'Pick and move rooms', draws: false },
  { id: 'rect', key: 'R', label: 'Room', hint: 'Drag a rectangle, or type 12 x 8', draws: true },
  { id: 'poly', key: 'P', label: 'Polygon', hint: 'Click corners, Enter to close', draws: true },
  { id: 'split', key: 'S', label: 'Split', hint: 'Click inside a room; Shift turns the cut', draws: true },
  { id: 'merge', key: 'M', label: 'Merge', hint: 'Select a room, then click its neighbour', draws: true },
  { id: 'opening', key: 'O', label: 'Window', hint: 'Click a wall to cycle its window', draws: false },
  {
    id: 'shade',
    key: 'H',
    label: 'Shade',
    hint: 'Click a wall to cycle chajja, deep overhang, fins',
    draws: false,
  },
  { id: 'brush', key: 'F', label: 'Function', hint: 'Paint a room function', draws: false },
  { id: 'measure', key: 'D', label: 'Measure', hint: 'Click two points', draws: false },
];

/** Tools a phone offers: light edits only (SPEC 18, DS 13.7). */
export const PHONE_TOOLS: readonly ToolId[] = ['select', 'brush', 'opening', 'shade'];

export interface PlanEditorProps {
  doc: BuildingDoc;
  storeyId: string;
  onStorey?: (id: string) => void;
  onEdit?: (label: string, recipe: Recipe) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  selection: readonly string[];
  onSelect: (ids: string[], segId?: string) => void;
  /** Phone: light edits only, with the "bigger screen" line. */
  limited?: boolean;
  readOnly?: boolean;
  /** Lens paint per room (Look mode on the plan): a colour, or undefined for paper. */
  paint?: (room: Room2D) => string | undefined;
  /** Checks to draw; defaults to the editor's live storey checks. */
  checks?: PlanCheck[];
  /** Object URL for the storey's underlay image. */
  underlayUrl?: string;
  /** Extra overlay content in screen space (legend plate). */
  overlay?: ReactNode;
  /** Grid in mm (100 default, 300 on touch). */
  grid?: number;
  /** Function the brush paints; controlled by the app's palette when given. */
  brushFunction?: string;
  onBrushFunction?: (id: string) => void;
  tool?: ToolId;
  onTool?: (t: ToolId) => void;
}

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Drag =
  | { kind: 'pan'; start: [number, number]; view: View }
  | { kind: 'move'; start: PointMm; ids: string[]; delta: PointMm }
  | { kind: 'rect'; a: PointMm; b: PointMm }
  | null;

function fitView(s: Storey | undefined, aspect: number): View {
  const pts = s?.rooms.flatMap((r) => r.floor.outer) ?? [];
  const b = pts.length ? bbox(pts) : { x0: 0, y0: 0, x1: 20000, y1: 15000 };
  const pad = Math.max(3000, 0.08 * Math.max(b.x1 - b.x0, b.y1 - b.y0));
  let w = b.x1 - b.x0 + 2 * pad;
  let h = b.y1 - b.y0 + 2 * pad;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  const cx = (b.x0 + b.x1) / 2;
  const cy = -(b.y0 + b.y1) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

const P = ([x, y]: readonly [number, number]) => `${x},${-y}`;
const ringPath = (ring: readonly PointMm[]) => `M${ring.map(P).join('L')}Z`;

export function PlanEditor(props: PlanEditorProps) {
  const { doc, storeyId, selection, onSelect, onEdit, limited = false, readOnly = false } = props;
  const storey = doc.storeys.find((s) => s.id === storeyId) ?? doc.storeys[0];
  const below = storey ? doc.storeys[doc.storeys.indexOf(storey) - 1] : undefined;
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(1.6);
  const [view, setView] = useState<View>(() => fitView(storey, 1.6));
  const [toolLocal, setToolLocal] = useState<ToolId>('select');
  const tool = props.tool ?? toolLocal;
  const setTool = (t: ToolId) => (props.onTool ? props.onTool(t) : setToolLocal(t));
  const [brushLocal, setBrushLocal] = useState<string>(SPACE_FUNCTIONS[0]?.id ?? 'edu.classroom');
  const brush = props.brushFunction ?? brushLocal;
  const [drag, setDrag] = useState<Drag>(null);
  const [poly, setPoly] = useState<PointMm[]>([]);
  const [hover, setHover] = useState<PointMm | null>(null);
  const [typed, setTyped] = useState('');
  const [measure, setMeasure] = useState<PointMm[]>([]);
  const [shiftDown, setShiftDown] = useState(false);
  const pointers = useRef(new Map<number, [number, number]>());
  const pinch = useRef<{ d: number; view: View; mid: [number, number] } | null>(null);
  const grid = props.grid ?? 100;
  const mmPerPx = view.w / Math.max(1, boxRef.current?.clientWidth ?? 800);

  // Fit on storey change and track the box aspect.
  const storeyKey = storey?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: refit only when the storey changes
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const a = el.clientWidth / Math.max(1, el.clientHeight);
    setAspect(a);
    setView(
      fitView(
        doc.storeys.find((s) => s.id === storeyKey),
        a,
      ),
    );
  }, [storeyKey]);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const a = el.clientWidth / Math.max(1, el.clientHeight);
      setAspect(a);
      setView((v) => ({ ...v, h: v.w / a }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rooms = (storey?.rooms ?? []) as Room2D[];
  const checks = useMemo(() => props.checks ?? (storey ? storeyChecks(storey) : []), [props.checks, storey]);
  const flagged = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const c of checks) for (const t of c.targets) m.set(t, (m.get(t) ?? new Set()).add(c.kind));
    return m;
  }, [checks]);

  const vertices = useMemo(() => rooms.flatMap((r) => r.floor.outer), [rooms]);
  const edges = useMemo(
    () => rooms.flatMap((r) => r.floor.outer.map((_, i) => edge(r.floor.outer, i))),
    [rooms],
  );

  const toPlan = useCallback((clientX: number, clientY: number): [number, number] => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return [0, 0];
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [pt.x, -pt.y];
  }, []);

  const snap = (p: [number, number], anchor?: PointMm, off = false) =>
    snapPoint(p, { grid, tol: 12 * mmPerPx, vertices, edges, ...(anchor ? { anchor } : {}), off }).pt;

  const roomAt = (p: [number, number]) => [...rooms].reverse().find((r) => pointInPolygon(p, r.floor.outer));

  const segmentAt = (p: [number, number]) => {
    let best: { room: Room2D; segId: string; d: number } | undefined;
    for (const r of rooms) {
      r.segments.forEach((s, i) => {
        if (s.boundary.kind === 'adjacent') return;
        const [a, b] = edge(r.floor.outer, i);
        const { d } = distToSegment(p, a, b);
        if (d < 16 * mmPerPx && (!best || d < best.d)) best = { room: r, segId: s.id, d };
      });
    }
    return best;
  };

  const run = (label: string, recipe: Recipe) => {
    if (!readOnly) onEdit?.(label, recipe);
  };

  const zoomAt = (factor: number, at?: [number, number]) => {
    setView((v) => {
      const cx = at ? at[0] : v.x + v.w / 2;
      const cy = at ? -at[1] : v.y + v.h / 2;
      const w = Math.min(2_000_000, Math.max(2000, v.w * factor));
      const h = w / aspect;
      return { x: cx - ((cx - v.x) * w) / v.w, y: cy - ((cy - v.y) * h) / v.h, w, h };
    });
  };
  const pan = (dx: number, dy: number) => setView((v) => ({ ...v, x: v.x + dx * v.w, y: v.y + dy * v.h }));

  // ------------------------------------------------------------------ pointer handling

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.current.size === 2) {
      // Two fingers: pan and zoom, never draw.
      const [a, b] = [...pointers.current.values()] as [[number, number], [number, number]];
      pinch.current = {
        d: Math.hypot(a[0] - b[0], a[1] - b[1]),
        view,
        mid: toPlan((a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
      };
      setDrag(null);
      return;
    }
    const raw = toPlan(e.clientX, e.clientY);
    const off = e.shiftKey && tool !== 'split';
    const p = snap(raw, undefined, off);
    const hit = roomAt(raw);
    const panInstead = e.button === 1 || (e.pointerType === 'touch' && tool === 'select' && !hit);
    if (panInstead || (tool === 'select' && !hit)) {
      if (tool === 'select' && !hit && e.button === 0) onSelect([]);
      setDrag({ kind: 'pan', start: [e.clientX, e.clientY], view });
      return;
    }
    switch (tool) {
      case 'select': {
        if (!hit) return;
        const ids = e.shiftKey
          ? selection.includes(hit.id)
            ? selection.filter((x) => x !== hit.id)
            : [...selection, hit.id]
          : selection.includes(hit.id)
            ? [...selection]
            : [hit.id];
        onSelect(ids);
        if (!readOnly && !limited) setDrag({ kind: 'move', start: p, ids, delta: [0, 0] });
        return;
      }
      case 'rect':
        setDrag({ kind: 'rect', a: p, b: p });
        setTyped('');
        return;
      case 'poly': {
        const first = poly[0];
        if (first && poly.length >= 3 && Math.hypot(first[0] - p[0], first[1] - p[1]) < 12 * mmPerPx) {
          closePoly();
          return;
        }
        setPoly([...poly, poly.length ? snap(raw, poly[poly.length - 1], off) : p]);
        return;
      }
      case 'split': {
        if (!hit || !storey) return;
        const b = bbox(hit.floor.outer);
        const wide = b.x1 - b.x0 >= b.y1 - b.y0;
        const axis: 'x' | 'y' = wide !== e.shiftKey ? 'x' : 'y';
        run('Split room', splitRoom(storey.id, hit.id, axis, axis === 'x' ? p[0] : p[1]));
        return;
      }
      case 'merge': {
        if (!hit || !storey) return;
        const a = selection[0];
        if (a && a !== hit.id) {
          run('Merge rooms', mergeRooms(storey.id, a, hit.id));
          onSelect([a]);
        } else onSelect([hit.id]);
        return;
      }
      case 'opening': {
        const s = segmentAt(raw);
        if (!s || !storey) return;
        const seg = s.room.segments.find((x) => x.id === s.segId);
        const cur = seg?.window.kind === 'ratio' ? seg.window.wwrPm : 0;
        const next = cur === 0 ? 300 : cur < 450 ? 500 : 0;
        run(
          next ? `Window ${next / 10}% on a wall` : 'Remove window',
          setWindow(
            storey.id,
            s.room.id,
            s.segId,
            next ? { kind: 'ratio', wwrPm: next, sill: 900, head: 2400 } : { kind: 'none' },
          ),
        );
        onSelect([s.room.id], s.segId);
        return;
      }
      case 'shade': {
        const s = segmentAt(raw);
        if (!s || !storey) return;
        const seg = s.room.segments.find((x) => x.id === s.segId);
        const oh = seg?.shading.find((x) => x.kind === 'overhang');
        const fins = seg?.shading.find((x) => x.kind === 'fins');
        const next =
          !oh && !fins
            ? [{ kind: 'overhang' as const, depth: 600, aboveHead: 150, extension: 300 }]
            : oh && oh.depth < 800
              ? [{ kind: 'overhang' as const, depth: 900, aboveHead: 150, extension: 300 }]
              : oh
                ? [{ kind: 'fins' as const, depth: 450, sides: 'both' as const }]
                : [];
        run(next.length ? 'Add shading' : 'Remove shading', setShading(storey.id, s.room.id, s.segId, next));
        onSelect([s.room.id], s.segId);
        return;
      }
      case 'brush': {
        if (!hit || !storey) return;
        run(
          `Paint ${spaceFunction(brush)?.label ?? 'function'}`,
          setRoomFunction(storey.id, [hit.id], brush),
        );
        onSelect([hit.id]);
        return;
      }
      case 'measure':
        setMeasure((m) => (m.length >= 2 ? [p] : [...m, p]));
        return;
    }
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    setShiftDown(e.shiftKey);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [[number, number], [number, number]];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const pv = pinch.current.view;
      const f = pinch.current.d / Math.max(1, d);
      const w = Math.min(2_000_000, Math.max(2000, pv.w * f));
      const h = w / aspect;
      const [mx, my] = pinch.current.mid;
      setView({ x: mx - ((mx - pv.x) * w) / pv.w, y: -my - ((-my - pv.y) * h) / pv.h, w, h });
      return;
    }
    const raw = toPlan(e.clientX, e.clientY);
    const off = e.shiftKey && tool !== 'split';
    if (!drag) {
      setHover(
        tool === 'poly' && poly.length ? snap(raw, poly[poly.length - 1], off) : snap(raw, undefined, off),
      );
      return;
    }
    if (drag.kind === 'pan') {
      const el = boxRef.current;
      const k = drag.view.w / Math.max(1, el?.clientWidth ?? 800);
      setView({
        ...drag.view,
        x: drag.view.x - (e.clientX - drag.start[0]) * k,
        y: drag.view.y - (e.clientY - drag.start[1]) * k,
      });
    } else if (drag.kind === 'rect') {
      setDrag({ ...drag, b: snap(raw, undefined, off) });
    } else if (drag.kind === 'move') {
      const p = snap(raw, undefined, off);
      setDrag({ ...drag, delta: [p[0] - drag.start[0], p[1] - drag.start[1]] });
    }
  };

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!drag || !storey) return setDrag(null);
    if (drag.kind === 'rect') {
      const r = rect(drag.a, drag.b);
      if (areaM2({ outer: r, holes: [] }) >= 1) {
        run('Draw room', addRoom(storey.id, r, { spaceTypeId: brush }));
      }
    } else if (drag.kind === 'move' && (drag.delta[0] !== 0 || drag.delta[1] !== 0)) {
      run(
        drag.ids.length > 1 ? 'Move rooms' : 'Move room',
        moveRooms(storey.id, drag.ids, drag.delta[0], drag.delta[1]),
      );
    }
    setDrag(null);
  };

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    zoomAt(e.deltaY > 0 ? 1.12 : 1 / 1.12, toPlan(e.clientX, e.clientY));
  };

  const closePoly = () => {
    if (storey && poly.length >= 3) run('Draw room', addRoom(storey.id, poly, { spaceTypeId: brush }));
    setPoly([]);
  };

  // ------------------------------------------------------------------ keyboard

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (k === 'z' || k === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) props.onRedo?.();
      else props.onUndo?.();
      return;
    }
    if (mod && (k === 'y' || k === 'Y')) {
      e.preventDefault();
      props.onRedo?.();
      return;
    }
    // Typed values while drawing (Sweet Home 3D's value box).
    if ((tool === 'rect' || tool === 'poly') && /^[0-9.'"xX×m ]$/.test(k)) {
      e.preventDefault();
      setTyped((t) => t + k);
      return;
    }
    if (k === 'Backspace' && typed) {
      e.preventDefault();
      setTyped((t) => t.slice(0, -1));
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      if (tool === 'rect' && typed && storey) {
        const size = parseSize(typed);
        const origin = hover ?? ([0, 0] as PointMm);
        if (size)
          run(
            'Draw room',
            addRoom(storey.id, rect(origin, [origin[0] + size[0], origin[1] + size[1]]), {
              spaceTypeId: brush,
            }),
          );
        setTyped('');
      } else if (tool === 'poly') {
        const last = poly[poly.length - 1];
        const len = parseLength(typed);
        if (last && len && hover) {
          const ang = Math.atan2(hover[1] - last[1], hover[0] - last[0]);
          setPoly([
            ...poly,
            [Math.round(last[0] + Math.cos(ang) * len), Math.round(last[1] + Math.sin(ang) * len)],
          ]);
          setTyped('');
        } else closePoly();
      }
      return;
    }
    if (k === 'Escape') {
      setPoly([]);
      setDrag(null);
      setTyped('');
      setMeasure([]);
      if (tool !== 'select') setTool('select');
      else onSelect([]);
      return;
    }
    if ((k === 'Delete' || k === 'Backspace') && selection.length && storey && !limited) {
      e.preventDefault();
      run(selection.length > 1 ? 'Delete rooms' : 'Delete room', deleteRooms(storey.id, selection));
      onSelect([]);
      return;
    }
    if (k === 'PageUp' || k === 'PageDown') {
      e.preventDefault();
      const i = doc.storeys.findIndex((s) => s.id === storey?.id);
      const next = doc.storeys[i + (k === 'PageUp' ? 1 : -1)];
      if (next) props.onStorey?.(next.id);
      return;
    }
    if (k === '+' || k === '=') return zoomAt(1 / 1.25);
    if (k === '-' || k === '_') return zoomAt(1.25);
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      const s = 0.08;
      return pan(
        k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0,
        k === 'ArrowUp' ? -s : k === 'ArrowDown' ? s : 0,
      );
    }
    if (mod || e.altKey) return;
    const t = TOOLS.find((x) => x.key.toLowerCase() === k.toLowerCase());
    if (t && (!limited || PHONE_TOOLS.includes(t.id))) {
      e.preventDefault();
      setTool(t.id);
      setPoly([]);
      setTyped('');
    }
  };

  // ------------------------------------------------------------------ drawing

  const px = mmPerPx;
  const tools = limited ? TOOLS.filter((t) => PHONE_TOOLS.includes(t.id)) : TOOLS;
  const moveDelta = drag?.kind === 'move' ? drag.delta : null;
  const preview: PointMm[] | null =
    drag?.kind === 'rect'
      ? rect(drag.a, drag.b)
      : tool === 'poly' && poly.length && hover
        ? [...poly, hover]
        : null;
  const splitHover = tool === 'split' && hover ? roomAt(hover) : undefined;

  return (
    <div
      className="ib-editor"
      data-tool={tool}
      data-limited={limited ? '' : undefined}
      ref={boxRef}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the plan takes keyboard tool shortcuts
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => setShiftDown(e.shiftKey)}
      aria-label={`Plan of ${storey?.name ?? 'the storey'}. Tool: ${TOOLS.find((t) => t.id === tool)?.label}. Press question mark for keys.`}
      role="application"
    >
      <svg
        ref={svgRef}
        className="ib-editor__svg"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onWheel={onWheel}
        onDoubleClick={() => tool === 'poly' && closePoly()}
        aria-hidden="true"
      >
        <defs>
          <Patterns px={px} />
        </defs>
        <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="url(#ibp-grid)" />
        {props.underlayUrl && storey?.underlay ? <Underlay storey={storey} url={props.underlayUrl} /> : null}
        {below && below.id !== storey?.id
          ? (below.rooms as Room2D[]).map((r) => (
              <path
                key={`g${r.id}`}
                d={ringPath(r.floor.outer)}
                className="ib-editor__ghost"
                strokeWidth={px}
              />
            ))
          : null}
        {rooms.map((r) => {
          const sel = selection.includes(r.id);
          const fn = spaceFunction(r.spaceTypeId);
          const paint = props.paint?.(r);
          const flags = flagged.get(r.id);
          const d =
            moveDelta && selection.includes(r.id) ? `translate(${moveDelta[0]} ${-moveDelta[1]})` : undefined;
          return (
            <g key={r.id} transform={d} className="ib-editor__room" data-selected={sel ? '' : undefined}>
              <path
                d={ringPath(r.floor.outer)}
                className="ib-editor__floor"
                style={paint ? { fill: paint } : undefined}
              />
              {!paint && fn && fn.hatch !== 'none' ? (
                <path
                  d={ringPath(r.floor.outer)}
                  fill={`url(#ibp-${fn.hatch})`}
                  className="ib-editor__hatch"
                />
              ) : null}
              {flags?.has('overlap') ? <path d={ringPath(r.floor.outer)} fill="url(#ibp-warn)" /> : null}
              {!r.spaceTypeId ? (
                <path
                  d={ringPath(r.floor.outer)}
                  className="ib-editor__untyped"
                  strokeWidth={1.5 * px}
                  strokeDasharray={`${6 * px} ${4 * px}`}
                />
              ) : null}
              <Walls room={r} px={px} flags={flagged} />
              {sel ? (
                <path d={ringPath(r.floor.outer)} className="ib-editor__sel" strokeWidth={3 * px} />
              ) : null}
            </g>
          );
        })}
        {rooms.map((r) => (
          <RoomLabel key={`l${r.id}`} room={r} px={px} />
        ))}
        {preview ? (
          <g className="ib-editor__preview">
            <path
              d={tool === 'poly' ? `M${preview.map(P).join('L')}` : ringPath(preview)}
              strokeWidth={1.5 * px}
            />
            {preview.map((p, i) => {
              const q = preview[(i + 1) % preview.length] as PointMm;
              if (tool === 'poly' && i === preview.length - 1) return null;
              // biome-ignore lint/suspicious/noArrayIndexKey: edges of the preview ring are positional
              return <DimTag key={`${p[0]},${p[1]},${i}`} a={p} b={q} px={px} />;
            })}
          </g>
        ) : null}
        {splitHover && hover ? <SplitGuide room={splitHover} at={hover} px={px} flip={shiftDown} /> : null}
        {measure.length ? (
          <g className="ib-editor__measure">
            {measure.length === 2 ? (
              <DimTag a={measure[0] as PointMm} b={measure[1] as PointMm} px={px} />
            ) : hover ? (
              <DimTag a={measure[0] as PointMm} b={hover} px={px} />
            ) : null}
          </g>
        ) : null}
        {hover && tool !== 'select' ? (
          <circle cx={hover[0]} cy={-hover[1]} r={4 * px} className="ib-editor__cursor" strokeWidth={px} />
        ) : null}
      </svg>

      <div className="ib-editor__rail" role="toolbar" aria-label="Plan tools" aria-orientation="vertical">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            className="ib-editor__tool"
            aria-pressed={tool === t.id}
            title={`${t.label} (${t.key}): ${t.hint}`}
            onClick={() => {
              setTool(t.id);
              setPoly([]);
              boxRef.current?.focus();
            }}
          >
            <ToolGlyph id={t.id} />
            <span className="ib-editor__tool-label">{t.label}</span>
            <kbd className="ib-editor__tool-key">{t.key}</kbd>
          </button>
        ))}
        <span className="ib-editor__rail-gap" />
        <button
          type="button"
          className="ib-editor__tool"
          onClick={props.onUndo}
          disabled={!props.canUndo}
          title="Undo (Ctrl Z)"
        >
          <ToolGlyph id="undo" />
          <span className="ib-editor__tool-label">Undo</span>
        </button>
        <button
          type="button"
          className="ib-editor__tool"
          onClick={props.onRedo}
          disabled={!props.canRedo}
          title="Redo (Ctrl Shift Z)"
        >
          <ToolGlyph id="redo" />
          <span className="ib-editor__tool-label">Redo</span>
        </button>
      </div>

      <div className="ib-editor__zoom" role="toolbar" aria-label="View">
        <button type="button" onClick={() => zoomAt(1 / 1.25)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomAt(1.25)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={() => setView(fitView(storey, aspect))} aria-label="Fit the plan">
          Fit
        </button>
        <button type="button" onClick={() => pan(-0.15, 0)} aria-label="Pan left" className="ib-editor__pan">
          ←
        </button>
        <button type="button" onClick={() => pan(0.15, 0)} aria-label="Pan right" className="ib-editor__pan">
          →
        </button>
        <button type="button" onClick={() => pan(0, -0.15)} aria-label="Pan up" className="ib-editor__pan">
          ↑
        </button>
        <button type="button" onClick={() => pan(0, 0.15)} aria-label="Pan down" className="ib-editor__pan">
          ↓
        </button>
      </div>

      {tool === 'brush' ? (
        <fieldset className="ib-editor__palette" aria-label="Room function">
          {SPACE_FUNCTIONS.slice(0, 12).map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={brush === f.id}
              className="ib-editor__swatch"
              onClick={() => (props.onBrushFunction ? props.onBrushFunction(f.id) : setBrushLocal(f.id))}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" width="20" height="20">
                <rect
                  x="0.5"
                  y="0.5"
                  width="19"
                  height="19"
                  fill={`url(#ibp-sw-${f.hatch})`}
                  className="ib-editor__swatch-box"
                />
              </svg>
              {f.label}
            </button>
          ))}
          <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
            <defs>
              <Patterns px={0.12} prefix="ibp-sw-" />
            </defs>
          </svg>
        </fieldset>
      ) : null}

      <div className="ib-editor__status" aria-live="polite">
        <span>{TOOLS.find((t) => t.id === tool)?.hint}</span>
        {typed ? <code className="ib-editor__typed">{typed}</code> : null}
        {limited ? (
          <span className="ib-editor__limited">
            Drawing a building needs a bigger screen. You can still change rooms here.
          </span>
        ) : null}
      </div>

      <div
        className="ib-editor__north"
        aria-hidden="true"
        style={{ transform: `rotate(${-doc.rotationMdeg / 1000}deg)` }}
      >
        <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
          <path d="M12 2L16 18L12 15L8 18Z" />
        </svg>
        <span>N</span>
      </div>
      <ScaleBar mmPerPx={mmPerPx} />
      {props.overlay ? <div className="ib-editor__overlay">{props.overlay}</div> : null}
    </div>
  );
}

// ------------------------------------------------------------------ drawing parts

function Walls({ room, px, flags }: { room: Room2D; px: number; flags: Map<string, Set<string>> }) {
  return (
    <>
      {room.segments.map((s, i) => {
        const [a, b] = edge(room.floor.outer, i);
        const outdoor = s.boundary.kind === 'outdoors' || s.boundary.kind === 'ground';
        const len = edgeLength([a, b]);
        const wall = (
          <line
            key={s.id}
            x1={a[0]}
            y1={-a[1]}
            x2={b[0]}
            y2={-b[1]}
            className={outdoor ? 'ib-editor__wall' : 'ib-editor__partition'}
            strokeWidth={outdoor ? Math.max(230, 3 * px) : Math.max(100, 1.2 * px)}
          />
        );
        const parts: ReactNode[] = [wall];
        const ux = (b[0] - a[0]) / (len || 1);
        const uy = (b[1] - a[1]) / (len || 1);
        // Outward normal of a CCW ring.
        const nx = uy;
        const ny = -ux;
        if (outdoor && s.window.kind !== 'none' && len > 0) {
          const share =
            s.window.kind === 'ratio' || s.window.kind === 'repeating'
              ? Math.min(0.94, (s.window.wwrPm / 1000) * 2.4)
              : 0.4;
          const w = len * share;
          const t0 = (len - w) / 2;
          const x0 = a[0] + ux * t0;
          const y0 = a[1] + uy * t0;
          const x1 = x0 + ux * w;
          const y1 = y0 + uy * w;
          const off = Math.max(70, px);
          const bad = flags.get(s.id)?.has('window-over-wall');
          parts.push(
            <g key={`${s.id}w`} className="ib-editor__window" data-bad={bad ? '' : undefined}>
              <line
                x1={x0}
                y1={-y0}
                x2={x1}
                y2={-y1}
                strokeWidth={Math.max(230, 3 * px)}
                className="ib-editor__window-gap"
              />
              <line x1={x0} y1={-y0} x2={x1} y2={-y1} strokeWidth={px} />
              <line
                x1={x0 + nx * off}
                y1={-(y0 + ny * off)}
                x2={x1 + nx * off}
                y2={-(y1 + ny * off)}
                strokeWidth={px}
              />
              <line
                x1={x0 - nx * off}
                y1={-(y0 - ny * off)}
                x2={x1 - nx * off}
                y2={-(y1 - ny * off)}
                strokeWidth={px}
              />
            </g>,
          );
        }
        for (const sh of s.shading) {
          const depth =
            sh.kind === 'overhang' || sh.kind === 'fins' || sh.kind === 'balcony'
              ? sh.depth
              : sh.kind === 'screen'
                ? sh.offset
                : 500;
          const ox = nx * (depth + 115);
          const oy = ny * (depth + 115);
          const mx = (a[0] + b[0]) / 2 + ox;
          const my = (a[1] + b[1]) / 2 + oy;
          parts.push(
            <g key={`${s.id}${sh.kind}`} className="ib-editor__shade">
              {sh.kind === 'fins' ? (
                Array.from({ length: Math.max(2, Math.floor(len / 3000)) }, (_, k) => {
                  const t = (len * (k + 0.5)) / Math.max(2, Math.floor(len / 3000));
                  const fx = a[0] + ux * t;
                  const fy = a[1] + uy * t;
                  return (
                    <line
                      // biome-ignore lint/suspicious/noArrayIndexKey: fins are positional
                      key={k}
                      x1={fx}
                      y1={-fy}
                      x2={fx + nx * (depth + 115)}
                      y2={-(fy + ny * (depth + 115))}
                      strokeWidth={1.2 * px}
                    />
                  );
                })
              ) : (
                <line
                  x1={a[0] + ox}
                  y1={-(a[1] + oy)}
                  x2={b[0] + ox}
                  y2={-(b[1] + oy)}
                  strokeWidth={1.2 * px}
                  strokeDasharray={`${5 * px} ${3 * px}`}
                />
              )}
              <text
                x={mx + nx * 10 * px}
                y={-(my + ny * 10 * px)}
                fontSize={9 * px}
                className="ib-editor__tag"
                textAnchor="middle"
              >
                {sh.kind === 'fins'
                  ? 'fins'
                  : sh.kind === 'screen'
                    ? 'jaali'
                    : `${(depth / 1000).toFixed(2)} m`}
              </text>
            </g>,
          );
        }
        return parts;
      })}
    </>
  );
}

function RoomLabel({ room, px }: { room: Room2D; px: number }) {
  const b = bbox(room.floor.outer);
  const wPx = (b.x1 - b.x0) / px;
  const hPx = (b.y1 - b.y0) / px;
  if (wPx < 34 || hPx < 22) return null;
  const [cx, cy] = centroid(room.floor.outer);
  const fn = spaceFunction(room.spaceTypeId);
  const name = room.name ?? fn?.label ?? 'Unknown use';
  const fs = Math.min(11, Math.max(8, wPx / 9)) * px;
  return (
    <g className="ib-editor__label" data-untyped={room.spaceTypeId ? undefined : ''}>
      <text x={cx} y={-cy} fontSize={fs} textAnchor="middle" className="ib-editor__name">
        {wPx < 70 && fn ? fn.short : name}
      </text>
      {hPx > 36 ? (
        <text x={cx} y={-cy + fs * 1.25} fontSize={fs * 0.85} textAnchor="middle" className="ib-editor__area">
          {areaM2(room.floor).toFixed(1)} m²
        </text>
      ) : null}
    </g>
  );
}

function DimTag({ a, b, px }: { a: PointMm; b: PointMm; px: number }) {
  const len = edgeLength([a, b]);
  if (len < 1) return null;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  return (
    <g className="ib-editor__dim">
      <rect x={mx - 26 * px} y={-my - 8 * px} width={52 * px} height={14 * px} />
      <text x={mx} y={-my + 2.5 * px} fontSize={9 * px} textAnchor="middle">
        {(len / 1000).toFixed(2)} m
      </text>
    </g>
  );
}

function SplitGuide({ room, at, px, flip }: { room: Room2D; at: PointMm; px: number; flip: boolean }) {
  const b = bbox(room.floor.outer);
  const wide = b.x1 - b.x0 >= b.y1 - b.y0;
  const vertical = wide !== flip;
  return vertical ? (
    <line
      x1={at[0]}
      y1={-b.y0}
      x2={at[0]}
      y2={-b.y1}
      className="ib-editor__split"
      strokeWidth={1.5 * px}
      strokeDasharray={`${6 * px} ${4 * px}`}
    />
  ) : (
    <line
      x1={b.x0}
      y1={-at[1]}
      x2={b.x1}
      y2={-at[1]}
      className="ib-editor__split"
      strokeWidth={1.5 * px}
      strokeDasharray={`${6 * px} ${4 * px}`}
    />
  );
}

function Underlay({ storey, url }: { storey: Storey; url: string }) {
  const u = storey.underlay;
  if (!u) return null;
  // Calibrated: the image's pixel distance a to b equals `distance` mm. Uncalibrated: 1 px = 10 mm.
  const k = u.calibration
    ? u.calibration.distance /
      Math.max(
        1,
        Math.hypot(u.calibration.b[0] - u.calibration.a[0], u.calibration.b[1] - u.calibration.a[1]),
      )
    : 10;
  return (
    <image
      href={url}
      x={0}
      y={-1000 * k}
      width={1000 * k}
      height={1000 * k}
      opacity={u.opacityPm / 1000}
      preserveAspectRatio="xMinYMin meet"
      className="ib-editor__underlay"
    />
  );
}

function ScaleBar({ mmPerPx }: { mmPerPx: number }) {
  const target = mmPerPx * 110;
  const steps = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const len = steps.find((s) => s >= target) ?? 100000;
  return (
    <div className="ib-editor__scale" aria-hidden="true">
      <span className="ib-editor__scale-bar" style={{ inlineSize: `${len / mmPerPx}px` }} />
      <span>{len / 1000} m</span>
    </div>
  );
}

function Patterns({ px, prefix = 'ibp-' }: { px: number; prefix?: string }) {
  const s = 8 * px;
  const w = 0.7 * px;
  const line = (d: string, id: string) => (
    <pattern id={`${prefix}${id}`} key={id} patternUnits="userSpaceOnUse" width={s} height={s}>
      <path d={d} className="ib-editor__hatchline" strokeWidth={w} />
    </pattern>
  );
  return (
    <>
      <pattern id={`${prefix}grid`} patternUnits="userSpaceOnUse" width={5000} height={5000}>
        <path d="M5000 0H0V5000" className="ib-editor__grid5" strokeWidth={px} fill="none" />
        <path
          d="M1000 0V5000M2000 0V5000M3000 0V5000M4000 0V5000M0 1000H5000M0 2000H5000M0 3000H5000M0 4000H5000"
          className="ib-editor__grid1"
          strokeWidth={0.6 * px}
          fill="none"
        />
      </pattern>
      {line(`M0 ${s}L${s} 0`, 'diag')}
      {line(`M0 0L${s} ${s}`, 'diag-back')}
      {line(`M0 ${s}L${s} 0M0 0L${s} ${s}`, 'cross')}
      {line(`M0 ${s / 2}H${s}`, 'horiz')}
      {line(`M${s / 2} 0V${s}`, 'vert')}
      {line(`M0 ${s / 2}H${s}M${s / 2} 0V${s}`, 'grid')}
      {line(`M0 ${s * 0.75}H${s / 2}V${s / 4}H${s}`, 'steps')}
      {line(`M0 ${s / 2}Q${s / 4} 0 ${s / 2} ${s / 2}T${s} ${s / 2}`, 'wave')}
      <pattern id={`${prefix}dots`} patternUnits="userSpaceOnUse" width={s} height={s}>
        <circle cx={s / 2} cy={s / 2} r={0.9 * px} className="ib-editor__hatchdot" />
      </pattern>
      <pattern id={`${prefix}sparse`} patternUnits="userSpaceOnUse" width={2 * s} height={2 * s}>
        <circle cx={s} cy={s} r={0.7 * px} className="ib-editor__hatchdot" />
      </pattern>
      <pattern id={`${prefix}warn`} patternUnits="userSpaceOnUse" width={s} height={s}>
        <path d={`M0 ${s}L${s} 0`} className="ib-editor__warnline" strokeWidth={1.4 * px} />
      </pattern>
    </>
  );
}

const GLYPH: Record<string, string> = {
  select: 'M6 4L18 12L12.5 13L15.5 19L13.5 20L10.5 14L6 18Z',
  rect: 'M5 7H19V17H5Z',
  poly: 'M5 17L7 6L15 5L19 12L13 18Z',
  split: 'M5 6H19V18H5ZM12 3V21',
  merge: 'M4 7H11V17H4ZM13 7H20V17H13ZM10 12H14',
  opening: 'M4 12H8M16 12H20M8 10H16M8 14H16',
  shade: 'M4 8H20M6 8V18M18 8V18M8 11H16',
  brush: 'M6 18L10 14M10 14L18 6L20 8L12 16ZM5 19H8',
  measure: 'M4 15L15 4L20 9L9 20ZM8 11L10 13M11 8L13 10M14 5L16 7',
  undo: 'M9 7L5 11L9 15M5 11H14A5 5 0 0 1 14 21H11',
  redo: 'M15 7L19 11L15 15M19 11H10A5 5 0 0 0 10 21H13',
};

function ToolGlyph({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="ib-editor__glyph">
      <path d={GLYPH[id] ?? ''} />
    </svg>
  );
}
