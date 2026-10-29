import { Container, Graphics } from 'pixi.js';
import type { Rng } from '../sim/rng';

export interface PuffStyle {
  color: number;
  alpha: number;
  radius: number;
  /** Vitesse de départ (px/s) et dispersion. */
  vx: number;
  vy: number;
  spread: number;
  /** Croissance pendant la vie de la particule (1 = double de taille). */
  grow: number;
  lifeMs: number;
  /** Gravité (px/s²) pour les gouttes et les grains. */
  gravity?: number;
}

/** Fumée de tourbe, vapeur des alambics, bulles de fermentation, gouttes d'alcool. */
export const STYLES = {
  smoke: {
    color: 0xd9d6cf,
    alpha: 0.55,
    radius: 7,
    vx: 10,
    vy: -22,
    spread: 6,
    grow: 2.2,
    lifeMs: 3200,
  },
  peatSmoke: {
    color: 0xb8b2a6,
    alpha: 0.6,
    radius: 8,
    vx: 12,
    vy: -24,
    spread: 6,
    grow: 2.4,
    lifeMs: 3600,
  },
  steam: {
    color: 0xffffff,
    alpha: 0.5,
    radius: 6,
    vx: 0,
    vy: -30,
    spread: 10,
    grow: 1.6,
    lifeMs: 1600,
  },
  bubble: {
    color: 0xf3e2b0,
    alpha: 0.8,
    radius: 2.5,
    vx: 0,
    vy: -26,
    spread: 8,
    grow: 0.3,
    lifeMs: 900,
  },
  drop: {
    color: 0xe8f0f2,
    alpha: 0.9,
    radius: 2,
    vx: 0,
    vy: 0,
    spread: 0,
    grow: 0,
    lifeMs: 700,
    gravity: 260,
  },
  spark: {
    color: 0xffb04a,
    alpha: 0.9,
    radius: 1.6,
    vx: 0,
    vy: -40,
    spread: 14,
    grow: 0,
    lifeMs: 800,
  },
} satisfies Record<string, PuffStyle>;

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  style: PuffStyle;
}

/** Particules simples : naissent, montent ou tombent, grossissent et s'effacent. */
export class Particles {
  readonly container = new Container();
  private readonly items: Particle[] = [];

  constructor(private readonly rng: Rng) {}

  emit(x: number, y: number, style: PuffStyle): void {
    const g = new Graphics()
      .circle(0, 0, style.radius)
      .fill({ color: style.color, alpha: style.alpha });
    g.position.set(x + this.rng.range(-style.spread, style.spread) * 0.3, y);
    this.container.addChild(g);
    this.items.push({
      g,
      vx: style.vx + this.rng.range(-style.spread, style.spread),
      vy: style.vy + this.rng.range(-style.spread, style.spread) * 0.3,
      life: 0,
      style,
    });
  }

  get active(): boolean {
    return this.items.length > 0;
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i]!;
      p.life += dtMs;
      const t = p.life / p.style.lifeMs;
      if (t >= 1) {
        p.g.destroy();
        this.items.splice(i, 1);
        continue;
      }
      p.vy += (p.style.gravity ?? 0) * dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.g.scale.set(1 + p.style.grow * t);
      p.g.alpha = 1 - t * t;
    }
  }
}

/** Point d'émission régulière (cheminée, couvercle de cuve…). */
export interface Emitter {
  x: number;
  y: number;
  style: PuffStyle;
  everyMs: number;
  timer: number;
}

export function runEmitters(emitters: Emitter[], particles: Particles, dtMs: number): void {
  for (const e of emitters) {
    e.timer -= dtMs;
    while (e.timer <= 0) {
      particles.emit(e.x, e.y, e.style);
      e.timer += e.everyMs;
    }
  }
}
