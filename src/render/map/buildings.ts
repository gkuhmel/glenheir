import { Container, Graphics, Text } from 'pixi.js';
import { BUILDING, MAP } from '../../data/balance';
import { createRng, type Rng } from '../../sim/rng';
import { roomAt, type Building, type Room, type Warehouse } from '../../sim/systems/building';
import { extensionsOf } from '../../sim/systems/warehouse';
import type { Rect } from '../../sim/terrain';

const T = MAP.tileSize;

/** Mise en page de la distillerie sur la carte, en pixels du monde. */
export const DISTILLERY = {
  x: (MAP.courtyard.x + 1) * T,
  y: (MAP.courtyard.y + 1.4) * T,
  /** Largeur d'une colonne de salles vue du dessus. */
  column: ((MAP.courtyard.width - 2) * T) / BUILDING.columns,
  /** Profondeur du toit, hauteur de façade, surélévation d'un étage. */
  depth: 3.4 * T,
  facade: 44,
  storey: 34,
};

const C = {
  slate: [0x4a5361, 0x525c6a, 0x444c59, 0x56606e],
  slateLine: 0x262b33,
  slateLight: 0x8a95a5,
  ridge: [0x8e8676, 0x9a9282],
  batten: 0x8a6440,
  stone: [0x9d9584, 0xa89f8d, 0x918a7a, 0xb0a794],
  quoin: 0xcfc6b2,
  stoneDark: 0x5d574d,
  frame: 0xece5d3,
  glass: 0x3b4a52,
  glow: 0xf3cf7a,
  copper: 0xd88a4a,
  wood: 0x6b4a2d,
  woodLight: 0x9a7048,
  brick: 0x9a5038,
  brickDark: 0x5e3326,
  hole: 0x1c1915,
  rafter: 0x5a3e26,
  ivy: [0x3f6230, 0x4f7a3a, 0x355428, 0x5b8a42],
  shadow: 0x0d120b,
  awning: [0xa8402f, 0xefe3c4],
  brass: 0xc9a24a,
  lantern: 0xffd27a,
  whitewash: 0xe9e2d1,
} as const;

/** Rectangle occupé par la distillerie sur la carte (pour le toucher). */
export function distilleryBounds(building: Building): Rect {
  const cols = building.rooms.filter((r) => r.level === 0).map((r) => r.col);
  const min = Math.min(...cols);
  const max = Math.max(...cols);
  const tall = building.rooms.some((r) => r.level === 1);
  const top = DISTILLERY.y - (tall ? DISTILLERY.storey : 0) - 20;
  return {
    x: DISTILLERY.x + min * DISTILLERY.column,
    y: top,
    width: (max - min + 1) * DISTILLERY.column,
    height: DISTILLERY.y + DISTILLERY.depth + DISTILLERY.facade - top,
  };
}

/** Couverture d'ardoises posées en rangs décalés, faîtage en tuiles de pierre. */
function slateRoof(
  g: Graphics,
  rng: Rng,
  x: number,
  y: number,
  w: number,
  h: number,
  ruined: boolean,
): void {
  g.rect(x, y, w, h).fill(C.slateLine);
  const rowH = 6;
  let row = 0;
  for (let yy = y; yy < y + h; yy += rowH, row++) {
    const offset = row % 2 ? 4.5 : 0;
    for (let xx = x - offset; xx < x + w; xx += 9) {
      const left = Math.max(x, xx);
      const right = Math.min(x + w, xx + 9);
      if (right - left < 1) continue;
      // Ardoises manquantes sur un toit en ruine : on voit le lattis.
      if (ruined && rng.chance(0.08)) {
        g.rect(left, yy, right - left, rowH).fill(C.batten);
        continue;
      }
      g.roundRect(left + 0.4, yy + 0.4, right - left - 0.8, rowH + 1.2, 1.5).fill(
        rng.pick(C.slate),
      );
    }
  }
  // Versant nord éclairé, versant sud à l'ombre (soleil au nord-ouest).
  g.rect(x, y, w, h * 0.47).fill({ color: C.slateLight, alpha: 0.16 });
  g.rect(x, y + h * 0.5, w, h * 0.5).fill({ color: 0x000000, alpha: 0.14 });
  // Faîtage.
  for (let xx = x; xx < x + w; xx += 7) {
    g.roundRect(xx, y + h * 0.46, Math.min(7, x + w - xx), 5, 2).fill(rng.pick(C.ridge));
  }
  // Ombre de l'égout du toit sur la façade.
  g.rect(x, y + h - 3, w, 3).fill({ color: 0x000000, alpha: 0.35 });
}

