import { Graphics } from 'pixi.js';
import { MAP } from '../../data/balance';
import { PALETTE } from '../config';

/** Grille des tuiles, visible seulement en mode construction (étape 3). */
export function createGrid(): Graphics {
  const size = MAP.tileSize;
  const width = MAP.cols * size;
  const height = MAP.rows * size;
  const grid = new Graphics();
  for (let col = 0; col <= MAP.cols; col++) grid.moveTo(col * size, 0).lineTo(col * size, height);
  for (let row = 0; row <= MAP.rows; row++) grid.moveTo(0, row * size).lineTo(width, row * size);
  grid.stroke({ width: 1, color: PALETTE.gridLine, alpha: 0.3, pixelLine: true });
  return grid;
}
