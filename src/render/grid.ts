import { Container, Graphics } from 'pixi.js';
import { MAP } from '../data/balance';
import { PALETTE } from './config';

/** Bruit déterministe par tuile (décor seulement, pas de gameplay). */
function tileNoise(col: number, row: number): number {
  let h = (col * 374_761_393 + row * 668_265_263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1_274_126_177);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
}

const pick = <T>(list: readonly T[], value: number): T =>
  list[Math.min(list.length - 1, Math.floor(value * list.length))] as T;

/** Cour pavée au centre de la carte, futur emplacement de la distillerie. */
function isCourtyard(col: number, row: number): boolean {
  const half = 8;
  const cx = MAP.cols / 2;
  const cy = MAP.rows / 2;
  return Math.abs(col + 0.5 - cx) <= half && Math.abs(row + 0.5 - cy) <= half;
}

/** Sol (herbe et pierre) et grille de tuiles. */
export function createGround(): Container {
  const size = MAP.tileSize;
  const ground = new Graphics();
  for (let row = 0; row < MAP.rows; row++) {
    for (let col = 0; col < MAP.cols; col++) {
      const palette = isCourtyard(col, row) ? PALETTE.stone : PALETTE.grass;
      ground.rect(col * size, row * size, size, size).fill(pick(palette, tileNoise(col, row)));
    }
  }

  const grid = new Graphics();
  const width = MAP.cols * size;
  const height = MAP.rows * size;
  for (let col = 0; col <= MAP.cols; col++) grid.moveTo(col * size, 0).lineTo(col * size, height);
  for (let row = 0; row <= MAP.rows; row++) grid.moveTo(0, row * size).lineTo(width, row * size);
  grid.stroke({ width: 1, color: PALETTE.gridLine, alpha: 0.25, pixelLine: true });

  const container = new Container();
  container.addChild(ground, grid);
  return container;
}