function roofDamage(g: Graphics, rng: Rng, x: number, y: number, w: number, h: number): void {
  for (let i = 0; i < 2; i++) {
    const cx = x + rng.range(w * 0.25, w * 0.75);
    const cy = y + rng.range(h * 0.15, h * 0.8);
    const pts: number[] = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const r = rng.range(6, 12);
      pts.push(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 0.8);
    }
    g.poly(pts).fill(C.hole);
    // Chevrons à nu, en biais.
    g.moveTo(cx - 12, cy - 8)
      .lineTo(cx + 6, cy + 9)
      .moveTo(cx - 4, cy - 10)
      .lineTo(cx + 13, cy + 6);
    g.stroke({ width: 2, color: C.rafter });
  }
}

function stoneFacade(g: Graphics, rng: Rng, x: number, y: number, w: number, h: number): void {
  g.rect(x, y, w, h).fill(C.stoneDark);
  for (let row = y; row < y + h; row += 5) {
    let col = x - rng.range(0, 6);
    while (col < x + w) {
      const sw = rng.range(6, 10);
      const left = Math.max(x, col);
      const right = Math.min(x + w, col + sw);
      if (right - left > 1.5)
        g.rect(left + 0.4, row + 0.4, right - left - 0.8, 4.2).fill(rng.pick(C.stone));
      col += sw;
    }
  }
  // Soubassement plus sombre.
  g.rect(x, y + h - 5, w, 5).fill({ color: 0x000000, alpha: 0.18 });
}

function quoins(g: Graphics, x: number, y: number, h: number): void {
  for (let yy = y, i = 0; yy < y + h - 2; yy += 6, i++) {
    g.rect(x - (i % 2 ? 4 : 2), yy, i % 2 ? 8 : 6, 5).fill(C.quoin);
  }
}

function archedWindow(
  g: Graphics,
  cx: number,
  y: number,
  w: number,
  h: number,
  state: 'dark' | 'lit' | 'copper' | 'broken',
): void {
  g.roundRect(cx - w / 2 - 1.5, y - 1.5, w + 3, h + 3, w / 2).fill(C.frame);
  const color = state === 'lit' ? C.glow : state === 'copper' ? C.copper : C.glass;
  g.roundRect(cx - w / 2, y, w, h, w / 2 - 1).fill(color);
  if (state === 'copper')
    g.roundRect(cx - w / 2 + 1.5, y + h * 0.4, w - 3, h * 0.5, 2).fill(0xf0b070);
  if (state === 'broken') {
    g.poly([cx - w / 2, y + h * 0.3, cx + 1, y + h * 0.55, cx - w / 2, y + h * 0.8]).fill(C.hole);
    g.rect(cx - w / 2 - 2, y + h * 0.45, w + 4, 2.2).fill(C.wood);
  } else {
    g.moveTo(cx, y + 1)
      .lineTo(cx, y + h)
      .moveTo(cx - w / 2, y + h * 0.55)
      .lineTo(cx + w / 2, y + h * 0.55);
    g.stroke({ width: 0.9, color: C.frame });
  }
  g.rect(cx - w / 2 - 2, y + h + 1, w + 4, 2).fill(C.quoin);
}

function climbingIvy(g: Graphics, rng: Rng, x: number, bottom: number, height: number): void {
  let cx = x;
  for (let y = bottom; y > bottom - height; y -= 3) {
    cx += rng.range(-1.6, 1.6);
    g.circle(cx + rng.range(-3, 3), y, rng.range(1.6, 3)).fill(rng.pick(C.ivy));
  }
}

