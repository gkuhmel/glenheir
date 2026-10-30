import { Container, Graphics, Text } from 'pixi.js';
import { WAREHOUSE } from '../../data/balance';
import type { Rng } from '../../sim/rng';
import type { CaskType } from '../../sim/systems/warehouse';
import { INTERIOR } from '../interior/palette';
import { CHAI, columnX, HALL_TOP, RACK_FLOOR, WORLD_HEIGHT } from './layout';

/** Couleurs du chai : pierre noircie par l'humidité, bois sombre, lumière rare et chaude. */
export const CHAI_COLORS = {
  stone: [0x4a4036, 0x544a3e, 0x40372e, 0x4e4438],
  mortar: 0x2a231d,
  cutStone: [0x8a7f6d, 0x7f7462, 0x968a76],
  cutMortar: 0x5a5144,
  damp: 0x1e1a15,
  lime: 0xb8ad95,
  ceiling: 0x1f1913,
  beam: 0x3a2818,
  beamLight: 0x543a24,
  rail: 0x5c3f26,
  railTop: 0x7a5634,
  earth: 0x4b3b2b,
  earthLight: 0x5a4733,
  gravel: [0x6b5d4b, 0x75685a, 0x5f5242],
  soil: 0x2e241a,
  windowGlow: 0xdfe8e0,
  daylight: 0xf4ead0,
  grass: 0x5e8240,
  chalk: 0xefe9dc,
  hoop: 0x2c2925,
  hoopLight: 0x4d4943,
  lamp: 0xffd27a,
  brass: 0xc9a24a,
  brassLight: 0xecd08a,
  rope: 0xb89a6a,
} as const;
const C = CHAI_COLORS;

/** Couleurs d'un fût selon son bois. */
const CASK_WOOD: Record<CaskType, { head: number; dark: number; light: number; mark: string }> = {
  exBourbon: { head: 0xa8743f, dark: 0x6e4826, light: 0xc8935a, mark: 'EB' },
  sherry: { head: 0x7a3e2a, dark: 0x4a2216, light: 0x985440, mark: 'SH' },
  newOak: { head: 0xc79a62, dark: 0x8a6438, light: 0xe0b981, mark: 'CN' },
};

/** Les murs ne vont pas tout en haut : au-dessus, la charpente et l'envers de l'ardoise. */
const WALL_TOP = HALL_TOP + 40;
const BEAM_Y = HALL_TOP + 150;
const WINDOW_Y = HALL_TOP + 64;

/** Mur de pierres irrégulières, rang par rang. */
function stoneWall(
  g: Graphics,
  rng: Rng,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  stones: readonly number[],
  mortar: number,
  course = 22,
): void {
  g.rect(x0, y0, x1 - x0, y1 - y0).fill(mortar);
  for (let y = y0; y < y1; y += course) {
    const h = Math.min(course, y1 - y);
    let x = x0 - rng.range(0, 30);
    while (x < x1) {
      const w = rng.range(28, 62);
      const left = Math.max(x0, x + 1.5);
      const right = Math.min(x1, x + w - 1.5);
      if (right > left) g.roundRect(left, y + 1.5, right - left, h - 3, 3).fill(rng.pick(stones));
      x += w;
    }
  }
}

/**
 * Le chai vu en coupe dans sa longueur : charpente, mur du fond noirci, fenêtres
 * hautes, porte ouverte sur le jour, rails de bois (dunnage) et sol en terre battue.
 */
