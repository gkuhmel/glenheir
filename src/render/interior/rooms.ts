import { Graphics } from 'pixi.js';
import type { RoomType } from '../../data/content';
import type { Rng } from '../../sim/rng';
import { ROOM } from './layout';
import { INTERIOR as P } from './palette';

/** Contexte de dessin d'une salle : coordonnées locales, (0, 0) en haut à gauche. */
interface Ctx {
  g: Graphics;
  rng: Rng;
  w: number;
  h: number;
  /** Haut du plancher, là où se posent les pieds. */
  floor: number;
  ruined: boolean;
  level: number;
}

// ---------------------------------------------------------------- Murs et sols

function stoneWall(c: Ctx, base: readonly number[] = P.stone): void {
  if (c.level < 0) return vault(c);
  plainStone(c, base);
}

function plainStone(c: Ctx, base: readonly number[]): void {
  const { g, rng, w, floor } = c;
  g.rect(0, 0, w, floor).fill(P.mortar);
  for (let y = 0; y < floor; y += 22) {
    let x = -rng.range(0, 30);
    while (x < w) {
      const bw = rng.range(32, 54);
      g.roundRect(x + 1.5, y + 1.5, bw - 3, 19, 3).fill(rng.pick(base));
      g.rect(x + 3, y + 3, bw * 0.5, 3).fill({ color: 0xffffff, alpha: 0.06 });
      x += bw;
    }
  }
}

function whitewashWall(c: Ctx): void {
  if (c.level < 0) return vault(c);
  const { g, rng, w, floor } = c;
  g.rect(0, 0, w, floor).fill(P.whitewash);
  for (let i = 0; i < 6; i++) {
    g.ellipse(rng.range(0, w), rng.range(0, floor), rng.range(20, 50), rng.range(10, 30)).fill({
      color: P.whitewashShade,
      alpha: 0.16,
    });
  }
  // Lambris de bois en bas des murs.
  g.rect(0, floor - 46, w, 46).fill(P.wood);
  for (let x = 8; x < w; x += 36)
    g.rect(x, floor - 40, 28, 34).stroke({ width: 1.5, color: P.woodDark });
  g.rect(0, floor - 48, w, 4).fill(P.woodDark);
}

/** Voûte de pierre des caves. */
function vault(c: Ctx): void {
  const { g, w, floor } = c;
  plainStone(c, [0x7a7062, 0x6f665a, 0x857a6b]);
  g.rect(0, 0, w, floor).fill({ color: 0x000000, alpha: 0.18 });
  const pts: number[] = [0, 0, w, 0, w, 60];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push(w - t * w, 60 - Math.sin(t * Math.PI) * 50);
  }
  pts.push(0, 60);
  g.poly(pts).fill(0x51493f);
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = t * w;
    const y = 60 - Math.sin(t * Math.PI) * 50;
    g.roundRect(x - 9, y - 6, 18, 12, 3)
      .fill(0x8a7f6e)
      .stroke({ width: 1, color: P.mortar });
  }
}

function planks(c: Ctx): void {
  const { g, rng, w, h, floor } = c;
  g.rect(0, floor, w, h - floor).fill(P.plankDark);
  for (let x = -rng.range(0, 40); x < w; x += rng.range(40, 70)) {
    g.rect(Math.max(0, x), floor + 1, 70, 6).fill(rng.pick(P.plank));
  }
  g.rect(0, floor, w, 2).fill({ color: 0xffffff, alpha: 0.12 });
}

function flags(c: Ctx): void {
  const { g, rng, w, h, floor } = c;
  g.rect(0, floor, w, h - floor).fill(P.mortar);
  for (let x = -rng.range(0, 30); x < w; x += rng.range(34, 52)) {
    g.rect(Math.max(0, x) + 1, floor + 1, 46, h - floor - 2).fill(rng.pick(P.flag));
  }
}

function ceilingBeams(c: Ctx): void {
  const { g, w } = c;
  g.rect(0, 0, w, 12).fill(P.beam);
  for (let x = 20; x < w; x += 70) {
    g.rect(x, 0, 16, 20).fill(P.woodDark);
    g.rect(x + 2, 2, 12, 3).fill({ color: 0xffffff, alpha: 0.08 });
  }
}