/** Four à malt coiffé d'une pagode : pyramide concave et lanterne, avec son ombre portée. */
function pagoda(g: Graphics, cx: number, cy: number, size: number, ruined: boolean): void {
  const half = size / 2;
  g.poly([
    cx - half + 10,
    cy - half + 12,
    cx + half + 16,
    cy - half + 12,
    cx + half + 16,
    cy + half + 14,
    cx - half + 10,
    cy + half + 14,
  ]).fill({
    color: C.shadow,
    alpha: 0.35,
  });
  const shades = ruined
    ? [0x5f564e, 0x4d4640, 0x3f3934, 0x58504a]
    : [0x707684, 0x5b616e, 0x484d58, 0x666c79];
  const corners = [
    [cx - half, cy - half],
    [cx + half, cy - half],
    [cx + half, cy + half],
    [cx - half, cy + half],
  ] as const;
  for (let i = 0; i < 4; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % 4]!;
    // Arêtes légèrement concaves : point milieu tiré vers le centre.
    const mx = (a[0] + b[0]) / 2 + (cx - (a[0] + b[0]) / 2) * 0.12;
    const my = (a[1] + b[1]) / 2 + (cy - (a[1] + b[1]) / 2) * 0.12;
    g.poly([a[0], a[1], mx, my, b[0], b[1], cx, cy]).fill(shades[i]!);
  }
  for (let k = 0.25; k < 1; k += 0.25) {
    g.rect(cx - half * k, cy - half * k, half * 2 * k, half * 2 * k).stroke({
      width: 0.7,
      color: 0x2a2e36,
      alpha: 0.5,
    });
  }
  // Lanterne de ventilation et son petit toit.
  const top = size * 0.3;
  g.rect(cx - top / 2, cy - top / 2, top, top).fill(C.wood);
  const cap = top * 0.8;
  g.poly([cx - cap, cy - cap, cx + cap, cy - cap, cx, cy]).fill(0x7c828f);
  g.poly([cx + cap, cy - cap, cx + cap, cy + cap, cx, cy]).fill(0x5f6571);
  g.poly([cx + cap, cy + cap, cx - cap, cy + cap, cx, cy]).fill(0x4c515b);
  g.poly([cx - cap, cy + cap, cx - cap, cy - cap, cx, cy]).fill(0x6d7380);
  g.circle(cx, cy, 2).fill(C.brass);
}

/** Souche de cheminée en brique, vue du dessus, avec son ombre longue. */
function chimney(g: Graphics, cx: number, cy: number, ruined: boolean): void {
  g.poly([cx - 7, cy - 7, cx + 7, cy - 7, cx + 24, cy + 14, cx + 10, cy + 14]).fill({
    color: C.shadow,
    alpha: 0.35,
  });
  g.rect(cx - 8, cy - 8, 16, 16)
    .fill(ruined ? C.brickDark : C.brick)
    .stroke({ width: 1.2, color: C.brickDark });
  for (let y = cy - 6; y < cy + 8; y += 4) g.moveTo(cx - 8, y).lineTo(cx + 8, y);
  g.stroke({ width: 0.6, color: C.brickDark, alpha: 0.7 });
  g.rect(cx - 5, cy - 5, 10, 10).fill(C.hole);
}

function scaffolding(g: Graphics, x: number, y: number, w: number, h: number): void {
  g.rect(x + 2, y + 2, w - 4, h - 4).fill({ color: 0xcfc3a0, alpha: 0.9 });
  for (let px = x + 5; px < x + w; px += 10) g.moveTo(px, y).lineTo(px, y + h);
  for (let py = y + 5; py < y + h; py += 14) g.moveTo(x, py).lineTo(x + w, py);
  g.moveTo(x, y)
    .lineTo(x + w, y + h)
    .moveTo(x + w, y)
    .lineTo(x, y + h);
  g.stroke({ width: 1.8, color: C.woodLight });
  g.rect(x, y, w, h).stroke({ width: 1.6, color: C.wood });
}