export function drawHall(
  rng: Rng,
  places: number,
  canExtend: boolean,
  width: number,
  ruined = false,
): Container {
  const cols = Math.ceil(places / WAREHOUSE.tiers);
  const container = new Container();
  const g = new Graphics();
  container.addChild(g);

  drawSkyAndRoof(g, rng, width);
  // Envers du toit : voliges sombres et chevrons.
  g.rect(0, HALL_TOP, width, WALL_TOP - HALL_TOP + 10).fill(C.ceiling);
  for (let x = 12; x < width; x += 38)
    g.rect(x, HALL_TOP, 7, WALL_TOP - HALL_TOP + 10).fill(C.beam);
  stoneWall(g, rng, 0, width, WALL_TOP, RACK_FLOOR, C.stone, C.mortar);
  // Traces d'humidité et restes de chaux sur le mur.
  for (let i = 0; i < width / 70; i++) {
    g.ellipse(
      rng.range(0, width),
      rng.range(WALL_TOP + 60, RACK_FLOOR - 20),
      rng.range(20, 60),
      rng.range(30, 90),
    ).fill({ color: C.damp, alpha: 0.28 });
  }
  for (let i = 0; i < width / 160; i++) {
    g.ellipse(
      rng.range(0, width),
      rng.range(WALL_TOP + 40, BEAM_Y + 60),
      rng.range(14, 34),
      rng.range(8, 16),
    ).fill({ color: C.lime, alpha: 0.12 });
  }

  // Fenêtres hautes à barreaux, une toutes les 6 rangées.
  for (const x of windowXs(cols)) {
    g.roundRect(x - 20, WINDOW_Y, 40, 54, 18).fill(0x15110d);
    g.roundRect(x - 15, WINDOW_Y + 4, 30, 46, 14).fill(C.windowGlow);
    for (const dx of [-7, 0, 7]) g.rect(x + dx - 1, WINDOW_Y + 4, 2, 46).fill(0x2a241d);
    g.rect(x - 22, WINDOW_Y + 52, 44, 6).fill(C.cutStone[0]);
  }

  // Poutres maîtresses, poteaux et contrefiches de la charpente.
  g.rect(0, WALL_TOP + 6, width, 12).fill(C.beam);
  g.rect(0, BEAM_Y, width, 14).fill(C.beam).rect(0, BEAM_Y, width, 3).fill(C.beamLight);
  for (let col = 0; col <= cols; col += 5) {
    const x = columnX(col);
    g.rect(x - 7, WALL_TOP + 6, 14, RACK_FLOOR - WALL_TOP - 6).fill(C.beam);
    g.rect(x - 7, WALL_TOP + 6, 3, RACK_FLOOR - WALL_TOP - 6).fill(C.beamLight);
    g.poly([x - 7, BEAM_Y, x - 48, BEAM_Y, x - 7, BEAM_Y + 40]).fill(C.beam);
    g.poly([x + 7, BEAM_Y, x + 48, BEAM_Y, x + 7, BEAM_Y + 40]).fill(C.beam);
  }

  // Porte ouverte dans le pignon : un rectangle de jour, l'herbe et le battant.
  const doorX = 34;
  const doorW = 86;
  const doorTop = RACK_FLOOR - 150;
  g.roundRect(doorX - 8, doorTop - 8, doorW + 16, 158, 40).fill(C.cutStone[1]);
  g.roundRect(doorX, doorTop, doorW, 150, 36).fill(C.daylight);
  g.rect(doorX, RACK_FLOOR - 24, doorW, 24).fill(C.grass);
  g.ellipse(doorX + doorW / 2, RACK_FLOOR - 52, 50, 16).fill({ color: 0x9fb6a0, alpha: 0.5 });
  g.poly([
    doorX + doorW,
    doorTop + 16,
    doorX + doorW + 24,
    doorTop + 8,
    doorX + doorW + 24,
    RACK_FLOOR + 6,
    doorX + doorW,
    RACK_FLOOR,
  ]).fill(0x3a2a1c);
  for (let y = doorTop + 26; y < RACK_FLOOR; y += 26)
    g.rect(doorX + doorW + 2, y, 20, 3).fill(0x241a10);

  // Murs de pignon coupés aux deux bouts : pierre claire de la coupe.
  stoneWall(g, rng, 0, 26, HALL_TOP, WORLD_HEIGHT - CHAI.soil, C.cutStone, C.cutMortar, 18);
  stoneWall(
    g,
    rng,
    width - 26,
    width,
    HALL_TOP,
    WORLD_HEIGHT - CHAI.soil,
    C.cutStone,
    C.cutMortar,
    18,
  );

  // Sol en terre battue, gravier, et terre en coupe dessous.
  g.rect(0, RACK_FLOOR, width, CHAI.aisle).fill(C.earth);
  g.rect(0, RACK_FLOOR, width, 4).fill(C.earthLight);
  for (let i = 0; i < width / 6; i++) {
    g.ellipse(
      rng.range(0, width),
      rng.range(RACK_FLOOR + 6, RACK_FLOOR + CHAI.aisle - 4),
      rng.range(1.5, 4),
      rng.range(1, 2.5),
    ).fill(rng.pick(C.gravel));
  }
  // Ornières laissées par les fûts qu'on roule vers la porte.
  g.rect(0, RACK_FLOOR + 30, width, 3).fill({ color: 0x000000, alpha: 0.15 });
  g.rect(0, RACK_FLOOR + 46, width, 3).fill({ color: 0x000000, alpha: 0.15 });
  g.rect(0, RACK_FLOOR + CHAI.aisle, width, CHAI.soil).fill(C.soil);
  for (let i = 0; i < width / 40; i++) {
    g.ellipse(
      rng.range(0, width),
      rng.range(RACK_FLOOR + CHAI.aisle + 8, WORLD_HEIGHT),
      rng.range(6, 16),
      rng.range(3, 7),
    ).fill({ color: 0x3d3125, alpha: 0.9 });
  }

  // Rails de bois sur lesquels reposent les fûts, étage par étage. En ruine,
  // seuls ceux du coin où dorment les fûts du grand-oncle tiennent encore.
  const railLeft = columnX(0) - 8;
  for (let tier = 0; tier < WAREHOUSE.tiers; tier++) {
    const right = ruined
      ? columnX(RUIN_RAIL_COLS) + 8
      : columnX(Math.ceil((places - tier) / WAREHOUSE.tiers)) + 8;
    const y = RACK_FLOOR - 8 - tier * CHAI.tierHeight;
    g.rect(railLeft, y - 7, right - railLeft, 9).fill(C.rail);
    g.rect(railLeft, y - 7, right - railLeft, 2).fill(C.railTop);
    for (let x = railLeft + 20; x < right; x += 40) g.circle(x, y - 3, 1.2).fill(0x2a1c10);
  }

  if (canExtend) drawExtensionSite(g, container, cols);
  if (ruined) drawRuin(g, rng, width);
  return container;
}

