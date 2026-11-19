/**
 * Geometría del bajo ilustrado de la configuración y Ajustes. Módulo puro (sin
 * React ni APIs de plataforma) para poder probarlo.
 *
 * El bajo se modela en 3D con perfiles extruidos: cuerpo, mástil, diapasón,
 * pala, pastillas, puente, mandos y clavijas. Cada fotograma gira el modelo
 * sobre el eje largo del instrumento (el eje de la plataforma giratoria cuando
 * el bajo está de pie), lo proyecta en ortográfica y ordena las capas por
 * profundidad. El resultado son trazados SVG con un material y un factor de luz;
 * los colores los pone el componente con los tokens del tema.
 *
 * Coordenadas del modelo: x crece del puente hacia la pala, y cruza el
 * instrumento (negativo hacia la cuerda grave, como lo ve quien lo toca) y z
 * sale de la tapa hacia el público. Las unidades son ~1,6 mm.
 */

export type Pt = readonly [number, number];

export const VIEW_W = 780;
export const VIEW_H = 220;
const CY = 110;
export const BRIDGE_X = 119;
/** Fotogramas de una vuelta completa (22,5° cada uno). */
export const FRAME_COUNT = 16;

// Alturas (z) de cada pieza. El cuerpo tiene 24 unidades de grosor (~38 mm).
const Z_FRONT = 12;
const Z_BACK = -12;
const Z_GUARD = 12.7;
const Z_PICKUP = 15.5;
const Z_BOARD_BASE = 14.5;
const Z_BOARD = 18;
const Z_NECK_BACK = 5;
const Z_HEAD = 14;
const HEEL_X = 296;

export type Paint =
  | 'burst'
  | 'lacquer'
  | 'maple'
  | 'mapleRound'
  | 'board'
  | 'guard'
  | 'guardEdge'
  | 'black'
  | 'metal'
  | 'chrome'
  | 'string'
  | 'shine'
  | 'inlay'
  | 'bone'
  | 'shadow'
  | 'edge';

/** Trazado listo para pintar. `k` es el factor de luz (1 = tapa de frente). */
export type Shape = {
  d: string;
  fill?: Paint;
  stroke?: Paint;
  width?: number;
  k?: number;
  opacity?: number;
  /** Recortado por la silueta del cuerpo (vetas y biseles). */
  clip?: boolean;
};

/** `viewX`: origen horizontal del encuadre (el bajo más largo no cabe sin moverlo). */
export type Frame = { shapes: Shape[]; clip: string; viewX: number };

type Post = { x: number; y: number; string: number; upper: boolean };

export type BassModel = {
  count: number;
  nutX: number;
  fretXs: number[];
  boardEndX: number;
  body: Pt[];
  bodyInset: Pt[];
  guard: Pt[];
  head: Pt[];
  headHalf: number;
  posts: Post[];
  pickups: { x: number; poly: Pt[]; poles: Pt[] }[];
  bridgePlate: Pt[];
  saddles: Pt[][];
  saddleHalf: number;
  /** Extremo de la pala: si pasa del lienzo, el encuadre se desplaza. */
  extentX: number;
  knobs: Pt[];
  controlPlate: Pt[];
  cavity: Pt[];
  neckPlate: Pt[];
  grain: Pt[][];
  /** Botones de la correa, en el talón del cuerpo y en la punta del cuerno. */
  buttons: Pt[];
  halfAt: (x: number) => number;
  stringY: (i: number, x: number) => number;
};

// ---------------------------------------------------------------- utilidades

type Cubic = readonly [Pt, Pt, Pt];

/** Muestrea una sucesión de cúbicas. Devuelve los puntos sin repetir el inicial. */
export function sampleCubics(start: Pt, segments: readonly Cubic[], steps = 12): Pt[] {
  const out: Pt[] = [start];
  let p0 = start;
  for (const [c1, c2, p] of segments) {
    for (let i = 1; i <= steps; i++) {
      const t = i / steps,
        u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p[0],
        u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p[1],
      ]);
    }
    p0 = p;
  }
  const last = out[out.length - 1]!;
  if (Math.hypot(last[0] - start[0], last[1] - start[1]) < 1e-6) out.pop();
  return out;
}

export function signedArea(poly: readonly Pt[]) {
  let a = 0;
  poly.forEach(([x1, y1], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    a += x1 * y2 - x2 * y1;
  });
  return a / 2;
}

