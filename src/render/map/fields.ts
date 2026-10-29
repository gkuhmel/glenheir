import { Container, Graphics } from 'pixi.js';
import { MAP } from '../../data/balance';
import { createRng, type Rng } from '../../sim/rng';
import { growth, isRipe, type Field } from '../../sim/systems/fields';
import type { Rect } from '../../sim/terrain';

const T = MAP.tileSize;

const C = {
  soil: 0x6e5236,
  soilLight: 0x8a6a46,
  furrow: 0x553d27,
  sprout: 0x7fa64a,
  green: [0x6f9a3c, 0x7aa845, 0x648f36],
  gold: [0xd8b45a, 0xe3c06a, 0xc9a24a],
  stubble: 0xb89a5e,
  stone: [0x8f897b, 0x9a9384, 0x7f796d, 0xa59e8e],
  stoneDark: 0x3c3830,
  shadow: 0x0d120b,
};

/** Muret de pierres sèches autour d'une parcelle, ouvert côté cour. */
function dyke(g: Graphics, rng: Rng, x: number, y: number, w: number, h: number): void {
  const gateFrom = x + w / 2 - 14;
  const gateTo = x + w / 2 + 14;
  const stones = (ax: number, ay: number, bx: number, by: number) => {
    const length = Math.hypot(bx - ax, by - ay);
    for (let d = 0; d < length; d += 7) {
      const px = ax + ((bx - ax) * d) / length;
      const py = ay + ((by - ay) * d) / length;
      if (py === y + h && px > gateFrom && px < gateTo) continue;
      g.ellipse(px + 2, py + 3, 4.5, 3.4).fill({ color: C.shadow, alpha: 0.25 });
      g.ellipse(px, py, 4.5, 3.4)
        .fill(rng.pick(C.stone))
        .stroke({ width: 0.8, color: C.stoneDark });
    }
  };
  stones(x, y, x + w, y);
  stones(x + w, y, x + w, y + h);
  stones(x + w, y + h, x, y + h);
  stones(x, y + h, x, y);
}

/**
 * Parcelle vue du dessus : labour en friche, pousses vertes qui grandissent,
 * épis dorés à maturité, chaume après la moisson.
 */
export function drawField(field: Field, area: Rect, hour: number): Container {
  const rng = createRng(MAP.terrainSeed + 505 + field.id);
  const g = new Graphics();
  const x = area.x * T;
  const y = area.y * T;
  const w = area.width * T;
  const h = area.height * T;
  const pad = 8;
  g.rect(x + pad, y + pad, w - pad * 2, h - pad * 2).fill(C.soil);
  const rows = Math.floor((h - pad * 2) / 9);
  const crop = field.crop;
  const progress = crop ? growth(crop, hour) : 0;
  const ripe = crop ? isRipe(crop, hour) : false;
  for (let r = 0; r < rows; r++) {
    const ry = y + pad + 5 + r * 9;
    g.rect(x + pad, ry - 1, w - pad * 2, 3).fill(C.furrow);
    g.rect(x + pad, ry + 2, w - pad * 2, 1).fill({ color: C.soilLight, alpha: 0.5 });
    if (!crop) {
      if (field.lastHarvest) {
        for (let cx = x + pad + 2; cx < x + w - pad; cx += 4)
          g.rect(cx, ry - 3, 1.2, 4).fill(C.stubble);
      }
      continue;
    }
    // Rangs d'orge : les touffes s'étoffent avec la pousse, dorent à maturité.
    const size = 1.2 + progress * 3.6;
    for (let cx = x + pad + 3; cx < x + w - pad - 2; cx += 5) {
      const color = ripe ? rng.pick(C.gold) : progress < 0.15 ? C.sprout : rng.pick(C.green);
      g.ellipse(cx + rng.range(-1, 1), ry - size / 3, size * 0.8, size).fill(color);
    }
  }
  if (ripe)
    g.rect(x + pad, y + pad, w - pad * 2, h - pad * 2).fill({ color: 0xffe9a0, alpha: 0.12 });
  dyke(g, rng, x + 3, y + 3, w - 6, h - 6);
  const container = new Container();
  container.addChild(g);
  return container;
}

/** Signature visuelle d'une parcelle : ne redessiner que si son aspect change. */
export function fieldLook(field: Field, hour: number): string {
  if (!field.crop) return field.lastHarvest ? 'stubble' : 'fallow';
  return isRipe(field.crop, hour) ? 'ripe' : `grow${Math.floor(growth(field.crop, hour) * 10)}`;
}