/** Colonnes de rails encore debout dans le chai en ruine. */
const RUIN_RAIL_COLS = 3;

/** Abscisses des trous du toit d'un chai en ruine (le jour y entre par puits obliques). */
export function ruinHoles(width: number): number[] {
  const xs: number[] = [];
  for (let i = 0, x = 330; x < width - 120; i++, x += 420) xs.push(x + ((i * 137) % 90) - 45);
  return xs;
}

/** Toit percé, chevrons cassés, gravats, ardoises tombées, lierre et flaques. */
function drawRuin(g: Graphics, rng: Rng, width: number): void {
  const roofTop = HALL_TOP - 92;
  for (const x of ruinHoles(width)) {
    const w = rng.range(70, 110);
    // Le ciel à travers le toit et le plafond.
    const pts: number[] = [];
    const steps = 9;
    for (let k = 0; k <= steps; k++)
      pts.push(x - w / 2 + (w * k) / steps, roofTop + 10 + rng.range(0, 18));
    for (let k = steps; k >= 0; k--)
      pts.push(x - w / 2 + (w * k) / steps + rng.range(-6, 6), WALL_TOP + 8 + rng.range(-10, 8));
    g.poly(pts).fill(INTERIOR.sky[1]!);
    // Chevrons brisés qui pendent dans le trou.
    for (let k = 0; k < 3; k++) {
      const bx = x - w / 3 + k * (w / 3) + rng.range(-6, 6);
      g.poly([
        bx,
        HALL_TOP - 4,
        bx + 7,
        HALL_TOP - 4,
        bx + 18,
        HALL_TOP + 50,
        bx + 11,
        HALL_TOP + 53,
      ]).fill(C.beam);
    }
    // Lierre qui descend du trou.
    for (let k = 0; k < 4; k++) {
      let vx = x + rng.range(-w / 2, w / 2);
      let vy = WALL_TOP;
      const len = rng.range(60, 160);
      for (let d = 0; d < len; d += 9) {
        vx += rng.range(-4, 4);
        vy += 9;
        g.circle(vx, vy, rng.range(3, 5)).fill(rng.pick(INTERIOR.ivy));
      }
    }
    // Gravats et ardoises tombées sous le trou, flaque de pluie.
    g.ellipse(x + 30, RACK_FLOOR + 42, 70, 9).fill({ color: 0x8fa4ad, alpha: 0.35 });
    for (let k = 0; k < 14; k++) {
      g.roundRect(
        x + rng.range(-60, 60),
        RACK_FLOOR - rng.range(0, 22) + 6,
        rng.range(10, 22),
        rng.range(6, 12),
        3,
      ).fill(rng.chance(0.5) ? rng.pick(C.cutStone) : INTERIOR.slate);
    }
  }
  // Rails tombés au sol, un peu partout.
  for (let x = columnX(RUIN_RAIL_COLS) + 60; x < width - 120; x += rng.range(140, 260)) {
    const len = rng.range(60, 140);
    const tilt = rng.range(-14, 14);
    g.poly([
      x,
      RACK_FLOOR + 4,
      x + len,
      RACK_FLOOR + 4 + tilt,
      x + len,
      RACK_FLOOR + 12 + tilt,
      x,
      RACK_FLOOR + 12,
    ]).fill(C.rail);
  }
  // Toiles d'araignée dans les angles de la charpente.
  for (let x = 40; x < width; x += rng.range(220, 380)) {
    for (let k = 0; k < 4; k++)
      g.moveTo(x, WALL_TOP + 18).lineTo(x + 30 - k * 8, WALL_TOP + 18 + k * 10 + 10);
    g.arc(x, WALL_TOP + 18, 22, 0.2, 1.4);
    g.stroke({ width: 1, color: INTERIOR.cobweb, alpha: 0.35 });
  }
}