function archWindow(c: Ctx, x: number, y: number, ww: number, wh: number): void {
  const { g, ruined } = c;
  g.roundRect(x - 6, y - 6, ww + 12, wh + 10, ww / 2).fill(0x6e6556);
  g.roundRect(x, y, ww, wh, ww / 2).fill(ruined ? 0x6d7a7e : P.glass);
  g.roundRect(x + 3, y + 3, ww * 0.4, wh * 0.5, ww / 3).fill({ color: 0xffffff, alpha: 0.25 });
  g.moveTo(x + ww / 2, y).lineTo(x + ww / 2, y + wh);
  g.moveTo(x, y + wh * 0.55).lineTo(x + ww, y + wh * 0.55);
  g.stroke({ width: 2.5, color: P.woodDark });
  g.rect(x - 8, y + wh + 2, ww + 16, 6).fill(0x9d927f);
  if (ruined) {
    g.poly([x + 4, y + wh * 0.6, x + ww * 0.5, y + wh * 0.8, x + 6, y + wh - 4]).fill(0x2a2520);
    g.rect(x - 4, y + wh * 0.3, ww + 8, 6).fill(P.woodDark);
    g.rect(x - 4, y + wh * 0.65, ww + 8, 6).fill(P.wood);
  } else {
    // Rai de lumière qui tombe sur le sol.
    g.poly([x, y + wh, x + ww, y + wh, x + ww + 70, c.floor, x + 40, c.floor]).fill({
      color: P.windowLight,
      alpha: 0.12,
    });
  }
}

function lamp(c: Ctx, x: number): void {
  const { g, ruined } = c;
  // Suspendue sous les plaques de nom, au-dessus des machines.
  g.moveTo(x, 12).lineTo(x, 60).stroke({ width: 1.5, color: 0x2a241c });
  g.poly([x - 12, 72, x + 12, 72, x + 6, 60, x - 6, 60]).fill(0x2f3a36);
  if (!ruined) {
    g.circle(x, 76, 34).fill({ color: P.lamp, alpha: 0.12 });
    g.circle(x, 75, 6).fill(P.lamp);
  }
}

// ---------------------------------------------------------------- Objets

function sack(g: Graphics, x: number, y: number, s: number, ruined: boolean): void {
  g.roundRect(x - 13 * s, y - 30 * s, 26 * s, 30 * s, 9 * s).fill(ruined ? P.sackDark : P.sack);
  g.rect(x - 7 * s, y - 33 * s, 14 * s, 5 * s).fill(P.sackDark);
  g.moveTo(x - 8 * s, y - 18 * s)
    .lineTo(x + 8 * s, y - 18 * s)
    .stroke({ width: 1, color: P.sackDark });
}

function barrelSide(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  ruined: boolean,
): void {
  g.roundRect(x, y, w, h, h * 0.45).fill(ruined ? 0x5f4630 : P.barrel);
  for (let i = 1; i < 5; i++) g.moveTo(x + 4, y + (h * i) / 5).lineTo(x + w - 4, y + (h * i) / 5);
  g.stroke({ width: 0.8, color: 0x4a3020, alpha: 0.6 });
  for (const fx of [0.18, 0.82]) g.rect(x + w * fx - 2, y, 4, h).fill(P.hoop);
  g.ellipse(x + w / 2, y + h / 2, 2.5, 2.5).fill(0x2a1c10);
}

/** Fût debout, vu de face. */
function barrelUpright(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  ruined: boolean,
): void {
  const pts = [x, y, x + w, y, x + w + 4, y + h / 2, x + w, y + h, x, y + h, x - 4, y + h / 2];
  g.poly(pts).fill(ruined ? 0x5f4630 : P.barrel);
  for (let i = 1; i < 4; i++) g.moveTo(x + (w * i) / 4, y).lineTo(x + (w * i) / 4, y + h);
  g.stroke({ width: 0.8, color: 0x4a3020, alpha: 0.5 });
  for (const fy of [0.15, 0.4, 0.6, 0.85]) g.rect(x - 3, y + h * fy - 2, w + 6, 4).fill(P.hoop);
}

function bottles(
  g: Graphics,
  rng: Rng,
  x: number,
  y: number,
  count: number,
  ruined: boolean,
): void {
  for (let i = 0; i < count; i++) {
    if (ruined && rng.chance(0.5)) continue;
    const bx = x + i * 11;
    const color = rng.pick(P.bottle);
    g.roundRect(bx, y - 22, 8, 22, 2).fill(color);
    g.rect(bx + 2.5, y - 29, 3, 8).fill(color);
    g.rect(bx + 1, y - 15, 6, 6).fill(P.parchment);
  }
}

