import { MAP } from '../data/balance';
import { createValueNoise, fbm, type Noise2D } from './noise';
import { createRng, type Rng } from './rng';

export type TileKind = 'grass' | 'heather' | 'water' | 'path' | 'bridge' | 'cobble';

export type DecorKind =
  | 'pine'
  | 'birch'
  | 'bush'
  | 'rock'
  | 'heather'
  | 'flowers'
  | 'tuft'
  | 'reeds'
  | 'weeds'
  | 'rubble';

/** Élément de décor ; position et taille en tuiles. */
export interface Decor {
  kind: DecorKind;
  x: number;
  y: number;
  size: number;
  /** Valeur libre dans [0, 1[ pour varier le dessin. */
  variant: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Tronçon de muret de pierres sèches, le long d'un bord de tuile. */
export interface WallSegment {
  from: Point;
  to: Point;
}

/** Terrain de la carte, entièrement déterminé par sa graine. */
export interface Terrain {
  cols: number;
  rows: number;
  /** Nature de chaque tuile, ligne par ligne. */
  tiles: TileKind[];
  /** Champs continus par tuile (0 à 1) pour nuancer le sol. */
  lushness: number[];
  heather: number[];
  river: Point[];
  riverWidth: number;
  paths: Point[][];
  bridge: { x: number; y: number; angle: number };
  courtyard: Rect;
  gates: { south: number; west: number; east: number };
  /** Emprise réservée au premier chai (sans décor), en tuiles. */
  warehouse: Rect;
  walls: WallSegment[];
  decor: Decor[];
}

const RIVER_WIDTH = 1.7;
const PATH_HALF_WIDTH = 0.65;

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distanceToPolyline(p: Point, line: readonly Point[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    best = Math.min(best, distanceToSegment(p, line[i - 1] as Point, line[i] as Point));
  }
  return best;
}

function riverLine(rows: number, noise: Noise2D, rng: Rng): Point[] {
  const phase = rng.range(0, Math.PI * 2);
  const points: Point[] = [];
  for (let y = 0; y <= rows; y += 0.5) {
    const x = 16.5 + 3.2 * Math.sin(y * 0.13 + phase) + (noise(y * 0.12, 7.3) - 0.5) * 3;
    points.push({ x, y });
  }
  return points;
}

/** Abscisse du ruisseau à une ordonnée donnée (il coule du nord au sud). */
function riverXAt(river: readonly Point[], y: number): number {
  for (let i = 1; i < river.length; i++) {
    const a = river[i - 1] as Point;
    const b = river[i] as Point;
    if (y >= a.y && y <= b.y) return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
  }
  return (river[0] as Point).x;
}

function southPath(court: Rect, gate: number, rows: number, rng: Rng): Point[] {
  const phase = rng.range(0, Math.PI * 2);
  const start = court.y + court.height;
  const points: Point[] = [];
  for (let y = start - 0.5; y <= rows + 2; y += 0.5) {
    const ramp = Math.min(1, (y - start) / 4);
    points.push({ x: gate + ramp * 2.4 * Math.sin((y - start) * 0.2 + phase), y });
  }
  return points;
}

function westPath(court: Rect, gate: number, rng: Rng): Point[] {
  const phase = rng.range(0, Math.PI * 2);
  const points: Point[] = [];
  for (let x = court.x + 0.5; x >= -2; x -= 0.5) {
    const ramp = Math.min(1, (court.x - x) / 4);
    points.push({ x, y: gate + ramp * 2 * Math.sin((court.x - x) * 0.16 + phase) });
  }
  return points;
}

function perimeterWalls(court: Rect, gates: Terrain['gates'], rng: Rng) {
  const walls: WallSegment[] = [];
  const rubble: Point[] = [];
  const { x, y, width, height } = court;
  const add = (from: Point, to: Point, isGate: boolean) => {
    if (isGate) return;
    // Muret en ruine : environ un tronçon sur quatre est effondré.
    if (rng.chance(0.75)) walls.push({ from, to });
    else rubble.push({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
  };
  for (let i = 0; i < width; i++) {
    add({ x: x + i, y }, { x: x + i + 1, y }, false);
    const southGate = x + i === gates.south - 1 || x + i === gates.south;
    add({ x: x + i, y: y + height }, { x: x + i + 1, y: y + height }, southGate);
  }
  for (let j = 0; j < height; j++) {
    const westGate = y + j === gates.west - 1 || y + j === gates.west;
    const eastGate = y + j === gates.east - 1 || y + j === gates.east;
    add({ x, y: y + j }, { x, y: y + j + 1 }, westGate);
    add({ x: x + width, y: y + j }, { x: x + width, y: y + j + 1 }, eastGate);
  }
  return { walls, rubble };
}

export function generateTerrain(seed: number = MAP.terrainSeed): Terrain {
  const rng = createRng(seed);
  const cols = MAP.cols;
  const rows = MAP.rows;
  const court: Rect = { ...MAP.courtyard };
  const warehouse: Rect = { ...MAP.warehouse };
  const gates = {
    south: court.x + Math.floor(court.width / 2),
    west: court.y + Math.floor(court.height / 2),
    east: Math.round(warehouse.y + warehouse.height / 2),
  };
  const relief = createValueNoise(rng);
  const forest = createValueNoise(rng);
  const wobble = createValueNoise(rng);

  const river = riverLine(rows, wobble, rng);
  // Allée courte de la porte est jusqu'au chai.
  const eastPath: Point[] = [
    { x: court.x + court.width - 0.5, y: gates.east },
    { x: warehouse.x + 0.5, y: gates.east },
  ];
  const paths = [
    southPath(court, gates.south, rows, rng),
    westPath(court, gates.west, rng),
    eastPath,
  ];
  const west = paths[1] as Point[];

  // Le pont : point du chemin ouest le plus proche du ruisseau.
  let crossing = west[0] as Point;
  for (const p of west) {
    if (Math.abs(p.x - riverXAt(river, p.y)) < Math.abs(crossing.x - riverXAt(river, crossing.y))) {
      crossing = p;
    }
  }
  const index = west.indexOf(crossing);
  const before = west[Math.max(0, index - 1)] as Point;
  const after = west[Math.min(west.length - 1, index + 1)] as Point;
  const bridge = { ...crossing, angle: Math.atan2(after.y - before.y, after.x - before.x) };

  const tiles: TileKind[] = [];
  const lushness: number[] = [];
  const heather: number[] = [];
  const inCourt = (c: number, r: number) =>
    c >= court.x && c < court.x + court.width && r >= court.y && r < court.y + court.height;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const center = { x: c + 0.5, y: r + 0.5 };
      const riverDistance = distanceToPolyline(center, river);
      const pathDistance = Math.min(...paths.map((p) => distanceToPolyline(center, p)));
      const height = fbm(relief, c * 0.06, r * 0.06);
      // Bruyère sur les hauteurs, loin du ruisseau.
      const heatherValue = Math.max(
        0,
        Math.min(1, (height - 0.56) * 4 + (riverDistance - 6) * 0.03),
      );
      heather.push(heatherValue);
      lushness.push(Math.max(0, Math.min(1, 1 - riverDistance / 6)));

      let kind: TileKind = heatherValue > 0.5 ? 'heather' : 'grass';
      if (inCourt(c, r)) kind = 'cobble';
      else if (riverDistance < RIVER_WIDTH / 2 + 0.15)
        kind = pathDistance < PATH_HALF_WIDTH ? 'bridge' : 'water';
      else if (pathDistance < PATH_HALF_WIDTH) kind = 'path';
      tiles.push(kind);
    }
  }

  const { walls, rubble } = perimeterWalls(court, gates, rng);
  const decor: Decor[] = [];
  const kindAt = (c: number, r: number): TileKind | undefined =>
    c < 0 || r < 0 || c >= cols || r >= rows ? undefined : tiles[r * cols + c];
  const nearWater = (c: number, r: number) =>
    [-1, 0, 1].some((dc) => [-1, 0, 1].some((dr) => kindAt(c + dc, r + dr) === 'water'));
  const place = (kind: DecorKind, c: number, r: number, size: number, spread = 0.3) =>
    decor.push({
      kind,
      x: c + 0.5 + rng.range(-spread, spread),
      y: r + 0.5 + rng.range(-spread, spread),
      size,
      variant: rng.next(),
    });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const kind = tiles[r * cols + c] as TileKind;
      if (kind === 'cobble') {
        if (rng.chance(0.07)) place('weeds', c, r, rng.range(0.2, 0.35));
        continue;
      }
      if (kind !== 'grass' && kind !== 'heather') continue;

      const center = { x: c + 0.5, y: r + 0.5 };
      const nearWarehouse =
        center.x > warehouse.x - 1.5 &&
        center.x < warehouse.x + warehouse.width + 1.5 &&
        center.y > warehouse.y - 1.5 &&
        center.y < warehouse.y + warehouse.height + 1.5;
      if (nearWarehouse) continue;
      const pathDistance = Math.min(...paths.map((p) => distanceToPolyline(center, p)));
      const courtGap = Math.max(
        court.x - center.x,
        center.x - (court.x + court.width),
        court.y - center.y,
        center.y - (court.y + court.height),
      );
      const edge = Math.max(Math.abs(c - cols / 2), Math.abs(r - rows / 2)) / (cols / 2);
      const density = fbm(forest, c * 0.09, r * 0.09);
      const treeChance = Math.max(0, Math.min(0.9, (density - 0.45) * 3.4 + (edge - 0.5) * 1.4));
      const clearing = courtGap < 2.5 || pathDistance < 1.6 || nearWater(c, r);

      if (!clearing && rng.chance(treeChance)) {
        const pine = kind === 'heather' || rng.chance(0.55);
        place(pine ? 'pine' : 'birch', c, r, rng.range(0.75, 1.3));
        continue;
      }
      if (nearWater(c, r) && rng.chance(0.5)) place('reeds', c, r, rng.range(0.25, 0.4), 0.4);
      if (kind === 'heather') {
        if (rng.chance(0.75)) place('heather', c, r, rng.range(0.25, 0.45), 0.35);
        if (rng.chance(0.05)) place('rock', c, r, rng.range(0.25, 0.55));
        continue;
      }
      if (rng.chance(0.03) && !clearing) place('bush', c, r, rng.range(0.35, 0.55));
      if (rng.chance(0.015)) place('rock', c, r, rng.range(0.2, 0.45));
      if (rng.chance(0.1)) place('flowers', c, r, rng.range(0.2, 0.35), 0.4);
      if (rng.chance(0.45)) place('tuft', c, r, rng.range(0.15, 0.25), 0.45);
    }
  }
  for (const p of rubble) {
    for (let i = 0; i < 3; i++) {
      decor.push({
        kind: 'rubble',
        x: p.x + rng.range(-0.5, 0.5),
        y: p.y + rng.range(-0.4, 0.4),
        size: rng.range(0.1, 0.2),
        variant: rng.next(),
      });
    }
  }
  // Dessin du nord au sud : ce qui est plus bas recouvre ce qui est plus haut.
  decor.sort((a, b) => a.y - b.y);

  return {
    cols,
    rows,
    tiles,
    lushness,
    heather,
    river,
    riverWidth: RIVER_WIDTH,
    paths,
    bridge,
    courtyard: court,
    gates,
    warehouse,
    walls,
    decor,
  };
}

export function tileAt(terrain: Terrain, col: number, row: number): TileKind | undefined {
  if (col < 0 || row < 0 || col >= terrain.cols || row >= terrain.rows) return undefined;
  return terrain.tiles[row * terrain.cols + col];
}