/** Ciel du pays, collines, et le long toit d'ardoise du chai avec ses lanternons. */
function drawSkyAndRoof(g: Graphics, rng: Rng, width: number): void {
  const sky = INTERIOR.sky;
  const bands = 12;
  for (let i = 0; i < bands; i++) {
    g.rect(0, (HALL_TOP / bands) * i, width, HALL_TOP / bands + 1).fill(
      sky[Math.min(sky.length - 1, Math.floor((i / bands) * sky.length))]!,
    );
  }
  for (let i = 0; i < width / 260; i++) {
    const cx = rng.range(0, width);
    const cy = rng.range(20, 80);
    for (let j = 0; j < 4; j++)
      g.ellipse(
        cx + rng.range(-50, 50),
        cy + rng.range(-8, 8),
        rng.range(30, 60),
        rng.range(10, 18),
      ).fill({
        color: 0xffffff,
        alpha: 0.35,
      });
  }
  const ridge = (base: number, amp: number, period: number, color: number) => {
    const pts = [0, HALL_TOP];
    for (let x = 0; x <= width + 24; x += 24)
      pts.push(x, base - amp * (0.6 + 0.4 * Math.sin(x / period) * Math.sin(x / (period * 0.43))));
    pts.push(width + 24, HALL_TOP);
    g.poly(pts).fill(color);
  };
  ridge(150, 60, 140, INTERIOR.mountainFar);
  ridge(185, 34, 90, INTERIOR.hill);
  // Toit : rangs d'ardoises, faîtage, gouttière.
  const roofTop = HALL_TOP - 92;
  g.rect(0, roofTop, width, HALL_TOP - roofTop).fill(INTERIOR.slate);
  for (let y = roofTop + 8; y < HALL_TOP; y += 12) {
    const offset = ((y - roofTop) / 12) % 2 ? 11 : 0;
    for (let x = -offset; x < width; x += 22)
      g.roundRect(x + 1, y, 20, 11, 2).fill(rng.chance(0.15) ? INTERIOR.slateLight : 0x48515d);
  }
  g.rect(0, roofTop - 6, width, 9).fill(0x6a5a4a);
  g.rect(0, HALL_TOP - 6, width, 6).fill(0x2a2f36);
  // Lanternons d'aération sur le faîtage.
  for (let x = 220; x < width - 120; x += 480) {
    g.rect(x - 22, roofTop - 34, 44, 30)
      .fill(0xd8d0bf)
      .stroke({ width: 1.5, color: 0x5a5144 });
    for (let k = 0; k < 4; k++) g.rect(x - 18, roofTop - 30 + k * 7, 36, 3).fill(0x3a342c);
    g.poly([x - 30, roofTop - 32, x, roofTop - 52, x + 30, roofTop - 32]).fill(INTERIOR.slate);
  }
}