function shelf(g: Graphics, x: number, y: number, w: number): void {
  g.rect(x, y, w, 5).fill(P.woodDark);
  g.rect(x + 4, y + 5, 3, 8).fill(P.woodDark);
  g.rect(x + w - 7, y + 5, 3, 8).fill(P.woodDark);
}

function table(g: Graphics, x: number, floor: number, w: number, cloth: boolean): void {
  g.rect(x + 6, floor - 34, 5, 34).fill(P.woodDark);
  g.rect(x + w - 11, floor - 34, 5, 34).fill(P.woodDark);
  g.rect(x, floor - 40, w, 7).fill(P.wood);
  if (cloth)
    g.poly([x - 3, floor - 41, x + w + 3, floor - 41, x + w, floor - 28, x, floor - 28]).fill(
      P.cloth,
    );
}

function chair(g: Graphics, x: number, floor: number, facing: 1 | -1): void {
  g.rect(x, floor - 22, 18, 4).fill(P.wood);
  g.rect(x + 1, floor - 18, 3, 18).fill(P.woodDark);
  g.rect(x + 14, floor - 18, 3, 18).fill(P.woodDark);
  const back = facing === 1 ? x : x + 15;
  g.rect(back, floor - 46, 3, 26).fill(P.woodDark);
}

function pipe(g: Graphics, pts: number[], width: number, color: number): void {
  g.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!);
  g.stroke({ width, color, join: 'round', cap: 'round' });
  g.moveTo(pts[0]!, pts[1]! - width * 0.25);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]! - width * 0.25);
  g.stroke({ width: width * 0.3, color: 0xffffff, alpha: 0.18, join: 'round', cap: 'round' });
}

// ---------------------------------------------------------------- Salles

function malting(c: Ctx): void {
  const { g, rng, w, floor, ruined } = c;
  stoneWall(c);
  ceilingBeams(c);
  archWindow(c, 40, 46, 46, 70);
  lamp(c, 150);
  // Four à malt : bouche de brique et feu de tourbe.
  const kx = w - 96;
  g.rect(kx, floor - 120, 86, 120).fill(P.brick);
  for (let y = floor - 116; y < floor; y += 10) {
    for (let x = kx + ((y / 10) % 2 ? 0 : 8); x < kx + 82; x += 16) {
      g.rect(x + 1, y, 14, 8).fill({ color: P.brickDark, alpha: 0.35 });
    }
  }
  g.rect(kx - 6, floor - 128, 98, 10).fill(P.brickDark);
  g.roundRect(kx + 20, floor - 50, 46, 50, 22).fill(0x1c120c);
  if (!ruined) {
    g.ellipse(kx + 43, floor - 10, 20, 10).fill(P.fire);
    g.ellipse(kx + 43, floor - 12, 10, 6).fill(P.fireCore);
    g.circle(kx + 43, floor - 20, 44).fill({ color: P.fire, alpha: 0.1 });
  } else {
    g.ellipse(kx + 43, floor - 6, 18, 6).fill(0x3a332c);
  }
  // Orge en germination étalée sur le sol de maltage.
  if (!ruined) {
    const pts: number[] = [12, floor];
    for (let x = 12; x <= kx - 16; x += 12)
      pts.push(x, floor - 10 - Math.sin(x / 26) * 5 - rng.range(0, 3));
    pts.push(kx - 16, floor);
    g.poly(pts).fill(P.grainDark);
    for (let i = 0; i < 120; i++) {
      g.circle(rng.range(16, kx - 20), floor - rng.range(2, 12), 1.3).fill(P.grain);
    }
  }
  // Sacs d'orge et pelle de bois (shiel).
  for (const [x, s] of [
    [26, 1],
    [52, 0.95],
    [39, 0.9],
  ] as const) {
    sack(g, x, s === 0.9 ? floor - 26 : floor, s, ruined);
  }
  g.moveTo(kx - 30, floor - 4)
    .lineTo(kx - 12, floor - 88)
    .stroke({ width: 3, color: P.woodLight });
  g.roundRect(kx - 40, floor - 8, 22, 10, 3).fill(P.woodLight);
}