/** Normal exterior de cada lado del polígono. */
export function edgeNormals(poly: readonly Pt[]): Pt[] {
  const sign = signedArea(poly) >= 0 ? 1 : -1;
  return poly.map(([x1, y1], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    return [((y2 - y1) / len) * sign, (-(x2 - x1) / len) * sign];
  });
}

/** Desplaza cada vértice hacia dentro `d` unidades (contorno suave). */
export function inset(poly: readonly Pt[], d: number): Pt[] {
  const sign = signedArea(poly) >= 0 ? 1 : -1;
  return poly.map(([x, y], i) => {
    const [ax, ay] = poly[(i - 1 + poly.length) % poly.length]!;
    const [bx, by] = poly[(i + 1) % poly.length]!;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = ((by - ay) / len) * sign,
      ny = (-(bx - ax) / len) * sign;
    return [x - nx * d, y - ny * d];
  });
}

const circle = (cx: number, cy: number, r: number, n = 18, ry = r): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * ry];
  });

function roundRect(cx: number, cy: number, hw: number, hh: number, r: number): Pt[] {
  const out: Pt[] = [];
  const corners: [number, number, number][] = [
    [cx + hw - r, cy + hh - r, 0],
    [cx - hw + r, cy + hh - r, 90],
    [cx - hw + r, cy - hh + r, 180],
    [cx + hw - r, cy - hh + r, 270],
  ];
  for (const [x, y, start] of corners)
    for (let i = 0; i <= 4; i++) {
      const a = ((start + i * 22.5) * Math.PI) / 180;
      out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
  return out;
}

/** Cápsula entre dos puntos (placa de mandos, tapa de la cavidad). */
function capsule(a: Pt, b: Pt, r: number): Pt[] {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const out: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = ang - Math.PI / 2 + (i / 8) * Math.PI;
    out.push([b[0] + Math.cos(t) * r, b[1] + Math.sin(t) * r]);
  }
  for (let i = 0; i <= 8; i++) {
    const t = ang + Math.PI / 2 + (i / 8) * Math.PI;
    out.push([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r]);
  }
  return out;
}

// -------------------------------------------------------------------- modelo

