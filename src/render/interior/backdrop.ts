import { Container, Graphics } from 'pixi.js';
import { createRng } from '../../sim/rng';
import { GROUND_Y, WORLD } from './layout';
import { INTERIOR as P } from './palette';

const lerpColor = (a: number, b: number, t: number) => {
  const ch = (shift: number) => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
};

/** Ligne de crête : montagnes et collines du fond. */
function ridge(
  g: Graphics,
  baseY: number,
  amplitude: number,
  period: number,
  phase: number,
  color: number,
) {
  const pts: number[] = [0, GROUND_Y];
  for (let x = 0; x <= WORLD.width; x += 24) {
    const y =
      baseY -
      amplitude *
        (0.55 +
          0.3 * Math.sin(x / period + phase) +
          0.15 * Math.sin(x / (period * 0.37) + phase * 2));
    pts.push(x, y);
  }
  pts.push(WORLD.width, GROUND_Y);
  g.poly(pts).fill(color);
}

/** Ciel, montagnes, collines boisées, prairie et terre en coupe sous le bâtiment. */
export function createBackdrop(): Container {
  const rng = createRng(4242);
  const g = new Graphics();

  // Ciel en bandes dégradées, brume claire vers l'horizon.
  const bands = 24;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const stops = P.sky;
    const pos = t * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(pos));
    const color = lerpColor(stops[k]!, stops[k + 1]!, pos - k);
    g.rect(0, (GROUND_Y / bands) * i, WORLD.width, GROUND_Y / bands + 1).fill(color);
  }
  // Nuages.
  for (let i = 0; i < 9; i++) {
    const cx = rng.range(0, WORLD.width);
    const cy = rng.range(40, GROUND_Y * 0.35);
    for (let j = 0; j < 5; j++) {
      g.ellipse(
        cx + rng.range(-60, 60),
        cy + rng.range(-10, 10),
        rng.range(40, 80),
        rng.range(14, 24),
      ).fill({
        color: 0xffffff,
        alpha: 0.35,
      });
    }
  }
  ridge(g, GROUND_Y - 150, 170, 260, 1.3, P.mountainFar);
  ridge(g, GROUND_Y - 60, 120, 180, 4.1, P.mountainNear);
  ridge(g, GROUND_Y - 10, 60, 120, 2.2, P.hill);

  // Pins sur les collines proches.
  for (let x = 20; x < WORLD.width; x += rng.range(18, 60)) {
    const h = rng.range(26, 46);
    const base = GROUND_Y - rng.range(2, 30);
    g.poly([x, base - h, x - h * 0.28, base, x + h * 0.28, base]).fill({
      color: 0x2f4a2c,
      alpha: 0.9,
    });
  }

  // Prairie et terre en coupe.
  g.rect(0, GROUND_Y, WORLD.width, WORLD.height - GROUND_Y).fill(P.soil[0]);
  for (let i = 0; i < 260; i++) {
    const x = rng.range(0, WORLD.width);
    const y = rng.range(GROUND_Y + 14, WORLD.height);
    g.ellipse(x, y, rng.range(6, 22), rng.range(4, 10)).fill({
      color: rng.pick(P.soil),
      alpha: 0.8,
    });
    if (rng.chance(0.3)) g.ellipse(x, y, rng.range(4, 9), rng.range(3, 6)).fill(P.soilStone);
  }
  g.rect(0, GROUND_Y - 4, WORLD.width, 16).fill(P.grass);
  for (let x = 0; x < WORLD.width; x += 5) {
    const h = rng.range(4, 11);
    g.moveTo(x, GROUND_Y + 2).lineTo(x + rng.range(-2, 2), GROUND_Y - h);
  }
  g.stroke({ width: 1.4, color: P.grassDark });

  const container = new Container();
  container.addChild(g);
  return container;
}