function mashing(c: Ctx): void {
  const { g, w, floor, ruined } = c;
  stoneWall(c);
  ceilingBeams(c);
  archWindow(c, w - 70, 46, 40, 64);
  lamp(c, 70);
  const body = ruined ? P.rust : P.iron;
  const lid = ruined ? P.verdigris : P.copper;
  // Trémie à mouture en bois.
  g.poly([24, 34, 96, 34, 80, 78, 40, 78]).fill(P.wood).stroke({ width: 2, color: P.woodDark });
  g.rect(54, 78, 12, 26).fill(P.woodDark);
  // Cuve d'empâtage : grand cuveau de fonte, couvercle de cuivre.
  const x = 70;
  const tw = 150;
  const top = floor - 118;
  g.roundRect(x, top, tw, 104, 10).fill(body);
  g.rect(x, top + 28, tw, 5).fill({ color: 0x000000, alpha: 0.25 });
  g.rect(x, top + 70, tw, 5).fill({ color: 0x000000, alpha: 0.25 });
  for (let rx = x + 10; rx < x + tw; rx += 18) {
    for (const ry of [top + 30, top + 72]) g.circle(rx, ry + 2, 1.6).fill(P.ironLight);
  }
  g.rect(x + 8, top + 6, 22, 92).fill({ color: 0xffffff, alpha: 0.06 });
  g.ellipse(x + tw / 2, top, tw / 2 + 4, 16).fill(lid);
  g.ellipse(x + tw / 2 - 20, top - 4, tw / 4, 6).fill({ color: 0xffffff, alpha: 0.2 });
  // Moteur du râteau.
  g.rect(x + tw / 2 - 14, top - 34, 28, 22)
    .fill(P.iron)
    .stroke({ width: 1.5, color: 0x2a302d });
  g.circle(x + tw / 2, top - 23, 7).fill(P.brass);
  pipe(g, [60, 104, 60, 120, x + 6, top + 10], 7, ruined ? P.rust : P.copperDark);
  // Pieds et tuyau vers les cuves de fermentation.
  g.rect(x + 14, floor - 14, 10, 14).fill(0x2a302d);
  g.rect(x + tw - 24, floor - 14, 10, 14).fill(0x2a302d);
  pipe(g, [x + tw, floor - 40, w - 10, floor - 40], 8, ruined ? P.rust : P.copper);
  if (ruined) {
    g.ellipse(x + tw / 2, floor - 2, 50, 5).fill({ color: 0x4a3a22, alpha: 0.6 });
  }
}

function fermentation(c: Ctx): void {
  const { g, w, floor, ruined } = c;
  stoneWall(c);
  ceilingBeams(c);
  lamp(c, w / 2);
  // Deux washbacks en pin d'Oregon cerclés de fer.
  for (const x of [24, 160]) {
    const top = 60;
    const vw = 116;
    g.rect(x, top, vw, floor - top).fill(ruined ? 0x6e5236 : 0x9b6a3c);
    for (let sx = x + 9; sx < x + vw; sx += 10) {
      g.moveTo(sx, top).lineTo(sx, floor).stroke({ width: 1, color: 0x5e3f22, alpha: 0.55 });
    }
    for (const by of [top + 18, top + 58, top + 98]) g.rect(x - 2, by, vw + 4, 5).fill(P.hoop);
    g.rect(x + 6, top + 4, 18, floor - top - 8).fill({ color: 0xffffff, alpha: 0.07 });
    // Couvercle et trappe.
    g.rect(x - 6, top - 10, vw + 12, 12).fill(ruined ? P.woodDark : P.wood);
    g.rect(x + vw / 2 - 12, top - 16, 24, 7).fill(P.woodDark);
    if (ruined) g.poly([x + 30, top - 10, x + 60, top - 10, x + 52, top + 6]).fill(0x1c1712);
  }
  // Passerelle et rambarde.
  g.rect(0, 46, w, 6).fill(P.woodDark);
  for (let x = 6; x < w; x += 30) g.rect(x, 22, 3, 24).fill(P.woodDark);
  g.rect(0, 22, w, 3).fill(P.woodDark);
}