/** Abscisses des fenêtres hautes (les puits de lumière en partent). */
export function windowXs(cols: number): number[] {
  const xs: number[] = [];
  for (let col = 3; col < cols; col += 6) xs.push(columnX(col));
  return xs;
}

/** Chantier au bout du chai : échafaudage, planches et « +20 » à la craie. */
function drawExtensionSite(g: Graphics, container: Container, cols: number): void {
  const x0 = columnX(cols) + 10;
  const w = CHAI.extensionCols * CHAI.colWidth - 20;
  const top = BEAM_Y + 20;
  g.rect(x0, top, w, RACK_FLOOR - top).fill({ color: 0x000000, alpha: 0.25 });
  // Échafaudage de perches liées.
  for (const x of [x0 + 8, x0 + w - 12])
    g.rect(x, top - 10, 5, RACK_FLOOR - top + 10).fill(0x8a6a44);
  for (let y = top + 30; y < RACK_FLOOR; y += 70) {
    g.rect(x0, y, w, 6).fill(0x9a7a50);
    g.moveTo(x0 + 10, y + 6)
      .lineTo(x0 + w - 10, y + 64)
      .stroke({ width: 3, color: 0x7a5a38 });
  }
  // Pile de pierres et brouette pour l'agrandissement.
  for (let i = 0; i < 7; i++) {
    g.roundRect(
      x0 + 14 + (i % 4) * 22 + (i >= 4 ? 11 : 0),
      RACK_FLOOR - 16 - (i >= 4 ? 14 : 0),
      20,
      14,
      3,
    )
      .fill(C.cutStone[i % 3]!)
      .stroke({ width: 1, color: C.cutMortar });
  }
  // Corde de chantier.
  g.moveTo(x0 - 4, RACK_FLOOR - 60)
    .quadraticCurveTo(x0 + w / 2, RACK_FLOOR - 40, x0 + w + 4, RACK_FLOOR - 60)
    .stroke({ width: 2.5, color: C.rope });
  const sign = new Text({
    text: '+20',
    style: { fontFamily: 'Uncial Antiqua', fontSize: 30, fill: C.chalk },
    resolution: 2,
  });
  sign.anchor.set(0.5);
  sign.alpha = 0.85;
  sign.position.set(x0 + w / 2, top + 110);
  container.addChild(sign);
}

/** Abscisse et largeur du chantier d'agrandissement (pour le toucher). */
export function extensionSite(places: number): { x0: number; x1: number } {
  const cols = Math.ceil(places / WAREHOUSE.tiers);
  return { x0: columnX(cols), x1: columnX(cols + CHAI.extensionCols) };
}

export interface CaskLook {
  type: CaskType;
  /** Numéro du fût, peint au pochoir. */
  id: number;
  /** Fût de 3 ans et plus : une plaque de laiton. */
  legal: boolean;
}

