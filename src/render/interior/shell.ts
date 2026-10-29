import { Container, Graphics, Text } from 'pixi.js';
import { BUILDING } from '../../data/balance';
import { formatMoney, t, type MessageKey } from '../../i18n';
import type { Rng } from '../../sim/rng';
import {
  purchasableCells,
  roomAt,
  roomGroups,
  slotCost,
  stairColumn,
  type Building,
  type Room,
} from '../../sim/systems/building';
import { colX, floorY, levelTop, ROOM, STAIR } from './layout';
import { INTERIOR as P } from './palette';

const W = ROOM.width;
const H = ROOM.height;
const ROOF_H = 118;
const EAVE = 16;
/** Épaisseur de la couverture d'ardoise vue en coupe. */
const SLATE = 15;
/** Hauteur des portes dans les cloisons. */
const DOOR_H = 122;

function stoneColumn(g: Graphics, rng: Rng, x: number, y: number, w: number, h: number): void {
  g.rect(x, y, w, h).fill(P.mortar);
  for (let yy = y; yy < y + h; yy += 18) {
    const off = ((yy - y) / 18) % 2 ? 0 : w / 2;
    for (let xx = x - off; xx < x + w; xx += w) {
      const left = Math.max(x, xx);
      const right = Math.min(x + w, xx + w);
      if (right - left > 2)
        g.rect(left + 1, yy + 1, right - left - 2, 16).fill(rng.pick(P.wallOuter));
    }
  }
}

/** Murs extérieurs et cloisons percées d'une porte entre deux salles différentes. */
function drawWalls(g: Graphics, rng: Rng, building: Building): void {
  const merged = new Set<string>();
  for (const group of roomGroups(building)) {
    for (let i = 1; i < group.cols.length; i++) merged.add(`${group.cols[i]}:${group.level}`);
  }
  for (const room of building.rooms) {
    const x = colX(room.col);
    const top = levelTop(room.level);
    if (!roomAt(building, room.col - 1, room.level)) {
      stoneColumn(g, rng, x - ROOM.wall / 2, top, ROOM.wall, H);
    } else if (!merged.has(`${room.col}:${room.level}`)) {
      // Cloison avec porte : mur au-dessus du linteau.
      const doorTop = floorY(room.level) - DOOR_H;
      stoneColumn(g, rng, x - 6, top, 12, doorTop - top);
      g.rect(x - 14, doorTop - 6, 28, 8).fill(P.beam);
      g.rect(x - 6, doorTop + 2, 12, DOOR_H - 2).fill({ color: 0x000000, alpha: 0.18 });
    } else {
      // Salles fusionnées : simple poteau de bois.
      g.rect(x - 4, top, 8, H - ROOM.floor).fill(P.woodDark);
    }
    if (!roomAt(building, room.col + 1, room.level)) {
      stoneColumn(g, rng, x + W - ROOM.wall / 2, top, ROOM.wall, H);
    }
  }
}

/** Escaliers de bois entre deux niveaux, avec trémie dans le plancher du dessus. */
function drawStairs(g: Graphics, building: Building): void {
  for (let lower = BUILDING.minLevel; lower < BUILDING.maxLevel; lower++) {
    const col = stairColumn(building, lower);
    if (col === null) continue;
    const x0 = colX(col) + STAIR.bottomX;
    const x1 = colX(col) + STAIR.topX;
    const y0 = floorY(lower);
    const y1 = floorY(lower + 1);
    // Trémie : le plancher du dessus est ouvert au-dessus des marches.
    g.rect(x1 - 96, y1, 104, ROOM.floor).fill(0x1c1712);
    const steps = 11;
    for (let i = 0; i < steps; i++) {
      const sx = x0 + ((x1 - x0) * i) / steps;
      const sy = y0 - ((y0 - y1) * (i + 1)) / steps;
      g.rect(sx, sy, (x1 - x0) / steps + 2, 5).fill(P.woodLight);
      g.rect(sx, sy + 5, 3, y0 - sy - 5).fill({ color: P.woodDark, alpha: 0.35 });
    }
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 8, color: P.woodDark });
    // Main courante.
    g.moveTo(x0, y0 - 46)
      .lineTo(x1, y1 - 46)
      .stroke({ width: 4, color: P.wood });
    for (let i = 0; i <= 4; i++) {
      const px = x0 + ((x1 - x0) * i) / 4;
      const py = y0 + ((y1 - y0) * i) / 4;
      g.moveTo(px, py)
        .lineTo(px, py - 46)
        .stroke({ width: 3, color: P.woodDark });
    }
  }
}