/** Alambic à repasse : panse en oignon, col de cygne et bras de lyne. */
function potStill(c: Ctx, cx: number, base: number, scale: number, condenserX: number): void {
  const { g, ruined } = c;
  const body = ruined ? P.rust : P.copper;
  const light = ruined ? 0x947556 : P.copperLight;
  const dark = ruined ? 0x4f3a26 : P.copperDark;
  const bw = 62 * scale;
  const bh = 66 * scale;
  // Foyer en brique.
  g.rect(cx - bw - 6, base - 28, bw * 2 + 12, 28).fill(P.brick);
  g.roundRect(cx - 14, base - 22, 28, 22, 8).fill(0x1c120c);
  if (!ruined) g.ellipse(cx, base - 6, 10, 5).fill(P.fire);
  // Panse.
  const top = base - 28 - bh;
  g.ellipse(cx, base - 28 - bh / 2, bw, bh / 2).fill(body);
  g.ellipse(cx + bw * 0.25, base - 28 - bh * 0.4, bw * 0.6, bh * 0.38).fill({
    color: dark,
    alpha: 0.35,
  });
  g.ellipse(cx - bw * 0.42, base - 28 - bh * 0.62, bw * 0.18, bh * 0.22).fill({
    color: light,
    alpha: 0.7,
  });
  // Col qui s'affine.
  const neckH = 72 * scale;
  g.poly([
    cx - 20 * scale,
    top + 6,
    cx + 20 * scale,
    top + 6,
    cx + 8 * scale,
    top - neckH,
    cx - 8 * scale,
    top - neckH,
  ]).fill(body);
  g.poly([
    cx - 14 * scale,
    top + 4,
    cx - 8 * scale,
    top + 4,
    cx - 4 * scale,
    top - neckH,
    cx - 6 * scale,
    top - neckH,
  ]).fill({
    color: light,
    alpha: 0.6,
  });
  g.ellipse(cx, top - neckH, 10 * scale, 5 * scale).fill(dark);
  // Bras de lyne vers le condenseur.
  pipe(
    g,
    [cx, top - neckH, cx + 20, top - neckH - 10, condenserX, top - neckH + 14],
    9 * scale,
    body,
  );
  // Rivets.
  for (let a = 0.2; a < Math.PI - 0.2; a += 0.35) {
    g.circle(cx - Math.cos(a) * bw * 0.92, base - 28 - bh / 2 + Math.sin(a) * 2, 1.4).fill(dark);
  }
  if (ruined) {
    for (let i = 0; i < 5; i++) {
      g.circle(
        cx + c.rng.range(-bw * 0.7, bw * 0.7),
        base - 28 - c.rng.range(10, bh - 10),
        c.rng.range(3, 7),
      ).fill({
        color: P.verdigris,
        alpha: 0.7,
      });
    }
  }
}

function stillHouse(c: Ctx): void {
  const { g, w, floor, ruined } = c;
  whitewashWall(c);
  ceilingBeams(c);
  archWindow(c, w / 2 - 22, 40, 44, 66);
  // Condenseur vertical à droite.
  const cx = w - 34;
  g.roundRect(cx - 14, 44, 28, floor - 60, 8).fill(ruined ? P.rust : P.copper);
  g.rect(cx - 10, 50, 6, floor - 72).fill({ color: 0xffffff, alpha: 0.2 });
  g.rect(cx - 16, floor - 16, 32, 16).fill(P.iron);
  potStill(c, 82, floor, 1, cx);
  potStill(c, 186, floor, 0.78, cx);
  // Coffre à alcool (spirit safe) en laiton et verre.
  const sx = 120;
  const sy = floor - 64;
  g.roundRect(sx, sy, 34, 26, 3)
    .fill(ruined ? 0x7a6a40 : P.brass)
    .stroke({ width: 1.5, color: 0x6b5520 });
  g.rect(sx + 5, sy + 5, 24, 14).fill(ruined ? 0x5d6466 : P.glass);
  g.rect(sx + 14, sy + 26, 6, floor - sy - 26).fill(0x6b5520);
}

