type Point = [number, number];
type Stroke = Point[];

// Normalized coords: x/y in 0..1, y=0 top, y=1 bottom
const GLYPHS: Record<string, Stroke[]> = {
  A: [
    [[0.50, 0.04], [0.08, 0.96]],
    [[0.50, 0.04], [0.92, 0.96]],
    [[0.21, 0.60], [0.79, 0.60]],
  ],
  B: [
    [[0.20, 0.96], [0.20, 0.04]],
    [[0.20, 0.04], [0.62, 0.06], [0.80, 0.18], [0.78, 0.36], [0.60, 0.48], [0.20, 0.50]],
    [[0.20, 0.50], [0.65, 0.52], [0.84, 0.65], [0.82, 0.84], [0.62, 0.96], [0.20, 0.96]],
  ],
  C: [
    [[0.88, 0.18], [0.68, 0.04], [0.32, 0.04], [0.10, 0.20], [0.04, 0.50], [0.10, 0.80], [0.32, 0.96], [0.68, 0.96], [0.88, 0.82]],
  ],
  D: [
    [[0.22, 0.04], [0.22, 0.96]],
    [[0.22, 0.04], [0.56, 0.06], [0.82, 0.20], [0.90, 0.50], [0.82, 0.80], [0.56, 0.94], [0.22, 0.96]],
  ],
  E: [
    [[0.20, 0.04], [0.20, 0.96]],
    [[0.20, 0.04], [0.82, 0.04]],
    [[0.20, 0.50], [0.68, 0.50]],
    [[0.20, 0.96], [0.82, 0.96]],
  ],
  F: [
    [[0.22, 0.04], [0.22, 0.96]],
    [[0.22, 0.04], [0.82, 0.04]],
    [[0.22, 0.50], [0.70, 0.50]],
  ],
  G: [
    [[0.88, 0.18], [0.68, 0.04], [0.32, 0.04], [0.10, 0.20], [0.04, 0.50], [0.10, 0.80], [0.32, 0.96], [0.70, 0.96], [0.88, 0.80], [0.88, 0.52], [0.58, 0.52]],
  ],
  H: [
    [[0.20, 0.04], [0.20, 0.96]],
    [[0.80, 0.04], [0.80, 0.96]],
    [[0.20, 0.50], [0.80, 0.50]],
  ],
  I: [
    [[0.50, 0.04], [0.50, 0.96]],
    [[0.26, 0.04], [0.74, 0.04]],
    [[0.26, 0.96], [0.74, 0.96]],
  ],
  J: [
    [[0.60, 0.04], [0.60, 0.78], [0.50, 0.94], [0.32, 0.96], [0.18, 0.82]],
    [[0.40, 0.04], [0.80, 0.04]],
  ],
  K: [
    [[0.22, 0.04], [0.22, 0.96]],
    [[0.78, 0.04], [0.22, 0.50]],
    [[0.22, 0.50], [0.80, 0.96]],
  ],
  L: [
    [[0.26, 0.04], [0.26, 0.96]],
    [[0.26, 0.96], [0.80, 0.96]],
  ],
  M: [
    [[0.08, 0.96], [0.08, 0.04], [0.50, 0.58], [0.92, 0.04], [0.92, 0.96]],
  ],
  N: [
    [[0.18, 0.96], [0.18, 0.04], [0.82, 0.96], [0.82, 0.04]],
  ],
  O: [
    [[0.50, 0.04], [0.82, 0.08], [0.96, 0.30], [0.96, 0.70], [0.82, 0.92], [0.50, 0.96], [0.18, 0.92], [0.04, 0.70], [0.04, 0.30], [0.18, 0.08], [0.50, 0.04]],
  ],
  P: [
    [[0.20, 0.96], [0.20, 0.04]],
    [[0.20, 0.04], [0.64, 0.06], [0.82, 0.20], [0.80, 0.38], [0.62, 0.50], [0.20, 0.50]],
  ],
  Q: [
    [[0.50, 0.04], [0.82, 0.08], [0.96, 0.30], [0.96, 0.70], [0.82, 0.92], [0.50, 0.96], [0.18, 0.92], [0.04, 0.70], [0.04, 0.30], [0.18, 0.08], [0.50, 0.04]],
    [[0.62, 0.72], [0.90, 0.96]],
  ],
  R: [
    [[0.20, 0.96], [0.20, 0.04]],
    [[0.20, 0.04], [0.62, 0.06], [0.82, 0.18], [0.80, 0.36], [0.62, 0.48], [0.20, 0.50]],
    [[0.44, 0.50], [0.88, 0.96]],
  ],
  S: [
    [[0.84, 0.14], [0.64, 0.04], [0.28, 0.05], [0.12, 0.20], [0.14, 0.38], [0.34, 0.48], [0.66, 0.52], [0.86, 0.62], [0.88, 0.80], [0.72, 0.95], [0.36, 0.96], [0.16, 0.86]],
  ],
  T: [
    [[0.50, 0.04], [0.50, 0.96]],
    [[0.10, 0.04], [0.90, 0.04]],
  ],
  U: [
    [[0.18, 0.04], [0.18, 0.74], [0.26, 0.90], [0.50, 0.96], [0.74, 0.90], [0.82, 0.74], [0.82, 0.04]],
  ],
  V: [
    [[0.08, 0.04], [0.50, 0.96], [0.92, 0.04]],
  ],
  W: [
    [[0.05, 0.04], [0.24, 0.94], [0.50, 0.46], [0.76, 0.94], [0.95, 0.04]],
  ],
  X: [
    [[0.10, 0.04], [0.90, 0.96]],
    [[0.90, 0.04], [0.10, 0.96]],
  ],
  Y: [
    [[0.10, 0.04], [0.50, 0.52]],
    [[0.90, 0.04], [0.50, 0.52]],
    [[0.50, 0.52], [0.50, 0.96]],
  ],
  Z: [
    [[0.12, 0.04], [0.88, 0.04], [0.12, 0.96], [0.88, 0.96]],
  ],
};