/** Pagode du four à malt, posée sur le faîtage : flancs concaves, lanterne à lames. */
function pagoda(g: Graphics, cx: number, base: number, ruined: boolean): void {
  const slate = ruined ? 0x4f4943 : 0x39404a;
  const half = 76;
  const height = 112;
  const neck = 20;
  // Demi-largeur à la hauteur relative t (0 = base, 1 = sommet) : flancs concaves.
  const halfWidth = (t: number) => neck + (half - neck) * (1 - t) ** 1.8;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const y = base - t * height;
    left.push(cx - halfWidth(t), y);
    right.unshift(cx + halfWidth(t), y);
  }
  // Coyaux retroussés à la base.
  g.poly([cx - half - 10, base - 6, ...left, ...right, cx + half + 10, base - 6]).fill(slate);
  g.poly([cx - half - 10, base - 6, ...left, cx, base - height, cx, base]).fill({
    color: 0xffffff,
    alpha: 0.09,
  });
  for (let y = base - 7; y > base - height + 4; y -= 8) {
    const hw = halfWidth((base - y) / height) - 3;
    g.moveTo(cx - hw, y).lineTo(cx + hw, y);
  }
  g.stroke({ width: 1, color: 0x22272e, alpha: 0.45 });
  if (ruined) {
    g.poly([cx + 14, base - 30, cx + 38, base - 24, cx + 30, base - 6, cx + 10, base - 10]).fill(
      P.attic,
    );
  }
  // Lanterne de ventilation à lames et son petit toit retroussé.
  const top = base - height;
  g.rect(cx - neck, top - 34, neck * 2, 34).fill(ruined ? 0x4a3a2a : P.woodDark);
  for (let y = top - 30; y < top - 2; y += 6) {
    g.rect(cx - neck + 3, y, neck * 2 - 6, 3).fill(ruined ? 0x5d4a36 : P.wood);
  }
  g.poly([
    cx - 40,
    top - 30,
    cx - 32,
    top - 36,
    cx,
    top - 64,
    cx + 32,
    top - 36,
    cx + 40,
    top - 30,
  ]).fill(slate);
  g.poly([cx - 40, top - 30, cx - 32, top - 36, cx, top - 64, cx, top - 30]).fill({
    color: 0xffffff,
    alpha: 0.09,
  });
  g.rect(cx - 2, top - 76, 4, 14).fill(P.brass);
  g.circle(cx, top - 78, 4).fill(P.brass);
}

function chimney(g: Graphics, x: number, roofY: number, apex: number, ruined: boolean): void {
  const top = apex - 70;
  g.rect(x, top, 34, roofY - top).fill(ruined ? P.brickDark : P.brick);
  for (let y = top + 4; y < roofY; y += 10) {
    for (let xx = x + ((y / 10) % 2 ? 0 : 6); xx < x + 32; xx += 12) {
      g.rect(xx + 1, y, 10, 7).fill({ color: P.brickDark, alpha: 0.4 });
    }
  }
  g.rect(x - 5, top - 8, 44, 10).fill(0x6b3a28);
  if (ruined) g.poly([x + 4, top - 8, x + 20, top - 8, x + 12, top + 14]).fill(0x1c1712);
}