function roofFeature(g: Graphics, room: Room, x: number, y: number, w: number, h: number): void {
  const cx = x + w / 2;
  switch (room.type) {
    case 'malting':
      pagoda(g, cx, y + h * 0.46, Math.min(w, h) * 0.9, room.ruined);
      break;
    case 'stillHouse':
      chimney(g, cx + w * 0.18, y + h * 0.26, room.ruined);
      break;
    case 'mashing':
      // Lanterne à lames pour évacuer la vapeur.
      g.rect(cx - 9, y + h * 0.4, 18, 10)
        .fill(C.wood)
        .stroke({ width: 1, color: C.slateLine });
      for (let i = 0; i < 4; i++)
        g.rect(cx - 8, y + h * 0.4 + 1 + i * 2.4, 16, 1).fill(C.woodLight);
      break;
    case 'fermentation':
      for (const dx of [-9, 9])
        g.circle(cx + dx, y + h * 0.3, 4)
          .fill(0x80838a)
          .stroke({ width: 1, color: C.slateLine });
      break;
    case 'ginWorkshop':
      g.circle(cx, y + h * 0.3, 4.5)
        .fill(C.copper)
        .stroke({ width: 1, color: C.brickDark });
      break;
    default:
      break;
  }
}

function facadeFeature(g: Graphics, room: Room, x: number, y: number, w: number, h: number): void {
  const cx = x + w / 2;
  const ruined = room.ruined;
  switch (room.type) {
    case 'reception': {
      // Grande porte cintrée, marches, lanterne et plaque de laiton.
      g.rect(cx - 10, y + h, 20, 4).fill(C.quoin);
      g.roundRect(cx - 8, y + h - 24, 16, 24, 8)
        .fill(ruined ? C.hole : 0x3d2a1a)
        .stroke({ width: 1.5, color: C.quoin });
      if (!ruined) {
        g.moveTo(cx, y + h - 22)
          .lineTo(cx, y + h)
          .stroke({ width: 0.8, color: 0x6b4a2d });
        g.circle(cx + 13, y + h - 18, 2.6).fill(C.lantern);
        g.circle(cx + 13, y + h - 18, 7).fill({ color: C.lantern, alpha: 0.22 });
        g.rect(cx - 9, y + 5, 18, 5).fill(C.brass);
      }
      return;
    }
    case 'bottling':
      // Quai de chargement : porte à lattes et palette de caisses de bouteilles.
      g.rect(cx - 11, y + h - 18, 22, 18)
        .fill(ruined ? C.hole : 0x6d7378)
        .stroke({ width: 1, color: C.stoneDark });
      for (let i = 1; i < 5; i++)
        g.rect(cx - 11, y + h - 18 + i * 3.6, 22, 0.8).fill({ color: 0x000000, alpha: 0.25 });
      if (!ruined)
        for (const [dx, dy] of [
          [14, 4],
          [20, 4],
          [17, -1],
        ] as const)
          g.rect(cx + dx, y + h + dy, 6, 5)
            .fill(C.wood)
            .stroke({ width: 0.6, color: C.stoneDark });
      return;
    case 'cafe':
      for (let i = 0; i < 6; i++)
        g.rect(x + 3 + (i * (w - 6)) / 6, y + h - 22, (w - 6) / 6, 7).fill(C.awning[i % 2]!);
      return;
    case 'shop':
      g.rect(x + 6, y + h - 20, w - 12, 14)
        .fill(ruined ? C.glass : C.glow)
        .stroke({ width: 2, color: C.wood });
      return;
    case 'mashing':
    case 'fermentation':
      // Porte de chargement en bois et sa poutre de levage.
      g.rect(cx - 7, y + h - 20, 14, 20)
        .fill(ruined ? C.hole : C.wood)
        .stroke({ width: 1, color: C.stoneDark });
      if (!ruined)
        g.moveTo(cx - 7, y + h - 10)
          .lineTo(cx + 7, y + h - 10)
          .stroke({ width: 0.8, color: C.woodLight });
      return;
    case 'tasting':
      g.ellipse(x + w - 8, y + h - 4, 5, 4)
        .fill(C.woodLight)
        .stroke({ width: 1, color: C.wood });
      return;
    default:
      return;
  }
}