/** Fond de fût vu de face : douelles, cercles de fer, marquage au pochoir. */
export function drawCask(
  container: Container,
  rng: Rng,
  cx: number,
  cy: number,
  cask: CaskLook,
): void {
  const wood = CASK_WOOD[cask.type];
  const r = cask.type === 'sherry' ? CHAI.caskRadius * 1.14 : CHAI.caskRadius;
  const bottom = cy + CHAI.caskRadius;
  const g = new Graphics();
  // Ombre portée sur le rail et la cale de bois qui empêche le fût de rouler.
  g.ellipse(cx + 3, bottom - 2, r * 0.9, 5).fill({ color: 0x000000, alpha: 0.45 });
  const y = bottom - r;
  g.circle(cx, y, r).fill(wood.dark);
  g.circle(cx, y, r).stroke({ width: 3.5, color: C.hoop });
  g.circle(cx, y, r - 1.5).stroke({ width: 1, color: C.hoopLight, alpha: 0.6 });
  const head = r - 6;
  g.circle(cx, y, head).fill(wood.head);
  // Planches du fond, verticales.
  const boards = 5;
  for (let k = 1; k < boards; k++) {
    const dx = -head + (2 * head * k) / boards;
    const half = Math.sqrt(head * head - dx * dx);
    g.moveTo(cx + dx, y - half).lineTo(cx + dx, y + half);
  }
  g.stroke({ width: 1.2, color: wood.dark, alpha: 0.7 });
  // Veinage et reflet en haut à gauche.
  for (let i = 0; i < 4; i++) {
    const dx = rng.range(-head * 0.7, head * 0.7);
    const half = Math.sqrt(head * head - dx * dx) * 0.7;
    g.moveTo(cx + dx, y - half).lineTo(cx + dx + rng.range(-1.5, 1.5), y + half);
  }
  g.stroke({ width: 0.8, color: wood.light, alpha: 0.45 });
  g.arc(cx, y, head - 2, Math.PI * 1.05, Math.PI * 1.45).stroke({
    width: 3,
    color: wood.light,
    alpha: 0.5,
  });
  g.circle(cx, y, head).stroke({ width: 1.5, color: wood.dark });
  // Le sherry a bavé : coulure sombre sous la bonde.
  if (cask.type === 'sherry')
    g.ellipse(cx + rng.range(-6, 6), y + head * 0.55, 7, 4).fill({ color: 0x3a120c, alpha: 0.55 });
  // Fausset de dégustation et cale.
  g.circle(cx + head * 0.55, y + head * 0.5, 2.2).fill(wood.dark);
  g.poly([cx - 8, bottom, cx - 3, bottom - 6, cx + 2, bottom]).fill(C.rail);
  if (cask.legal) {
    g.roundRect(cx - 9, y - head + 3, 18, 8, 2)
      .fill(C.brass)
      .stroke({ width: 1, color: 0x6e5422 });
  }
  container.addChild(g);

  const mark = new Text({
    text: `${wood.mark}\n${cask.id}`,
    style: {
      fontFamily: 'Alegreya Sans',
      fontWeight: '700',
      fontSize: 11,
      lineHeight: 11,
      align: 'center',
      fill: C.chalk,
    },
    resolution: 3,
  });
  mark.anchor.set(0.5);
  mark.alpha = 0.82;
  mark.position.set(cx, y + 2);
  container.addChild(mark);
}

/** Place libre : cercle à la craie en pointillés et une petite croix. */
export function drawEmptyPlace(g: Graphics, cx: number, cy: number): void {
  const r = CHAI.caskRadius - 3;
  const y = cy + 3;
  const dashes = 14;
  for (let i = 0; i < dashes; i++) {
    const a = (i / dashes) * Math.PI * 2;
    g.moveTo(cx + Math.cos(a) * r, y + Math.sin(a) * r).arc(
      cx,
      y,
      r,
      a,
      a + (Math.PI * 2) / dashes / 1.8,
    );
  }
  g.stroke({ width: 2, color: C.chalk, alpha: 0.42 });
  g.moveTo(cx - 6, y)
    .lineTo(cx + 6, y)
    .moveTo(cx, y - 6)
    .lineTo(cx, y + 6);
  g.stroke({ width: 2, color: C.chalk, alpha: 0.32 });
}