/** Toit à pignon coupé sur chaque colonne : ardoise, combles et charpente apparente. */
function drawRoofs(g: Graphics, rng: Rng, building: Building): void {
  for (let col = 0; col < BUILDING.columns; col++) {
    const rooms = building.rooms.filter((r) => r.col === col && r.level >= 0);
    if (rooms.length === 0) continue;
    const top = rooms.reduce((a, b) => (b.level > a.level ? b : a));
    const x = colX(col);
    const base = levelTop(top.level);
    const apex = base - ROOF_H;
    const cx = x + W / 2;
    const ruined = top.ruined || top.type === null;
    g.poly([x - EAVE, base + 4, cx, apex, x + W + EAVE, base + 4]).fill(
      top.ruined ? 0x4a4440 : P.slate,
    );
    g.poly([x - EAVE, base + 4, cx, apex, cx, apex + 10, x - EAVE + 12, base + 4]).fill({
      color: P.slateLight,
      alpha: 0.5,
    });
    // Combles.
    const inset = SLATE * 1.5;
    g.poly([x + inset * 0.6, base, cx, apex + inset, x + W - inset * 0.6, base]).fill(P.attic);
    // Ferme : entrait, poinçon, arbalétriers.
    g.rect(x + 6, base - 10, W - 12, 10).fill(P.truss);
    g.rect(cx - 4, apex + inset, 8, base - apex - inset).fill(P.truss);
    g.moveTo(cx, apex + inset + 30)
      .lineTo(x + 70, base - 10)
      .moveTo(cx, apex + inset + 30)
      .lineTo(x + W - 70, base - 10);
    g.stroke({ width: 6, color: P.truss });
    if (top.type === null) {
      // Toit provisoire de planches sur un emplacement vide.
      g.poly([x - EAVE, base + 4, cx, apex, x + W + EAVE, base + 4]).fill({
        color: 0xb08a5a,
        alpha: 0.85,
      });
      for (let i = 1; i < 6; i++) {
        g.moveTo(x - EAVE + ((cx - x + EAVE) * i) / 6, base + 4 - ((base - apex) * i) / 6)
          .lineTo(x + W + EAVE - ((x + W + EAVE - cx) * i) / 6, base + 4 - ((base - apex) * i) / 6)
          .stroke({ width: 2, color: P.woodDark, alpha: 0.6 });
      }
    } else if (ruined) {
      // Ardoises arrachées : la charpente apparaît, la lumière tombe jusqu'au sol.
      for (const [side, frac] of [
        [-1, 0.45],
        [1, 0.62],
      ] as const) {
        const ex = side < 0 ? x - EAVE : x + W + EAVE;
        const hx = ex + (cx - ex) * frac;
        const hy = base + 4 + (apex - base - 4) * frac;
        const pts: number[] = [];
        for (let k = 0; k < 9; k++) {
          const along = (k / 8 - 0.5) * 46;
          const depth = k % 2 ? 8 : 26 + rng.range(-4, 4);
          pts.push(
            hx + along * (side < 0 ? 1 : -1) * 0.55,
            hy - along * 0.45 + (k === 0 || k === 8 ? 0 : depth * 0.5),
          );
        }
        g.poly(pts).fill(P.attic);
        g.moveTo(hx - 18, hy + 6)
          .lineTo(hx + 18, hy + 14)
          .stroke({ width: 3, color: P.truss });
        g.poly([
          hx - 10,
          hy + 10,
          hx + 10,
          hy + 10,
          hx + 46,
          floorY(top.level),
          hx + 10,
          floorY(top.level),
        ]).fill({
          color: P.windowLight,
          alpha: 0.07,
        });
      }
    }
    // Pagode et cheminée selon les salles de la colonne.
    const types = building.rooms.filter((r) => r.col === col).map((r) => r.type);
    if (types.includes('malting')) pagoda(g, cx, apex + 30, ruined);
    if (types.includes('stillHouse'))
      chimney(g, x + W * 0.72, base - (base - apex) * 0.45, apex, ruined);
  }
}