// Seeded xorshift32
function makeRng(seed: number) {
  let s = (seed ^ 0xdeadbeef) | 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

// Catmull-rom spline through points
function drawSpline(ctx: CanvasRenderingContext2D, pts: Point[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 2) {
    ctx.lineTo(pts[1][0], pts[1][1]);
    return;
  }
  const p: Point[] = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    const cp1x = p[i][0] + (p[i + 1][0] - p[i - 1][0]) / 6;
    const cp1y = p[i][1] + (p[i + 1][1] - p[i - 1][1]) / 6;
    const cp2x = p[i + 1][0] - (p[i + 2][0] - p[i][0]) / 6;
    const cp2y = p[i + 1][1] - (p[i + 2][1] - p[i][1]) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p[i + 1][0], p[i + 1][1]);
  }
}

function perturbStroke(stroke: Stroke, rng: () => number, amount: number): Stroke {
  return stroke.map(([x, y]) => [
    x + (rng() - 0.5) * 2 * amount,
    y + (rng() - 0.5) * 2 * amount,
  ]);
}

export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  char: string,
  cx: number,
  cy: number,
  slotW: number,
  slotH: number,
  seed: number
) {
  const strokes = GLYPHS[char.toUpperCase()];
  if (!strokes) return;

  const rng = makeRng(seed);
  const pad = 0.12;
  const scaleX = slotW * (1 - 2 * pad);
  const scaleY = slotH * (1 - 2 * pad);
  const ox = cx - slotW / 2 + slotW * pad;
  const oy = cy - slotH / 2 + slotH * pad;

  const toCanvas = ([nx, ny]: Point): Point => [ox + nx * scaleX, oy + ny * scaleY];

  const baseWidth = Math.min(slotW, slotH) * 0.072;
  const noiseAmt = 0.022 + rng() * 0.026;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#fff';

  for (const stroke of strokes) {
    // Primary pass
    const pts1 = perturbStroke(stroke, rng, noiseAmt).map(toCanvas);
    ctx.lineWidth = baseWidth * (0.88 + rng() * 0.24);
    ctx.globalAlpha = 0.82 + rng() * 0.18;
    drawSpline(ctx, pts1);
    ctx.stroke();

    // Offset shadow pass — gives the layered ink feel
    const pts2 = perturbStroke(stroke, rng, noiseAmt * 0.7).map(toCanvas);
    ctx.lineWidth = baseWidth * (0.28 + rng() * 0.32);
    ctx.globalAlpha = 0.28 + rng() * 0.22;
    drawSpline(ctx, pts2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