function reception(c: Ctx): void {
  const { g, rng, w, floor, ruined } = c;
  whitewashWall(c);
  ceilingBeams(c);
  lamp(c, w / 2);
  // Carte encadrée et bannière de tartan.
  g.rect(36, 50, 70, 50).fill(P.woodDark);
  g.rect(40, 54, 62, 42).fill(ruined ? 0xbfb08f : P.parchment);
  g.moveTo(48, 70).bezierCurveTo(60, 60, 74, 84, 94, 66).stroke({ width: 2, color: 0x6e8a9a });
  g.circle(70, 76, 3).fill(0x9b3a24);
  if (!ruined) {
    for (let i = 0; i < 3; i++) g.rect(126 + i * 10, 40, 10, 64).fill(P.tartan[i]!);
    g.poly([126, 104, 156, 104, 141, 116]).fill(P.tartan[0]!);
  }
  // Étagère de bouteilles derrière le guichet.
  shelf(g, 182, 64, 96);
  shelf(g, 182, 100, 96);
  bottles(g, rng, 188, 64, 8, ruined);
  bottles(g, rng, 188, 100, 8, ruined);
  // Guichet : comptoir de bois, cloche de laiton, registre.
  const cx = 150;
  g.rect(cx, floor - 62, 130, 62).fill(ruined ? P.woodDark : P.wood);
  for (let x = cx + 8; x < cx + 126; x += 30)
    g.rect(x, floor - 52, 22, 44).stroke({ width: 1.5, color: P.woodDark });
  g.rect(cx - 6, floor - 68, 142, 8).fill(P.woodLight);
  if (!ruined) {
    g.ellipse(cx + 28, floor - 72, 8, 6).fill(P.brass);
    g.circle(cx + 28, floor - 79, 2).fill(P.brass);
    g.rect(cx + 70, floor - 74, 26, 6).fill(0x7a2b2b);
    g.rect(cx + 72, floor - 75, 22, 2).fill(P.parchment);
  } else {
    g.poly([cx + 60, floor - 68, cx + 100, floor - 68, cx + 84, floor - 40]).fill(0x1c1712);
  }
  // Banc pour les visiteurs.
  g.rect(20, floor - 26, 80, 7).fill(P.wood);
  g.rect(26, floor - 19, 5, 19).fill(P.woodDark);
  g.rect(88, floor - 19, 5, 19).fill(P.woodDark);
}

function tasting(c: Ctx): void {
  const { g, rng, w, floor, ruined } = c;
  stoneWall(c);
  ceilingBeams(c);
  lamp(c, w / 2);
  barrelSide(g, 30, 46, 70, 46, ruined);
  barrelSide(g, 200, 46, 70, 46, ruined);
  table(g, 70, floor, 160, true);
  for (let x = 84; x < 220; x += 24) {
    g.poly([x, floor - 52, x + 8, floor - 52, x + 6, floor - 44, x + 2, floor - 44]).fill({
      color: P.glass,
      alpha: 0.8,
    });
    g.rect(x + 2, floor - 47, 4, 3).fill(P.bottle[3]!);
  }
  bottles(g, rng, 140, floor - 41, 2, ruined);
  chair(g, 44, floor, 1);
  chair(g, 238, floor, -1);
}

function shop(c: Ctx): void {
  const { g, rng, w, floor, ruined } = c;
  whitewashWall(c);
  ceilingBeams(c);
  lamp(c, w / 2);
  for (const y of [56, 92, 128]) {
    shelf(g, 20, y, 120);
    bottles(g, rng, 26, y, 10, ruined);
  }
  barrelUpright(g, 170, floor - 56, 40, 56, ruined);
  bottles(g, rng, 176, floor - 56, 3, ruined);
  g.rect(222, floor - 54, 66, 54).fill(P.wood);
  g.rect(218, floor - 60, 74, 8).fill(P.woodLight);
  g.rect(240, floor - 78, 30, 18).fill(P.brass);
}

function cafe(c: Ctx): void {
  const { g, w, floor, ruined } = c;
  whitewashWall(c);
  ceilingBeams(c);
  lamp(c, 80);
  lamp(c, 220);
  // Ardoise du menu.
  g.rect(30, 50, 70, 50).fill(P.woodDark);
  g.rect(34, 54, 62, 42).fill(0x2a2f2c);
  for (let i = 0; i < 4; i++)
    g.rect(40, 60 + i * 9, 30 + (i % 2) * 14, 2).fill({ color: 0xffffff, alpha: 0.6 });
  // Comptoir avec théière et gâteaux.
  g.rect(w - 110, floor - 58, 100, 58).fill(P.wood);
  g.rect(w - 114, floor - 64, 108, 7).fill(P.woodLight);
  g.ellipse(w - 80, floor - 72, 12, 9).fill(0x3d6b8a);
  g.rect(w - 50, floor - 74, 24, 9).fill(0xe8c48a);
  g.rect(w - 50, floor - 76, 24, 3).fill(0xf2e6d0);
  table(g, 40, floor, 70, !ruined);
  table(g, 140, floor, 50, !ruined);
  chair(g, 18, floor, 1);
  chair(g, 116, floor, -1);
}