function dashedRect(g: Graphics, x: number, y: number, w: number, h: number): void {
  const dash = 14;
  const gap = 9;
  const edges: [number, number, number, number][] = [
    [x, y, x + w, y],
    [x + w, y, x + w, y + h],
    [x + w, y + h, x, y + h],
    [x, y + h, x, y],
  ];
  for (const [ax, ay, bx, by] of edges) {
    const len = Math.hypot(bx - ax, by - ay);
    for (let d = 0; d < len; d += dash + gap) {
      const t0 = d / len;
      const t1 = Math.min(1, (d + dash) / len);
      g.moveTo(ax + (bx - ax) * t0, ay + (by - ay) * t0).lineTo(
        ax + (bx - ax) * t1,
        ay + (by - ay) * t1,
      );
    }
  }
}

const label = (text: string, size: number, color: number, family = 'Alegreya Sans') =>
  new Text({
    text,
    style: {
      fontFamily: family,
      fontSize: size,
      fill: color,
      // L'onciale n'existe qu'en graisse normale.
      fontWeight: family === 'Alegreya Sans' ? '700' : '400',
    },
    resolution: 2,
  });

/** Emplacements achetables : cadre en pointillés, « + » et prix. */
function drawSlots(building: Building): Container {
  const container = new Container();
  const g = new Graphics();
  const price = formatMoney(slotCost(building));
  for (const cell of purchasableCells(building)) {
    const x = colX(cell.col) + 12;
    const y = levelTop(cell.level) + 12;
    g.roundRect(x, y, W - 24, H - 24, 12).fill({ color: 0xfff6dc, alpha: 0.12 });
    dashedRect(g, x, y, W - 24, H - 24);
    const cx = colX(cell.col) + W / 2;
    const cy = levelTop(cell.level) + H / 2 - 12;
    g.circle(cx, cy, 24).fill({ color: P.brass, alpha: 0.9 });
    g.rect(cx - 12, cy - 2.5, 24, 5).fill(P.attic);
    g.rect(cx - 2.5, cy - 12, 5, 24).fill(P.attic);
    const text = label(price, 22, P.brassLight);
    text.anchor.set(0.5, 0);
    text.position.set(cx, cy + 32);
    container.addChild(text);
  }
  g.stroke({ width: 3, color: P.brassLight, alpha: 0.9 });
  container.addChildAt(g, 0);
  return container;
}

/** Plaques de bois portant le nom des salles (une par groupe fusionné). */
function drawPlaques(building: Building): Container {
  const container = new Container();
  const plaque = (room: Room, cols: number, name: string, tilt: number) => {
    const text = label(name, 17, P.parchment, 'Uncial Antiqua');
    const width = text.width + 26;
    const board = new Graphics()
      .roundRect(0, 0, width, 28, 5)
      .fill(P.woodDark)
      .stroke({ width: 2, color: P.brass });
    const sign = new Container();
    text.position.set(13, 3);
    sign.addChild(board, text);
    sign.pivot.set(width / 2, 0);
    sign.position.set(colX(room.col) + (W * cols) / 2, levelTop(room.level) + 16);
    sign.rotation = tilt;
    container.addChild(sign);
  };
  const grouped = new Set<number>();
  for (const group of roomGroups(building)) {
    const first = building.rooms.find((r) => r.id === group.roomIds[0])!;
    group.roomIds.forEach((id) => grouped.add(id));
    const suffix = group.cols.length > 1 ? ` ×${group.cols.length}` : '';
    plaque(first, group.cols.length, t(`room.${group.type}` as MessageKey) + suffix, 0);
  }
  for (const room of building.rooms) {
    if (grouped.has(room.id)) continue;
    const name = room.type ? t(`room.${room.type}` as MessageKey) : t('room.empty');
    plaque(room, 1, name, room.ruined ? -0.06 : 0);
  }
  return container;
}

/** Structure du bâtiment par-dessus les salles : murs, escaliers, toits et plaques. */
export function drawShell(building: Building, rng: Rng): Container {
  const container = new Container();
  const g = new Graphics();
  drawRoofs(g, rng, building);
  drawWalls(g, rng, building);
  drawStairs(g, building);
  container.addChild(g, drawPlaques(building));
  return container;
}

/** Emplacements achetables, affichés seulement en mode « Agrandir ». */
export { drawSlots };