/** Distillerie vue du dessus, composée à partir de sa grille de salles. */
export function drawDistillery(building: Building): Container {
  const rng = createRng(MAP.terrainSeed + 303);
  const g = new Graphics();
  const { x: X, y: Y, column: CW, depth: D, facade: F, storey: UP } = DISTILLERY;
  const ground = building.rooms.filter((r) => r.level === 0).sort((a, b) => a.col - b.col);
  const upperOf = (col: number) => roomAt(building, col, 1);

  // Ombre portée de tout le bâtiment.
  for (const room of ground) {
    const rise = upperOf(room.col) ? UP : 0;
    g.rect(X + room.col * CW + 8, Y - rise + 10, CW, D + F + rise).fill({
      color: C.shadow,
      alpha: 0.3,
    });
  }

  for (const room of ground) {
    const x = X + room.col * CW;
    const upper = upperOf(room.col);
    const rise = upper ? UP : 0;
    const roofY = Y - rise;
    const top = upper ?? room;
    const facadeY = Y + D - rise;
    const facadeH = F + rise;

    // Façade de pierre, chaînes d'angle aux extrémités, descente d'eau entre deux salles.
    stoneFacade(g, rng, x, facadeY, CW, facadeH);
    if (!roomAt(building, room.col - 1, 0)) quoins(g, x + 2, facadeY, facadeH);
    if (!roomAt(building, room.col + 1, 0)) quoins(g, x + CW - 2, facadeY, facadeH);
    else g.rect(x + CW - 1, facadeY + 2, 2, facadeH - 2).fill(0x3a3f45);

    const state = (r: Room) =>
      r.ruined ? 'broken' : r.type === null ? 'dark' : r.type === 'stillHouse' ? 'copper' : 'lit';
    const windowsY = Y + D + 8;
    if (room.type !== 'reception') {
      const tallWindows = room.type === 'stillHouse';
      archedWindow(
        g,
        x + CW * 0.3,
        windowsY - (tallWindows ? 4 : 0),
        9,
        tallWindows ? 26 : 18,
        state(room),
      );
      archedWindow(
        g,
        x + CW * 0.7,
        windowsY - (tallWindows ? 4 : 0),
        9,
        tallWindows ? 26 : 18,
        state(room),
      );
    }
    if (upper) {
      archedWindow(g, x + CW * 0.3, facadeY + 7, 9, 16, state(upper));
      archedWindow(g, x + CW * 0.7, facadeY + 7, 9, 16, state(upper));
    }
    facadeFeature(g, room, x, Y + D, CW, F);
    if (roomAt(building, room.col, -1)) {
      // Trappe de la cave au pied du mur.
      g.rect(x + CW * 0.55, Y + D + F - 1, 14, 7)
        .fill(C.wood)
        .stroke({ width: 1, color: C.hole });
    }

    // Toit (ou échafaudage pour un emplacement vide).
    if (top.type === null) scaffolding(g, x, roofY, CW, D);
    else {
      slateRoof(g, rng, x, roofY, CW, D, top.ruined);
      if (top.ruined) roofDamage(g, rng, x, roofY, CW, D);
    }
    // Pignons de pierre aux extrémités et entre deux hauteurs différentes.
    const gable = (gx: number, gy: number, gh: number) =>
      g
        .rect(gx - 2, gy, 4, gh)
        .fill(C.quoin)
        .stroke({ width: 0.6, color: C.stoneDark });
    if (!roomAt(building, room.col - 1, 0)) gable(x, roofY, D);
    if (!roomAt(building, room.col + 1, 0)) gable(x + CW, roofY, D);
    else if (!!upper !== !!upperOf(room.col + 1)) gable(x + CW, Y - UP, D + UP);

    if (room.ruined || upper?.ruined) {
      for (let i = 0; i < 2; i++)
        climbingIvy(g, rng, x + rng.range(4, CW - 4), Y + D + F, rng.range(14, facadeH));
      // Ardoises tombées au pied du mur.
      for (let i = 0; i < 5; i++) {
        g.rect(x + rng.range(0, CW - 6), Y + D + F + rng.range(2, 12), 6, 4).fill(
          rng.pick(C.slate),
        );
      }
    }
  }

  // Pagode, cheminée et lanternes de toit par-dessus.
  for (const room of ground) {
    const upper = upperOf(room.col);
    const x = X + room.col * CW;
    const roofY = Y - (upper ? UP : 0);
    for (const r of [room, upper]) if (r?.type) roofFeature(g, r, x, roofY, CW, D);
  }

  const container = new Container();
  container.addChild(g);
  return container;
}

