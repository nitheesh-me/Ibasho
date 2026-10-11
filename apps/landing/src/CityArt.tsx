/**
 * The hero drawing: a paper model of a city block on a table, lit by a low sun (DESIGN_SYSTEM 13.1).
 * Owner: WP-09. Decorative and static: drawn once at build time from a few boxes in isometric view.
 *
 * Your building is a courtyard ring in ink with lit windows. One tower has an estimated height: it
 * casts a solid shadow at its likely height and a hatched band out to its plausible height (the
 * penumbra of not knowing, PLAN-V3 6). Colours are Andon tokens only, so day and night both work.
 */

type Pt = readonly [number, number];

interface Box {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  /** Highest plausible height, when the height is a guess. */
  hMax?: number;
  yours?: boolean;
}

const S = 15;
const OX = 240;
const OY = 132;
/** Shadow cast on the ground per unit of height, in plan units (sun low in the back left). */
const SUN: Pt = [0.62, 0.22];

const iso = (x: number, y: number, z = 0): Pt => [OX + (x - y) * 0.866 * S, OY + (x + y) * 0.5 * S - z * S];
const pts = (ps: readonly Pt[]) => ps.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');

/** Convex hull (monotone chain), for a box footprint swept along the sun. */
function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0)
      lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0)
      upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function shadow(b: Box, h: number): string {
  const base: Pt[] = [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x + b.w, b.y + b.d],
    [b.x, b.y + b.d],
  ];
  const tip = base.map(([x, y]): Pt => [x + h * SUN[0], y + h * SUN[1]]);
  return pts(hull([...base, ...tip]).map(([x, y]) => iso(x, y)));
}

const BOXES: readonly Box[] = [
  { x: 1, y: 1.5, w: 3, d: 2, h: 2 },
  { x: 7, y: 0.5, w: 2, d: 2, h: 5, hMax: 7.5 },
  { x: 10, y: 3, w: 2, d: 3, h: 3 },
  { x: 1, y: 7.5, w: 2.5, d: 2.5, h: 1.5 },
  { x: 10.2, y: 8.6, w: 1.8, d: 1.8, h: 4 },
  { x: 6, y: 11, w: 3.4, d: 1.2, h: 1.2 },
  // Your building: a courtyard ring of shallow wings.
  { x: 4, y: 4, w: 5, d: 1.2, h: 2.2, yours: true },
  { x: 4, y: 5.2, w: 1.2, d: 2.6, h: 2.2, yours: true },
  { x: 7.8, y: 5.2, w: 1.2, d: 2.6, h: 2.2, yours: true },
  { x: 4, y: 7.8, w: 5, d: 1.2, h: 2.2, yours: true },
];

/** Back to front, so nearer boxes paint over farther ones. */
const ORDER = [...BOXES].sort((a, b) => a.x + a.w / 2 + a.y + a.d / 2 - (b.x + b.w / 2 + b.y + b.d / 2));

function Windows({ b }: { b: Box }) {
  const out: string[] = [];
  const rows = [0.75, 1.55];
  // Front left face (y = y + d) and front right face (x = x + w), one mark per unit of length.
  for (const z of rows) {
    for (let t = 0.35; t < b.w - 0.2; t += 0.9) {
      const [a, c] = [iso(b.x + t, b.y + b.d, z), iso(b.x + t + 0.45, b.y + b.d, z)];
      out.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${c[0].toFixed(1)} ${c[1].toFixed(1)}`);
    }
    for (let t = 0.35; t < b.d - 0.2; t += 0.9) {
      const [a, c] = [iso(b.x + b.w, b.y + t, z), iso(b.x + b.w, b.y + t + 0.45, z)];
      out.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${c[0].toFixed(1)} ${c[1].toFixed(1)}`);
    }
  }
  return <path className="lp-city__win" d={out.join('')} />;
}

function Block({ b }: { b: Box }) {
  const { x, y, w, d, h } = b;
  const top = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
  const left = [iso(x, y + d, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x, y + d, h)];
  const right = [iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x + w, y, h)];
  const cls = b.yours ? 'lp-city__box lp-city__box--yours' : 'lp-city__box';
  return (
    <g className={cls}>
      <polygon className="lp-city__face-l" points={pts(left)} />
      <polygon className="lp-city__face-r" points={pts(right)} />
      <polygon className="lp-city__face-t" points={pts(top)} />
      {b.hMax ? (
        <>
          {/* The estimated top band: pencil hatch between the likely and the plausible height. */}
          <polygon
            className="lp-city__guess"
            points={pts([
              iso(x, y + d, h),
              iso(x + w, y + d, h),
              iso(x + w, y + d, b.hMax),
              iso(x, y + d, b.hMax),
            ])}
          />
          <polygon
            className="lp-city__guess"
            points={pts([
              iso(x + w, y, h),
              iso(x + w, y + d, h),
              iso(x + w, y + d, b.hMax),
              iso(x + w, y, b.hMax),
            ])}
          />
          <polygon
            className="lp-city__guess-top"
            points={pts([
              iso(x, y, b.hMax),
              iso(x + w, y, b.hMax),
              iso(x + w, y + d, b.hMax),
              iso(x, y + d, b.hMax),
            ])}
          />
        </>
      ) : null}
      {b.yours ? <Windows b={b} /> : null}
    </g>
  );
}

export function CityArt() {
  const ground = [iso(-0.5, -0.5), iso(13, -0.5), iso(13, 13), iso(-0.5, 13)];
  const contours = [2, 5, 8, 11].map((k) => `M${pts([iso(-0.5, k), iso(13, k)]).replace(' ', 'L')}`);
  const [sx, sy] = [96, 54];
  return (
    <svg className="lp-city" viewBox="0 0 480 360" aria-hidden="true" focusable="false">
      <defs>
        <pattern
          id="lp-hatch"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path d="M0 0V5" className="lp-city__hatch-line" />
        </pattern>
        <radialGradient id="lp-sun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--glow)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--glow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* The sun's path across the day, and the sun low in the morning sky. */}
      <path className="lp-city__arc" d="M24 168 Q240 -70 456 168" />
      <circle cx={sx} cy={sy} r="34" fill="url(#lp-sun-glow)" />
      <circle className="lp-city__sun" cx={sx} cy={sy} r="9" />
      <polygon className="lp-city__ground" points={pts(ground)} />
      <path className="lp-city__contour" d={contours.join('')} />
      {BOXES.filter((b) => b.hMax).map((b) => (
        <polygon key={`p${b.x}${b.y}`} className="lp-city__penumbra" points={shadow(b, b.hMax!)} />
      ))}
      {BOXES.map((b) => (
        <polygon key={`s${b.x}${b.y}`} className="lp-city__shadow" points={shadow(b, b.h)} />
      ))}
      {ORDER.map((b) => (
        <Block key={`b${b.x}${b.y}`} b={b} />
      ))}
      <path className="lp-city__north" d="M440 300l8 -22l8 22l-8 -6z" />
      <text className="lp-city__n" x="448" y="320" textAnchor="middle">
        N
      </text>
    </svg>
  );
}
