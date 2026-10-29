import { Container, Graphics } from 'pixi.js';
import { MAP } from '../../data/balance';
import { createRng, type Rng } from '../../sim/rng';
import type { Decor, Point, Terrain } from '../../sim/terrain';
import { PALETTE } from '../config';
import { smoothPath } from './ground';

const T = MAP.tileSize;

/** Ombre portée douce, décalée vers le bas à droite (soleil au nord-ouest). */
function shadow(g: Graphics, x: number, y: number, rx: number, ry: number, alpha = 0.28): void {
  g.ellipse(x + rx * 0.25, y + ry * 0.35, rx, ry).fill({ color: PALETTE.shadow, alpha });
}

/** Polygone irrégulier autour d'un centre (rochers, houppiers). */
function blob(
  rng: Rng,
  cx: number,
  cy: number,
  r: number,
  points: number,
  jitter: number,
): number[] {
  const coords: number[] = [];
  const start = rng.range(0, Math.PI * 2);
  for (let i = 0; i < points; i++) {
    const angle = start + (i / points) * Math.PI * 2;
    const radius = r * (1 - jitter + rng.next() * jitter);
    coords.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  return coords;
}

function drawRiver(g: Graphics, terrain: Terrain, rng: Rng): void {
  const line = () => smoothPath(g, terrain.river, T);
  line();
  g.stroke({ width: terrain.riverWidth * T, color: PALETTE.water, join: 'round' });
  line();
  g.stroke({
    width: terrain.riverWidth * T * 0.55,
    color: PALETTE.waterMid,
    alpha: 0.8,
    cap: 'round',
    join: 'round',
  });

  // Galets sur les berges et reflets à la surface.
  const half = terrain.riverWidth / 2;
  for (let i = 1; i < terrain.river.length; i++) {
    const a = terrain.river[i - 1] as Point;
    const b = terrain.river[i] as Point;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / length;
    const ny = (b.x - a.x) / length;
    for (const side of [-1, 1]) {
      if (!rng.chance(0.7)) continue;
      const t = rng.next();
      const offset = side * (half + rng.range(-0.15, 0.1));
      const x = (a.x + (b.x - a.x) * t + nx * offset) * T;
      const y = (a.y + (b.y - a.y) * t + ny * offset) * T;
      const r = rng.range(2, 4.5);
      g.ellipse(x, y, r * 1.3, r)
        .fill(rng.pick(PALETTE.stone))
        .stroke({ width: 1, color: PALETTE.stoneDark, alpha: 0.6 });
    }
    if (rng.chance(0.35)) {
      const offset = rng.range(-half * 0.5, half * 0.5);
      const x = (a.x + nx * offset) * T;
      const y = (a.y + ny * offset) * T;
      g.moveTo(x, y)
        .lineTo(x + (b.x - a.x) * T * 0.6, y + (b.y - a.y) * T * 0.6)
        .stroke({ width: 1.5, color: PALETTE.waterLight, alpha: 0.25, cap: 'round' });
    }
  }
}

function drawBridge(terrain: Terrain): Container {
  const g = new Graphics();
  const length = (terrain.riverWidth + 1.6) * T;
  const width = 1.25 * T;
  // Ombre sur l'eau, tablier, puis parapets.
  g.roundRect(-length / 2 + 4, -width / 2 + 6, length, width, 6).fill({
    color: PALETTE.shadow,
    alpha: 0.35,
  });
  g.roundRect(-length / 2, -width / 2, length, width, 6).fill(0x8a8170);
  for (let x = -length / 2 + 6; x < length / 2 - 4; x += 7) {
    g.moveTo(x, -width / 2 + 5)
      .lineTo(x, width / 2 - 5)
      .stroke({ width: 1, color: PALETTE.mortar, alpha: 0.35 });
  }
  for (const side of [-1, 1]) {
    const y = side * (width / 2 - 3);
    g.roundRect(-length / 2 - 2, y - 3.5, length + 4, 7, 3)
      .fill(0x9d9585)
      .stroke({ width: 1.2, color: PALETTE.stoneDark });
    g.moveTo(-length / 2, y - 1.5)
      .lineTo(length / 2, y - 1.5)
      .stroke({ width: 1, color: PALETTE.stoneLight, alpha: 0.5 });
  }
  const bridge = new Container();
  bridge.addChild(g);
  bridge.position.set(terrain.bridge.x * T, terrain.bridge.y * T);
  bridge.rotation = terrain.bridge.angle;
  return bridge;
}

function drawCourtyard(g: Graphics, terrain: Terrain, rng: Rng): void {
  const { x, y, width, height } = terrain.courtyard;
  g.rect(x * T, y * T, width * T, height * T).fill(PALETTE.mortar);
  const perTile = 2;
  const cell = T / perTile;
  for (let r = y * perTile; r < (y + height) * perTile; r++) {
    // Rangs décalés comme un vrai pavage.
    const shift = (r % 2) * (cell / 2);
    for (let c = x * perTile; c < (x + width) * perTile; c++) {
      if (rng.chance(0.05)) {
        // Pavé manquant : l'herbe repousse.
        g.circle(c * cell + cell / 2, r * cell + cell / 2, cell * 0.3).fill({
          color: 0x5b7d3d,
          alpha: 0.8,
        });
        continue;
      }
      const cx = c * cell + shift + rng.range(-1, 1);
      const cy = r * cell + rng.range(-1, 1);
      const w = cell - rng.range(2, 3.5);
      const h = cell - rng.range(2, 3.5);
      if (cx + w > (x + width) * T) continue;
      // Pavés usés, peu contrastés avec les joints pour ne pas écraser les bâtiments.
      g.roundRect(cx + 1, cy + 1, w, h, 5).fill(rng.pick(PALETTE.cobble));
      g.roundRect(cx + 2.5, cy + 2, w * 0.5, h * 0.35, 3).fill({
        color: PALETTE.stoneLight,
        alpha: 0.08,
      });
    }
  }
}

function drawWalls(g: Graphics, terrain: Terrain, rng: Rng): void {
  for (const { from, to } of terrain.walls) {
    const horizontal = from.y === to.y;
    const stones = 3;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < stones; i++) {
        const t = (i + 0.5 + (row ? 0.5 : 0)) / stones;
        if (t > 1) continue;
        const along = (horizontal ? from.x : from.y) + t * 1;
        const across = (horizontal ? from.y : from.x) + (row - 0.5) * 0.22;
        const px = (horizontal ? along : across) * T;
        const py = (horizontal ? across : along) * T;
        const rx = (horizontal ? 6 : 4.2) + rng.range(-0.8, 0.8);
        const ry = (horizontal ? 4.2 : 6) + rng.range(-0.8, 0.8);
        shadow(g, px, py, rx, ry, 0.25);
        g.ellipse(px, py, rx, ry)
          .fill(rng.pick(PALETTE.stone))
          .stroke({ width: 1.2, color: PALETTE.stoneDark });
        g.ellipse(px - rx * 0.25, py - ry * 0.3, rx * 0.45, ry * 0.35).fill({
          color: PALETTE.stoneLight,
          alpha: 0.35,
        });
      }
    }
  }
}