function toilets(c: Ctx): void {
  const { g, w, floor, ruined } = c;
  whitewashWall(c);
  ceilingBeams(c);
  lamp(c, w / 2);
  for (const [x, sign] of [
    [40, 0x2f4a6b],
    [170, 0x7a2b2b],
  ] as const) {
    g.rect(x, floor - 120, 70, 120).fill(P.woodDark);
    g.rect(x + 5, floor - 114, 60, 114).fill(ruined ? 0x5d4630 : P.wood);
    g.circle(x + 54, floor - 58, 3).fill(P.brass);
    g.roundRect(x + 22, floor - 100, 26, 26, 13).fill(sign);
    g.circle(x + 35, floor - 92, 4).fill(P.cloth);
    g.rect(x + 31, floor - 87, 8, 10).fill(P.cloth);
  }
  g.roundRect(124, floor - 70, 34, 16, 6).fill(0xe9e4da);
  g.rect(136, floor - 54, 10, 54).fill(0xd6d0c4);
}

function staffRoom(c: Ctx): void {
  const { g, w, floor, ruined } = c;
  stoneWall(c);
  ceilingBeams(c);
  archWindow(c, 120, 46, 40, 60);
  lamp(c, 70);
  // Vestiaires et patères.
  for (let i = 0; i < 3; i++) {
    g.rect(w - 100 + i * 30, floor - 120, 28, 120).fill(ruined ? 0x56604f : 0x6f7d66);
    g.rect(w - 92 + i * 30, floor - 100, 12, 3).fill(0x2a2f2c);
  }
  table(g, 40, floor, 90, false);
  chair(g, 18, floor, 1);
  chair(g, 136, floor, -1);
  // Poêle et bouilloire.
  g.rect(180, floor - 50, 40, 50).fill(0x2f3333);
  g.rect(196, floor - 120, 8, 70).fill(0x2f3333);
  g.ellipse(200, floor - 56, 12, 8).fill(ruined ? P.rust : P.copper);
}

function ginWorkshop(c: Ctx): void {
  const { g, rng, w, floor, ruined } = c;
  whitewashWall(c);
  ceilingBeams(c);
  lamp(c, 160);
  // Bocaux de botaniques.
  const jars = [0x6b8a3a, 0x8a5a87, 0xd99a3a, 0x3d6b8a, 0xb54a3a];
  for (const y of [70, 108]) {
    shelf(g, 20, y, 110);
    for (let x = 26; x < 120; x += 18) {
      g.roundRect(x, y - 22, 14, 22, 3).fill({ color: P.glass, alpha: 0.8 });
      g.rect(x + 2, y - 14, 10, 12).fill(rng.pick(jars));
      g.rect(x + 1, y - 25, 12, 4).fill(P.woodDark);
    }
  }
  // Bottes de genièvre qui sèchent.
  for (let x = 160; x < 280; x += 30) {
    g.moveTo(x, 12).lineTo(x, 34).stroke({ width: 1, color: 0x3a2a1a });
    for (let i = 0; i < 6; i++)
      g.circle(x + rng.range(-6, 6), 38 + rng.range(0, 14), 3).fill(0x2f4a5a);
  }
  // Petit alambic à gin avec son panier à botaniques.
  const cx = 210;
  g.rect(cx - 40, floor - 20, 80, 20).fill(P.brick);
  g.ellipse(cx, floor - 50, 34, 30).fill(ruined ? P.rust : P.copper);
  g.ellipse(cx - 12, floor - 60, 8, 10).fill({ color: P.copperLight, alpha: 0.6 });
  g.rect(cx - 8, floor - 110, 16, 32).fill(ruined ? P.rust : P.copper);
  g.roundRect(cx - 20, floor - 130, 40, 24, 4)
    .fill({ color: P.glass, alpha: 0.8 })
    .stroke({ width: 2, color: P.brass });
  pipe(
    g,
    [cx, floor - 130, cx + 30, floor - 140, w - 16, floor - 90],
    6,
    ruined ? P.rust : P.copper,
  );
}