/** Long chai de pierre (dunnage) vu du dessus, pignon blanchi au sud. */
/** Longueur du chai sur la carte, en tuiles : une travée de plus par agrandissement. */
const WAREHOUSE_LENGTH = { base: 10, perExtension: 1.5 };

/**
 * Emprise du chai dans sa zone réservée : le pignon et la porte restent au sud,
 * le bâtiment s'allonge vers le nord à chaque agrandissement.
 */
export function warehouseFootprint(warehouse: Warehouse, area: Rect): Rect {
  const length = Math.min(
    area.height,
    WAREHOUSE_LENGTH.base + extensionsOf(warehouse) * WAREHOUSE_LENGTH.perExtension,
  );
  return { x: area.x, y: area.y + area.height - length, width: area.width, height: length };
}

export function drawWarehouse(warehouse: Warehouse, reserved: Rect): Container {
  const area = warehouseFootprint(warehouse, reserved);
  const rng = createRng(MAP.terrainSeed + 404 + warehouse.id);
  const g = new Graphics();
  const x = area.x * T;
  const y = area.y * T;
  const w = area.width * T;
  const h = area.height * T;
  const F = DISTILLERY.facade;
  g.rect(x + 9, y + 11, w, h).fill({ color: C.shadow, alpha: 0.32 });
  slateRoof(g, rng, x, y, w, h - F, warehouse.ruined);
  // Le faîtage court dans la longueur : on le redessine à la verticale.
  for (let yy = y; yy < y + h - F; yy += 7) {
    g.roundRect(x + w * 0.47, yy, 5, Math.min(7, y + h - F - yy), 2).fill(rng.pick(C.ridge));
  }
  if (!warehouse.ruined) {
    // Tabatières le long du faîtage.
    for (let yy = y + 30; yy < y + h - F - 20; yy += 70)
      g.rect(x + w * 0.25, yy, 9, 12).fill(0x8fb3c0);
  } else {
    roofDamage(g, rng, x, y, w, (h - F) / 2);
    roofDamage(g, rng, x, y + (h - F) / 2, w, (h - F) / 2);
  }
  // Pignon sud blanchi à la chaux, grande porte noire.
  g.rect(x, y + h - F, w, F)
    .fill(warehouse.ruined ? 0xbdb5a3 : C.whitewash)
    .stroke({ width: 1, color: C.stoneDark });
  g.roundRect(x + w / 2 - 12, y + h - 26, 24, 26, 4).fill(warehouse.ruined ? C.hole : 0x23211e);
  const container = new Container();
  container.addChild(g);
  if (!warehouse.ruined) {
    g.moveTo(x + w / 2, y + h - 26)
      .lineTo(x + w / 2, y + h)
      .stroke({ width: 1, color: 0x55504a });
    for (const [dx, dy] of [
      [-30, 8],
      [-21, 8],
      [24, 9],
    ] as const) {
      g.circle(x + w / 2 + dx, y + h + dy, 5)
        .fill(0x8a5a33)
        .stroke({ width: 1.2, color: 0x4a3020 });
      g.circle(x + w / 2 + dx, y + h + dy, 1.5).fill(0x4a3020);
    }
    // Nom de la distillerie peint en grandes lettres sur le pignon.
    const name = new Text({
      text: 'GLENHEIR',
      style: {
        fontFamily: 'Alegreya Sans',
        fontWeight: '700',
        fontSize: 11,
        fill: 0x1f1d1a,
        letterSpacing: 1.5,
      },
      resolution: 3,
    });
    name.anchor.set(0.5, 0);
    name.position.set(x + w / 2, y + h - F + 4);
    container.addChild(name);
  } else {
    for (let i = 0; i < 4; i++)
      climbingIvy(g, rng, x + rng.range(4, w - 4), y + h, rng.range(14, F));
  }
  return container;
}