/** Geometría fija de un bajo por número de cuerdas, escala (pulgadas) y trastes. */
export function bassModel(count: number, scale: number, frets: number): BassModel {
  const nutX = BRIDGE_X + scale * 16;
  const fretXs = Array.from(
    { length: frets + 1 },
    (_, f) => BRIDGE_X + (nutX - BRIDGE_X) * 2 ** (-f / 12),
  );
  const boardEndX = fretXs[frets]! - 6;
  const nutHalf = (count - 1) * 2.9 + 3.5;
  const neckHalf = (count - 1) * 4 + 7;
  const halfAt = (x: number) => nutHalf + ((nutX - x) / (nutX - boardEndX)) * (neckHalf - nutHalf);
  const bridgeGap = count === 4 ? 12 : count === 5 ? 10.4 : 9.4;
  const nutGap = (2 * nutHalf - 6) / (count - 1);
  const stringY = (i: number, x: number) => {
    const t = (x - BRIDGE_X) / (nutX - BRIDGE_X);
    return (i - (count - 1) / 2) * (bridgeGap + (nutGap - bridgeGap) * t);
  };

  // Cuerpo de doble cutaway asimétrico: cuerno superior largo, inferior corto.
  const a = halfAt(HEEL_X) + 1.5;
  const body = sampleCubics(
    [HEEL_X, -a],
    [
      [
        [318, -a - 8],
        [348, -46],
        [366, -63],
      ],
      [
        [376, -72],
        [370, -84],
        [356, -81],
      ],
      [
        [326, -76],
        [298, -63],
        [262, -63],
      ],
      [
        [232, -63],
        [212, -91],
        [162, -92],
      ],
      [
        [108, -93],
        [62, -76],
        [50, -36],
      ],
      [
        [41, -6],
        [43, 40],
        [62, 66],
      ],
      [
        [84, 96],
        [134, 96],
        [178, 86],
      ],
      [
        [212, 78],
        [234, 67],
        [266, 67],
      ],
      [
        [290, 67],
        [306, 74],
        [320, 71],
      ],
      [
        [334, 68],
        [335, 53],
        [323, 45],
      ],
      [
        [309, 36],
        [301, a + 6],
        [HEEL_X, a],
      ],
    ],
    14,
  );
  const bodyInset = inset(body, 3.2);
  // Golpeador: rodea la pastilla del mástil y entra en los dos cuernos.
  const guard = sampleCubics(
    [290, -a + 2],
    [
      [
        [296, -a - 4],
        [302, -a - 6],
        [310, -a - 8],
      ],
      [
        [324, -a - 14],
        [338, -46],
        [346, -54],
      ],
      [
        [352, -60],
        [346, -68],
        [334, -67],
      ],
      [
        [300, -63],
        [262, -57],
        [240, -51],
      ],
      [
        [214, -43],
        [190, -30],
        [184, -8],
      ],
      [
        [178, 14],
        [170, 40],
        [178, 57],
      ],
      [
        [186, 71],
        [214, 69],
        [236, 62],
      ],
      [
        [262, 56],
        [290, 62],
        [304, 59],
      ],
      [
        [316, 57],
        [320, 48],
        [312, 43],
      ],
      [
        [304, 40],
        [301, a + 9],
        [297, a + 5],
      ],
      [
        [293, a + 3],
        [291, a],
        [290, a - 2],
      ],
    ],
    10,
  );

  // Pala con clavijas 2+2, 2+3 o 3+3.
  const upper = Math.ceil(count / 2),
    lower = count - upper,
    perSide = Math.max(upper, lower);
  const headHalf = Math.max(nutHalf + 11, 25);
  const L = 30 + (perSide - 1) * 25 + 26;
  const h = headHalf,
    n0 = nutX;
  const head = sampleCubics(
    [n0, -nutHalf],
    [
      [
        [n0 + 8, -nutHalf],
        [n0 + 10, -h],
        [n0 + 22, -h],
      ],
      [
        [n0 + 50, -h],
        [n0 + L - 24, -h - 1.5],
        [n0 + L - 5, -h + 0.5],
      ],
      [
        [n0 + L + 1, -h + 1],
        [n0 + L + 1.5, -h + 5],
        [n0 + L, -h + 8],
      ],
      [
        [n0 + L - 2, 0],
        [n0 + L - 6, h - 6],
        [n0 + L - 9, h - 2],
      ],
      [
        [n0 + L - 10.5, h],
        [n0 + L - 14, h + 0.5],
        [n0 + L - 18, h + 0.5],
      ],
      [
        [n0 + L - 40, h + 0.5],
        [n0 + 40, h],
        [n0 + 22, h],
      ],
      [
        [n0 + 10, h],
        [n0 + 8, nutHalf],
        [n0, nutHalf],
      ],
    ],
    8,
  );
  const posts: Post[] = Array.from({ length: count }, (_, i) => {
    const isUpper = i < upper;
    const j = isUpper ? i : count - 1 - i;
    return { x: n0 + 30 + j * 25, y: (isUpper ? -1 : 1) * (h - 8), string: i, upper: isUpper };
  });

  const spread = (x: number) => Math.abs(stringY(0, x));
  const pickups = [150, 205].map((x) => ({
    x,
    poly: roundRect(x, 0, 9, spread(x) + 9, 4.5),
    poles: Array.from({ length: count }, (_, i): Pt => [x, stringY(i, x)]),
  }));
  const bridgeHalf = spread(BRIDGE_X) + 8;
  const bridgePlate = roundRect(BRIDGE_X - 5, 0, 10, bridgeHalf, 2.5);
  const saddleHalf = bridgeGap * 0.42;
  const saddles = Array.from({ length: count }, (_, i) =>
    roundRect(BRIDGE_X - 1.5, stringY(i, BRIDGE_X), 4.5, saddleHalf, 1),
  );
  const knobs: Pt[] = [
    [92, 48],
    [114, 55],
    [136, 62],
  ];
  const controlPlate = capsule(knobs[0]!, knobs[2]!, 10);
  const cavity = capsule([88, 47], [140, 63], 16);
  const heelHalf = halfAt(HEEL_X);
  const neckPlate = roundRect(273, 0, 17, heelHalf - 2, 3);

  // Vetas suaves de la madera bajo el barniz.
  const grain = Array.from({ length: 11 }, (_, g) => {
    const y0 = -95 + g * 19;
    return Array.from({ length: 30 }, (_, i): Pt => {
      const x = 36 + i * 12;
      return [x, y0 + Math.sin(x / 47 + g * 1.7) * 4 + Math.sin(x / 13 + g) * 0.8];
    });
  });

  const byX = [...body].sort((p, q) => p[0] - q[0]);
  const buttons: Pt[] = [
    [byX[0]![0] + 0.4, byX[0]![1]],
    [byX[byX.length - 1]![0] - 0.4, byX[byX.length - 1]![1]],
  ];

  return {
    buttons,
    saddleHalf,
    extentX: n0 + L + 2,
    count,
    nutX,
    fretXs,
    boardEndX,
    body,
    bodyInset,
    guard,
    head,
    headHalf,
    posts,
    pickups,
    bridgePlate,
    saddles,
    knobs,
    controlPlate,
    cavity,
    neckPlate,
    grain,
    halfAt,
    stringY,
  };
}

