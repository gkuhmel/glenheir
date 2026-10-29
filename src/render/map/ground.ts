import { Sprite, Texture } from 'pixi.js';
import { MAP } from '../../data/balance';
import { createValueNoise, fbm } from '../../sim/noise';
import { createRng } from '../../sim/rng';
import type { Point, Terrain } from '../../sim/terrain';
import { GROUND_TEXELS_PER_TILE, PALETTE } from '../config';

type Rgb = readonly [number, number, number] | readonly number[];

const mix = (a: Rgb, b: Rgb, t: number): number[] => [
  (a[0] as number) + ((b[0] as number) - (a[0] as number)) * t,
  (a[1] as number) + ((b[1] as number) - (a[1] as number)) * t,
  (a[2] as number) + ((b[2] as number) - (a[2] as number)) * t,
];

/** Valeur d'un champ par tuile, interpolée entre les centres des tuiles. */
function sample(field: readonly number[], terrain: Terrain, u: number, v: number): number {
  const x = Math.max(0, Math.min(terrain.cols - 1, u - 0.5));
  const y = Math.max(0, Math.min(terrain.rows - 1, v - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(terrain.cols - 1, x0 + 1);
  const y1 = Math.min(terrain.rows - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const at = (c: number, r: number) => field[r * terrain.cols + c] as number;
  const top = at(x0, y0) + (at(x1, y0) - at(x0, y0)) * tx;
  const bottom = at(x0, y1) + (at(x1, y1) - at(x0, y1)) * tx;
  return top + (bottom - top) * ty;
}

/** Trace une ligne lissée passant par les milieux des points. */
export function smoothPath(
  ctx: {
    moveTo(x: number, y: number): unknown;
    quadraticCurveTo(...a: number[]): unknown;
    lineTo(x: number, y: number): unknown;
  },
  points: readonly Point[],
  scale: number,
): void {
  const first = points[0];
  if (!first) return;
  ctx.moveTo(first.x * scale, first.y * scale);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i] as Point;
    const next = points[i + 1] as Point;
    ctx.quadraticCurveTo(
      p.x * scale,
      p.y * scale,
      ((p.x + next.x) / 2) * scale,
      ((p.y + next.y) / 2) * scale,
    );
  }
  const last = points[points.length - 1] as Point;
  ctx.lineTo(last.x * scale, last.y * scale);
}

/** Couleur de base du sol (herbe, bruyère), calculée en basse résolution. */
function paintBase(terrain: Terrain, texelsPerTile: number): HTMLCanvasElement {
  const width = terrain.cols * texelsPerTile;
  const height = terrain.rows * texelsPerTile;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);
  const rng = createRng(MAP.terrainSeed + 101);
  const broad = createValueNoise(rng);
  const fine = createValueNoise(rng);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const u = (px + 0.5) / texelsPerTile;
      const v = (py + 0.5) / texelsPerTile;
      const meadow = fbm(broad, u * 0.12, v * 0.12, 3);
      let color = mix(PALETTE.grassDry, PALETTE.grass, Math.min(1, meadow * 1.6));
      color = mix(color, PALETTE.grassLush, sample(terrain.lushness, terrain, u, v) * 0.7);
      const heather = sample(terrain.heather, terrain, u, v);
      if (heather > 0) {
        const tone = mix(
          PALETTE.heatherBrown,
          PALETTE.heatherPurple,
          fbm(fine, u * 0.5, v * 0.5, 2),
        );
        color = mix(color, tone, Math.min(1, heather * 1.1));
      }
      const grain = 0.92 + fbm(fine, u * 2.2, v * 2.2, 2) * 0.16;
      const i = (py * width + px) * 4;
      image.data[i] = (color[0] as number) * grain;
      image.data[i + 1] = (color[1] as number) * grain;
      image.data[i + 2] = (color[2] as number) * grain;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Sol de la carte peint une fois dans une texture : herbe et bruyère nuancées,
 * berges boueuses et chemins de terre aux bords adoucis.
 */
export function createGround(terrain: Terrain): Sprite {
  const scale = GROUND_TEXELS_PER_TILE;
  const base = paintBase(terrain, scale / 4);
  const canvas = document.createElement('canvas');
  canvas.width = terrain.cols * scale;
  canvas.height = terrain.rows * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const stroke = (points: readonly Point[], width: number, color: string, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    ctx.beginPath();
    smoothPath(ctx, points, scale);
    ctx.stroke();
  };

  // Berges : boue sombre qui se fond dans l'herbe.
  for (const [extra, alpha] of [
    [1.6, 0.18],
    [1.1, 0.3],
    [0.7, 0.55],
  ] as const) {
    stroke(terrain.river, terrain.riverWidth + extra, PALETTE.mud, alpha);
  }

  // Chemins de terre.
  for (const path of terrain.paths) {
    stroke(path, 1.9, PALETTE.soilEdge, 0.25);
    stroke(path, 1.45, PALETTE.soilEdge, 0.6);
    stroke(path, 1.2, PALETTE.soil, 1);
    stroke(path, 0.55, PALETTE.soilLight, 0.45);
  }

  // Terre battue sous les pavés de la cour.
  const { x, y, width, height } = terrain.courtyard;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = PALETTE.soilEdge;
  ctx.shadowColor = PALETTE.soilEdge;
  ctx.shadowBlur = scale * 0.8;
  ctx.fillRect((x - 0.2) * scale, (y - 0.2) * scale, (width + 0.4) * scale, (height + 0.4) * scale);
  ctx.restore();

  const sprite = new Sprite(Texture.from(canvas));
  sprite.width = terrain.cols * MAP.tileSize;
  sprite.height = terrain.rows * MAP.tileSize;
  return sprite;
}