/** Emplacement acheté mais vide : murs nus, échafaudage, matériaux. */
function emptySlot(c: Ctx): void {
  const { g, w, floor } = c;
  stoneWall(c, [0xa49985, 0x9a8f7c, 0xaea28e]);
  g.rect(0, 0, w, 10).fill(P.beam);
  for (const x of [40, w - 60]) {
    g.rect(x, 20, 6, floor - 20).fill(P.woodLight);
    g.rect(x + 14, 20, 6, floor - 20).fill(P.woodLight);
  }
  for (const y of [70, 130]) g.rect(30, y, w - 60, 7).fill(P.wood);
  g.moveTo(46, 70)
    .lineTo(w - 54, 130)
    .stroke({ width: 3, color: P.woodLight });
  // Pile de pierres de taille et de planches.
  for (let i = 0; i < 4; i++)
    g.rect(110 + i * 16, floor - 14 - (i % 2) * 12, 15, 12).fill(P.stone[i % 4]!);
  g.rect(180, floor - 8, 70, 6).fill(P.wood);
  g.rect(186, floor - 14, 64, 6).fill(P.woodLight);
}

const DRAWERS: Record<RoomType, (c: Ctx) => void> = {
  malting,
  mashing,
  fermentation,
  stillHouse,
  reception,
  tasting,
  shop,
  cafe,
  toilets,
  staffRoom,
  ginWorkshop,
};

// ---------------------------------------------------------------- Ruine

/** Fissures, toiles d'araignée, gravats, lierre : l'abandon par-dessus la salle. */
function decay(c: Ctx): void {
  const { g, rng, w, floor } = c;
  g.rect(0, 0, w, c.h).fill({ color: 0x2a2218, alpha: 0.32 });
  // Fissures.
  for (let i = 0; i < 3; i++) {
    let x = rng.range(20, w - 20);
    let y = rng.range(10, floor * 0.5);
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += rng.range(-14, 14);
      y += rng.range(8, 18);
      g.lineTo(x, y);
    }
  }
  g.stroke({ width: 2, color: 0x1c1712, alpha: 0.8 });
  // Toiles d'araignée dans les angles du plafond.
  for (const [cx, dir] of [
    [0, 1],
    [w, -1],
  ] as const) {
    const r = rng.range(40, 60);
    for (let a = 0; a <= 5; a++) {
      const angle = (a / 5) * (Math.PI / 2);
      g.moveTo(cx, 0).lineTo(cx + dir * Math.cos(angle) * r, Math.sin(angle) * r);
    }
    for (const k of [0.35, 0.65, 0.95]) {
      g.moveTo(cx + dir * r * k, 0);
      for (let a = 1; a <= 5; a++) {
        const angle = (a / 5) * (Math.PI / 2);
        g.lineTo(cx + dir * Math.cos(angle) * r * k * 0.95, Math.sin(angle) * r * k * 0.95);
      }
    }
    g.stroke({ width: 0.8, color: P.cobweb, alpha: 0.55 });
  }
  // Lierre qui pend du plafond.
  for (let i = 0; i < 3; i++) {
    const x = rng.range(10, w - 10);
    const len = rng.range(30, 90);
    for (let y = 8; y < len; y += 7) {
      g.circle(x + Math.sin(y / 9) * 5, y, rng.range(2.5, 4.5)).fill(rng.pick(P.ivy));
    }
  }
  // Gravats et planches tombées.
  for (let i = 0; i < 9; i++) {
    const x = rng.range(10, w - 10);
    g.poly([
      x - 8,
      floor,
      x - 4,
      floor - rng.range(5, 12),
      x + 6,
      floor - rng.range(4, 10),
      x + 9,
      floor,
    ]).fill(rng.pick(P.debris));
  }
  g.rect(rng.range(30, w - 120), floor - 8, 90, 7).fill({ color: P.woodDark, alpha: 0.95 });
  g.rect(0, floor, w, 4).fill({ color: 0x3a3026, alpha: 0.6 });
}

// ---------------------------------------------------------------- Point d'entrée

/** Dessine l'intérieur d'une case : salle (en ruine ou non) ou emplacement vide. */
export function drawRoomInterior(
  g: Graphics,
  rng: Rng,
  type: RoomType | null,
  ruined: boolean,
  level: number,
): void {
  const c: Ctx = {
    g,
    rng,
    w: ROOM.width,
    h: ROOM.height,
    floor: ROOM.height - ROOM.floor,
    ruined,
    level,
  };
  if (type === null) emptySlot(c);
  else DRAWERS[type](c);
  if (level > 0) planks(c);
  else flags(c);
  if (ruined) decay(c);
}