// --------------------------------------------------------------- proyección

const LIGHT = (() => {
  const v = [-0.35, -0.55, 0.76];
  const len = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((c) => c / len) as [number, number, number];
})();

/** Ángulo (radianes) de un fotograma. */
export const frameAngle = (frame: number) =>
  ((((frame % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT) / FRAME_COUNT) * Math.PI * 2;

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

/**
 * Proyecta el bajo girado `angle` radianes. `mirror` pone la pala a la
 * izquierda (diestros). En ambos casos la cuerda grave queda abajo, como al
 * mirar de frente a quien toca.
 */
export function bassFrame(m: BassModel, angle: number, mirror: boolean): Frame {
  let c = Math.cos(angle),
    s = Math.sin(angle);
  if (Math.abs(c) < 1e-6) c = 0;
  if (Math.abs(s) < 1e-6) s = 0;
  const mx = mirror ? -1 : 1;
  const P = (x: number, y: number, z: number): Pt => [
    mirror ? VIEW_W - x : x,
    CY - (y * c - z * s),
  ];
  const light = (nx: number, ny: number, nz: number) => {
    const dot = mx * nx * LIGHT[0] - (ny * c - nz * s) * LIGHT[1] + (ny * s + nz * c) * LIGHT[2];
    const k = 1 + 0.7 * (dot - LIGHT[2]);
    return Math.round(Math.min(1.3, Math.max(0.28, k)) * 20) / 20;
  };
  const path = (pts: readonly Pt[], close = true) =>
    pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join('') + (close ? 'Z' : '');
  const at = (poly: readonly Pt[], z: number) => poly.map(([x, y]) => P(x, y, z));
  const frontK = light(0, 0, 1),
    backK = light(0, 0, -1);
  const facing = c > 0 ? 1 : c < 0 ? -1 : 0;

  /** Elipse de un círculo contenido en un plano z (pomos, polos, marcadores). */
  const disc = (x: number, y: number, z: number, r: number) => {
    const [cx, cy] = P(x, y, z);
    const ry = Math.max(0.05, r * Math.abs(c));
    return `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(ry)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(ry)} 0 1 0 ${f1(-2 * r)} 0Z`;
  };

  type Quad = { depth: number; d: string; fill: Paint; k: number };
  /** Caras laterales visibles de un perfil extruido entre z0 y z1. */
  const walls = (poly: readonly Pt[], z0: number, z1: number): Omit<Quad, 'fill'>[] => {
    const normals = edgeNormals(poly);
    const out: Omit<Quad, 'fill'>[] = [];
    poly.forEach((p, i) => {
      const [nx, ny] = normals[i]!;
      if (ny * s <= 0.015) return;
      const q = poly[(i + 1) % poly.length]!;
      out.push({
        depth: ((p[1] + q[1]) / 2) * s + ((z0 + z1) / 2) * c,
        d: path([P(p[0], p[1], z0), P(q[0], q[1], z0), P(q[0], q[1], z1), P(p[0], p[1], z1)]),
        k: light(nx, ny, 0),
      });
    });
    return out;
  };
  /** Une los lados consecutivos con la misma luz en un solo trazado. */
  const merge = (quads: Quad[]): Shape[] => {
    const out: Shape[] = [];
    for (const q of quads) {
      const last = out[out.length - 1];
      if (last && last.fill === q.fill && last.k === q.k) last.d += q.d;
      else out.push({ d: q.d, fill: q.fill, k: q.k, stroke: q.fill, width: 0.5 });
    }
    // El trazo del mismo color tapa las juntas entre lados; la luz se aplica igual.
    return out.map((sh) => ({ ...sh, stroke: sh.fill }));
  };
  /** Pieza convexa: sus laterales no se tapan entre sí y se agrupan por luz. */
  const solid = (poly: readonly Pt[], z0: number, z1: number, side: Paint, top: Paint): Shape[] => {
    const byK = new Map<number, string>();
    for (const q of walls(poly, z0, z1)) {
      const k = Math.round(q.k * 10) / 10;
      byK.set(k, (byK.get(k) ?? '') + q.d);
    }
    const out: Shape[] = [...byK].map(([k, d]) => ({ d, fill: side, k, stroke: side, width: 0.5 }));
    if (facing > 0) out.push({ d: path(at(poly, z1)), fill: top, k: frontK });
    if (facing < 0) out.push({ d: path(at(poly, z0)), fill: side, k: backK });
    // Perfil oscuro fino para que las piezas pequeñas se lean sobre el barniz.
    if (facing !== 0)
      out.push({
        d: path(at(poly, facing > 0 ? z1 : z0)),
        stroke: 'edge',
        width: 0.7,
      });
    return out;
  };

  const layers: { z: number; shapes: Shape[] }[] = [];
  const add = (z: number, shapes: Shape[]) => layers.push({ z, shapes });
  /**
   * Piezas pequeñas repetidas (selletas, mandos, clavijas) que no se solapan:
   * primero todos sus laterales, luego sus caras y detalles. Así se agrupan en
   * pocos trazados.
   */
  const parts = new Map<number, Shape[]>();
  const addPart = (z: number, shapes: Shape[]) =>
    parts.set(z, [...(parts.get(z) ?? []), ...shapes]);

  // Paredes que se tocan entre sí (cuerpo, mástil bajo la tapa y pala):
  // se ordenan por profundidad lado a lado.
  const neckLow: Pt[] = [
    [HEEL_X, -m.halfAt(HEEL_X)],
    [m.nutX, -m.halfAt(m.nutX)],
    [m.nutX, m.halfAt(m.nutX)],
    [HEEL_X, m.halfAt(HEEL_X)],
  ];
  const pool: Quad[] = [
    ...walls(m.body, Z_BACK, Z_FRONT).map((q) => ({ ...q, fill: 'lacquer' as Paint })),
    ...walls(neckLow, Z_NECK_BACK, Z_FRONT).map((q) => ({ ...q, fill: 'maple' as Paint })),
    ...walls(m.head, Z_NECK_BACK, Z_HEAD).map((q) => ({ ...q, fill: 'maple' as Paint })),
  ].sort((p, q) => p.depth - q.depth);
  add(0, merge(pool));

  // Botones de la correa.
  const button = (x: number, y: number) => {
    const [cx, cy] = P(x, y, 0);
    return `M${f1(cx - 2.6)} ${f1(cy)}a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0Z`;
  };
  add(0.5, [
    {
      d: m.buttons.map(([x, y]) => button(x, y)).join(''),
      fill: 'chrome',
      k: 1,
      stroke: 'shadow',
      width: 0.6,
    },
  ]);

  // Tapa y trasera del cuerpo.
  const bodyFace = facing >= 0 ? at(m.body, Z_FRONT) : at(m.body, Z_BACK);
  const clip = path(bodyFace);
  const bodyZ = facing >= 0 ? Z_FRONT : Z_BACK;
  if (facing !== 0) {
    const k = facing > 0 ? frontK : backK;
    add(bodyZ, [
      { d: clip, fill: 'burst', k },
      {
        d: m.grain.map((g) => path(at(g, bodyZ), false)).join(''),
        stroke: 'shadow',
        width: 0.7,
        opacity: 0.09,
        clip: true,
      },
      // Canto redondeado: sombra en el borde y filo de luz algo más adentro.
      { d: clip, stroke: 'shadow', width: 7, opacity: 0.22, clip: true },
      { d: path(at(m.bodyInset, bodyZ)), stroke: 'shine', width: 1.1, opacity: 0.28 * Math.abs(c) },
      { d: clip, stroke: 'shadow', width: 0.8, opacity: 0.55 },
    ]);
  }

  if (facing > 0) {
    // Golpeador de tres capas, placa de mandos y mandos.
    add(Z_GUARD - 0.1, [
      ...solid(m.guard, Z_FRONT, Z_GUARD, 'guardEdge', 'guard'),
      { d: path(at(m.guard, Z_GUARD)), stroke: 'guardEdge', width: 1.1 },
      { d: path(at(inset(m.guard, 1.6), Z_GUARD)), stroke: 'shadow', width: 0.7, opacity: 0.3 },
    ]);
    add(Z_FRONT + 0.6, solid(m.controlPlate, Z_FRONT, Z_FRONT + 0.8, 'metal', 'chrome'));
  }
  if (facing < 0) {
    // Placa del mástil y tapa de la cavidad de la electrónica.
    const screws = (pts: Pt[]) => pts.map(([x, y]) => disc(x, y, Z_BACK - 0.5, 1.4)).join('');
    add(Z_BACK - 0.3, [
      ...solid(m.cavity, Z_BACK - 0.6, Z_BACK, 'black', 'black'),
      { d: screws(m.cavity.filter((_, i) => i % 6 === 2)), fill: 'chrome', k: backK },
      ...solid(m.neckPlate, Z_BACK - 1, Z_BACK, 'metal', 'metal'),
      { d: path(at(inset(m.neckPlate, 2), Z_BACK - 1)), fill: 'chrome', k: backK },
      {
        d: screws([
          [261, -m.halfAt(HEEL_X) + 7],
          [285, -m.halfAt(HEEL_X) + 7],
          [261, m.halfAt(HEEL_X) - 7],
          [285, m.halfAt(HEEL_X) - 7],
        ]),
        fill: 'metal',
        k: backK * 0.8,
      },
    ]);
  }

  // Mandos: cilindros moleteados con tapa metálica.
  m.knobs.forEach(([x, y]) => {
    const poly = circle(x, y, 6.2, 20);
    const shapes = solid(poly, Z_FRONT + 0.8, Z_FRONT + 7, 'black', 'black');
    if (facing > 0)
      shapes.push(
        { d: disc(x, y, Z_FRONT + 7.05, 3.9), fill: 'chrome', k: frontK },
        {
          d: path([P(x, y, Z_FRONT + 7.1), P(x + 5.6, y, Z_FRONT + 7.1)], false),
          stroke: 'bone',
          width: 0.9,
        },
      );
    addPart(Z_FRONT + 4, shapes);
  });

  // Pastillas con polos.
  m.pickups.forEach((p) => {
    const shapes = solid(p.poly, Z_FRONT, Z_PICKUP, 'black', 'black');
    if (facing > 0)
      shapes.push(
        { d: path(at(inset(p.poly, 1.4), Z_PICKUP)), stroke: 'shine', width: 0.6, opacity: 0.2 },
        {
          d: p.poles.map(([x, y]) => disc(x, y, Z_PICKUP + 0.05, 1.8)).join(''),
          fill: 'chrome',
          k: frontK,
        },
      );
    addPart(Z_FRONT + 3, shapes);
  });

  // Puente: placa y selletas individuales.
  add(Z_FRONT + 1, solid(m.bridgePlate, Z_FRONT, Z_FRONT + 1.6, 'edge', 'metal'));
  m.saddles.forEach((saddle, i) => {
    const shapes = solid(saddle, Z_FRONT + 1.6, Z_FRONT + 4.6, 'metal', 'chrome');
    if (facing > 0) {
      const y = m.stringY(i, BRIDGE_X);
      shapes.push({
        d: path([P(BRIDGE_X - 5.6, y, Z_FRONT + 4.6), P(BRIDGE_X - 12, y, Z_FRONT + 1.7)], false),
        stroke: 'black',
        width: 0.9,
        opacity: 0.6,
      });
      // Tornillos de altura de la selleta.
      shapes.push({
        d: [-1, 1]
          .map((o) => disc(BRIDGE_X - 1.5, y + o * m.saddleHalf * 0.55, Z_FRONT + 4.7, 0.8))
          .join(''),
        fill: 'edge',
      });
    }
    addPart(Z_FRONT + 3.2, shapes);
  });

  // Mástil sobre el cuerpo, diapasón, trastes y marcadores.
  const board: Pt[] = [
    [m.boardEndX, -m.halfAt(m.boardEndX)],
    [m.nutX, -m.halfAt(m.nutX)],
    [m.nutX, m.halfAt(m.nutX)],
    [m.boardEndX, m.halfAt(m.boardEndX)],
  ];
  add(
    Z_FRONT + 1.2,
    merge(walls(board, Z_FRONT, Z_BOARD_BASE).map((q) => ({ ...q, fill: 'maple' }))),
  );
  if (facing < 0) {
    const back = neckLow.map(([x, y]): Pt => [x, y]);
    add(Z_NECK_BACK, [{ d: path(at(back, Z_NECK_BACK)), fill: 'mapleRound', k: backK }]);
  }
  const boardShapes = merge(
    walls(board, Z_BOARD_BASE, Z_BOARD).map((q) => ({ ...q, fill: 'board' })),
  );
  if (s < -0.2) {
    // Puntos laterales en el canto del diapasón, del lado de la cuerda grave.
    const r = 1.2;
    const dots = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]
      .filter((f) => f < m.fretXs.length)
      .map((f) => {
        const x = (m.fretXs[f]! + m.fretXs[f - 1]!) / 2;
        const [cx, cy] = P(x, -m.halfAt(x), (Z_BOARD + Z_BOARD_BASE) / 2);
        const ry = r * Math.abs(s);
        return `M${f1(cx - r)} ${f1(cy)}a${r} ${f1(ry)} 0 1 0 ${2 * r} 0a${r} ${f1(ry)} 0 1 0 ${-2 * r} 0Z`;
      });
    boardShapes.push({ d: dots.join(''), fill: 'inlay', k: 1 });
  }
  add(Z_BOARD - 1, boardShapes);
  if (facing > 0) {
    const frets = m.fretXs.slice(1);
    const inlays = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]
      .filter((f) => f < m.fretXs.length)
      .flatMap((f) => {
        const x = (m.fretXs[f]! + m.fretXs[f - 1]!) / 2;
        return (f % 12 === 0 ? [-0.42, 0.42] : [0]).map((o) =>
          disc(x, o * m.halfAt(x) * 1.25, Z_BOARD, f % 12 === 0 ? 2.3 : 2.6),
        );
      });
    add(Z_BOARD, [
      { d: path(at(board, Z_BOARD)), fill: 'board', k: frontK },
      { d: inlays.join(''), fill: 'inlay', k: frontK },
      {
        d: frets
          .map((x) =>
            path([P(x + 1, -m.halfAt(x), Z_BOARD), P(x + 1, m.halfAt(x), Z_BOARD)], false),
          )
          .join(''),
        stroke: 'shadow',
        width: 1.2,
        opacity: 0.45,
      },
      {
        d: frets
          .map((x) =>
            path([P(x, -m.halfAt(x), Z_BOARD + 0.6), P(x, m.halfAt(x), Z_BOARD + 0.6)], false),
          )
          .join(''),
        stroke: 'metal',
        width: 1.3,
        k: frontK * 1.08,
      },
    ]);
  }

  // Cejuela.
  const nutHalf = m.halfAt(m.nutX);
  add(
    Z_BOARD + 0.5,
    solid(
      [
        [m.nutX - 2.6, -nutHalf],
        [m.nutX + 0.4, -nutHalf],
        [m.nutX + 0.4, nutHalf],
        [m.nutX - 2.6, nutHalf],
      ],
      Z_HEAD,
      Z_BOARD + 1.4,
      'bone',
      'bone',
    ),
  );

  // Pala: cara, clavijeros traseros, ejes y llaves.
  if (facing > 0)
    add(Z_HEAD, [
      { d: path(at(m.head, Z_HEAD)), fill: 'maple', k: frontK },
      { d: path(at(inset(m.head, 2.2), Z_HEAD)), stroke: 'shine', width: 0.8, opacity: 0.35 },
      { d: path(at(m.head, Z_HEAD)), stroke: 'shadow', width: 0.7, opacity: 0.5 },
    ]);
  if (facing < 0)
    add(Z_NECK_BACK + 0.05, [{ d: path(at(m.head, Z_NECK_BACK)), fill: 'mapleRound', k: backK }]);
  m.posts.forEach((post) => {
    const side = post.upper ? -1 : 1;
    const housing = roundRect(post.x, post.y - side * 1, 6, 7, 2);
    addPart(Z_NECK_BACK - 1.4, solid(housing, Z_NECK_BACK - 3, Z_NECK_BACK, 'metal', 'chrome'));
    const edge = m.headHalf * side;
    const keyY = side * (m.headHalf + 17);
    const shaft = roundRect(
      post.x,
      (edge + keyY) / 2 - side * 2,
      1.6,
      Math.abs(keyY - edge) / 2,
      0.8,
    );
    const keyPoly = sampleCubics(
      [post.x, keyY - side * 6],
      [
        [
          [post.x + 10.5, keyY - side * 8],
          [post.x + 10.5, keyY + side * 11],
          [post.x, keyY + side * 10],
        ],
        [
          [post.x - 10.5, keyY + side * 11],
          [post.x - 10.5, keyY - side * 8],
          [post.x, keyY - side * 6],
        ],
      ],
      8,
    );
    addPart(Z_NECK_BACK - 1.2, [
      ...solid(shaft, Z_NECK_BACK - 2.6, Z_NECK_BACK - 0.8, 'metal', 'chrome'),
      ...solid(keyPoly, Z_NECK_BACK - 2.6, Z_NECK_BACK - 0.8, 'metal', 'chrome'),
    ]);
    // Arandela y poste por delante.
    const postShapes = solid(
      circle(post.x, post.y, 2.4, 14),
      Z_HEAD,
      Z_HEAD + 6,
      'metal',
      'chrome',
    );
    if (facing > 0)
      postShapes.unshift({
        d: disc(post.x, post.y, Z_HEAD + 0.1, 4.4),
        fill: 'chrome',
        k: frontK * 0.9,
      });
    addPart(Z_HEAD + 2, postShapes);
  });

  // Cuerdas: anclaje, selleta, cejuela y poste. Más gruesas las graves.
  if (facing >= 0) {
    const strings: Shape[] = [];
    const shadows: string[] = [];
    for (let i = 0; i < m.count; i++) {
      const post = m.posts[i]!;
      const yB = m.stringY(i, BRIDGE_X),
        yN = m.stringY(i, m.nutX);
      const toward = post.upper ? 2.2 : -2.2;
      const pts = [
        P(BRIDGE_X - 11, yB, Z_FRONT + 2),
        P(BRIDGE_X, yB, Z_FRONT + 4.8),
        P(m.nutX, yN, Z_BOARD + 1.5),
        P(post.x, post.y + toward, Z_HEAD + 4.5),
      ];
      const w = 2.5 - (1.45 * i) / (m.count - 1);
      const d = path(pts, false);
      strings.push({ d, stroke: 'string', width: w, k: 0.85 });
      strings.push({ d, stroke: 'shine', width: w * 0.38, opacity: 0.7 });
      if (facing > 0)
        shadows.push(
          path(
            [
              P(BRIDGE_X + 6, yB - 1.6, Z_FRONT + 4.6),
              P(m.boardEndX, m.stringY(i, m.boardEndX) - 1.6, Z_PICKUP + 0.1),
              P(m.boardEndX + 2, m.stringY(i, m.boardEndX) - 1.6, Z_BOARD + 0.6),
              P(m.nutX - 4, yN - 1.2, Z_BOARD + 0.6),
            ],
            false,
          ),
        );
    }
    add(Z_BOARD + 2, [
      ...(shadows.length
        ? [{ d: shadows.join(''), stroke: 'shadow' as Paint, width: 1.6, opacity: 0.28 * c }]
        : []),
      ...strings,
    ]);
  }

  const isWall = (sh: Shape) => sh.fill !== undefined && sh.stroke === sh.fill;
  for (const [z, shapes] of parts) {
    const sides = shapes
      .filter(isWall)
      .sort((p, q) => (p.fill! < q.fill! ? -1 : p.fill! > q.fill! ? 1 : p.k! - q.k!));
    const rest = shapes.filter((sh) => !isWall(sh));
    add(z, [...sides, ...rest.filter((sh) => sh.fill), ...rest.filter((sh) => !sh.fill)]);
  }
  const order = facing === 0 ? 1 : facing;
  layers.sort((p, q) => (p.z - q.z) * order);
  // Une trazados consecutivos con el mismo estilo opaco: menos nodos que pintar.
  const shapes: Shape[] = [];
  for (const sh of layers.flatMap((l) => l.shapes)) {
    const last = shapes[shapes.length - 1];
    if (
      last &&
      last.opacity === undefined &&
      sh.opacity === undefined &&
      !last.clip &&
      !sh.clip &&
      last.fill === sh.fill &&
      last.stroke === sh.stroke &&
      last.width === sh.width &&
      last.k === sh.k
    )
      last.d += sh.d;
    else shapes.push({ ...sh });
  }
  const overflow = Math.max(0, m.extentX + 3 - VIEW_W);
  return { shapes, clip, viewX: mirror ? -overflow : overflow };
}