function drawDecor(g: Graphics, strokes: Graphics, d: Decor, rng: Rng): void {
  const x = d.x * T;
  const y = d.y * T;
  const r = d.size * T * 0.5;
  switch (d.kind) {
    case 'pine': {
      shadow(g, x, y, r * 1.05, r * 0.85);
      g.poly(blob(rng, x, y, r, 11, 0.25)).fill(PALETTE.pine[0]);
      g.poly(blob(rng, x - r * 0.12, y - r * 0.12, r * 0.7, 9, 0.25)).fill(PALETTE.pine[1]);
      g.circle(x - r * 0.25, y - r * 0.28, r * 0.32).fill(PALETTE.pine[2]);
      break;
    }
    case 'birch': {
      shadow(g, x, y, r * 1.05, r * 0.85);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + d.variant * 6;
        g.circle(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.55).fill(
          PALETTE.birch[0],
        );
      }
      g.circle(x - r * 0.15, y - r * 0.15, r * 0.55).fill(PALETTE.birch[1]);
      g.circle(x - r * 0.32, y - r * 0.34, r * 0.25).fill(PALETTE.birch[2]);
      break;
    }
    case 'bush': {
      shadow(g, x, y, r, r * 0.8, 0.22);
      g.poly(blob(rng, x, y, r, 9, 0.3)).fill(PALETTE.gorse);
      for (let i = 0; i < 7; i++) {
        g.circle(x + rng.range(-r, r) * 0.7, y + rng.range(-r, r) * 0.7, 1.4).fill(
          PALETTE.gorseFlower,
        );
      }
      break;
    }
    case 'rock':
    case 'rubble': {
      shadow(g, x, y, r, r * 0.75, 0.3);
      g.poly(blob(rng, x, y, r, 7, 0.35))
        .fill(rng.pick(PALETTE.stone))
        .stroke({ width: 1, color: PALETTE.stoneDark, alpha: 0.8 });
      g.poly(blob(rng, x - r * 0.25, y - r * 0.25, r * 0.45, 6, 0.3)).fill({
        color: PALETTE.stoneLight,
        alpha: 0.4,
      });
      break;
    }
    case 'heather': {
      for (let i = 0; i < 7; i++) {
        g.circle(x + rng.range(-r, r), y + rng.range(-r, r) * 0.8, rng.range(1.6, 2.8)).fill(
          rng.pick(PALETTE.heather),
        );
      }
      break;
    }
    case 'flowers': {
      const color = rng.pick(PALETTE.flower);
      for (let i = 0; i < 5; i++)
        g.circle(x + rng.range(-r, r), y + rng.range(-r, r), 1.3).fill(color);
      break;
    }
    case 'weeds': {
      for (let i = 0; i < 4; i++) {
        g.circle(x + rng.range(-r, r), y + rng.range(-r, r), rng.range(1.5, 2.5)).fill(0x5b7d3d);
      }
      break;
    }
    case 'tuft': {
      for (let i = -1; i <= 1; i++) {
        strokes.moveTo(x + i * 1.5, y + 2).lineTo(x + i * 3, y - r);
      }
      break;
    }
    case 'reeds': {
      for (let i = 0; i < 5; i++) {
        const dx = rng.range(-r, r);
        const top = y - rng.range(r * 0.8, r * 1.6);
        g.moveTo(x + dx * 0.4, y)
          .lineTo(x + dx, top)
          .stroke({ width: 1.2, color: PALETTE.reed });
        g.ellipse(x + dx, top, 1.2, 2.4).fill(PALETTE.reedTip);
      }
      break;
    }
  }
}

/** Ruisseau, pont, cour pavée, murets en ruine et végétation. */
export function createScenery(terrain: Terrain): Container {
  const rng = createRng(MAP.terrainSeed + 202);
  const water = new Graphics();
  drawRiver(water, terrain, rng);

  const court = new Graphics();
  drawCourtyard(court, terrain, rng);

  const plants = new Graphics();
  const tufts = new Graphics();
  const walls = new Graphics();
  // Petits éléments au sol d'abord, puis murets, puis arbres par-dessus.
  const ground = terrain.decor.filter(
    (d) => d.kind !== 'pine' && d.kind !== 'birch' && d.kind !== 'bush',
  );
  const tall = terrain.decor.filter(
    (d) => d.kind === 'pine' || d.kind === 'birch' || d.kind === 'bush',
  );
  for (const d of ground) drawDecor(plants, tufts, d, rng);
  tufts.stroke({ width: 1, color: PALETTE.tuft, alpha: 0.55, cap: 'round' });
  drawWalls(walls, terrain, rng);
  const trees = new Graphics();
  for (const d of tall) drawDecor(trees, tufts, d, rng);

  const container = new Container();
  container.addChild(water, drawBridge(terrain), court, tufts, plants, walls, trees);
  return container;
}
