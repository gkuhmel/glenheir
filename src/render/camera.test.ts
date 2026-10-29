import { describe, expect, it } from 'vitest';
import {
  centerOn,
  clampCamera,
  NO_INSETS,
  panBy,
  screenToWorld,
  zoomAt,
  type Camera,
} from './camera';

const LIMITS = { min: 0.25, max: 3 };
const view = { width: 400, height: 800 };
const world = { width: 2048, height: 2048 };

describe('caméra', () => {
  it('suit le doigt en tenant compte du zoom', () => {
    const camera = panBy({ x: 100, y: 100, zoom: 2 }, 50, -20);
    expect(camera).toEqual({ x: 75, y: 110, zoom: 2 });
  });

  it('garde fixe le point sous les doigts pendant le zoom', () => {
    const camera: Camera = { x: 300, y: 500, zoom: 1 };
    const before = screenToWorld(camera, 120, 340);
    const zoomed = zoomAt(camera, 1.7, 120, 340, LIMITS);
    expect(zoomed.zoom).toBeCloseTo(1.7);
    const after = screenToWorld(zoomed, 120, 340);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('borne le zoom', () => {
    expect(zoomAt({ x: 0, y: 0, zoom: 2 }, 10, 0, 0, LIMITS).zoom).toBe(3);
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, 0.01, 0, 0, LIMITS).zoom).toBe(0.25);
  });

  it('empêche de sortir de la carte', () => {
    const insets = { top: 60, right: 0, bottom: 80, left: 0 };
    const tooFar = clampCamera({ x: -500, y: 5000, zoom: 1 }, view, world, insets);
    // Bord gauche collé à l'écran, bord bas collé au-dessus de la barre du bas.
    expect(tooFar.x).toBeCloseTo(0);
    expect(tooFar.y).toBe(2048 - (800 - 80));
    const top = clampCamera({ x: 0, y: -500, zoom: 1 }, view, world, insets);
    expect(top.y).toBe(-60);
  });

  it('centre une carte plus petite que l’écran', () => {
    const camera = clampCamera({ x: 999, y: 999, zoom: 0.1 }, view, world, NO_INSETS);
    // 2048 × 0,1 = 204,8 px de large, centrés dans 400 px.
    expect(-camera.x * 0.1).toBeCloseTo((400 - 204.8) / 2);
  });

  it('centre la vue sur un point entre les barres', () => {
    const insets = { top: 60, right: 0, bottom: 80, left: 0 };
    const camera = centerOn(1024, 1024, 2, view, insets);
    const middle = screenToWorld(camera, 200, (60 + 720) / 2);
    expect(middle.x).toBeCloseTo(1024);
    expect(middle.y).toBeCloseTo(1024);
  });
});
