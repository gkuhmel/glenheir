import { describe, expect, it } from 'vitest';
import { MAP } from '../data/balance';
import { generateTerrain, tileAt } from './terrain';

const terrain = generateTerrain();

describe('terrain', () => {
  it('est reproductible à partir de sa graine', () => {
    expect(generateTerrain()).toEqual(terrain);
    expect(generateTerrain(MAP.terrainSeed + 1).decor).not.toEqual(terrain.decor);
  });

  it('pave toute la cour', () => {
    const { x, y, width, height } = terrain.courtyard;
    for (let r = y; r < y + height; r++) {
      for (let c = x; c < x + width; c++) expect(tileAt(terrain, c, r)).toBe('cobble');
    }
  });

  it('fait couler le ruisseau du nord au sud sans interruption', () => {
    for (let r = 0; r < terrain.rows; r++) {
      const row = Array.from({ length: terrain.cols }, (_, c) => tileAt(terrain, c, r));
      expect(row.some((k) => k === 'water' || k === 'bridge')).toBe(true);
    }
  });

  it('franchit le ruisseau par un pont sur le chemin ouest', () => {
    expect(terrain.tiles).toContain('bridge');
    expect(tileAt(terrain, Math.floor(terrain.bridge.x), Math.floor(terrain.bridge.y))).toMatch(
      /bridge|water|path/,
    );
  });

  it('relie la cour aux bords de la carte par des chemins', () => {
    const [south, west, east] = terrain.paths;
    expect(east!.at(-1)!.x).toBeCloseTo(terrain.warehouse.x + 0.5);
    expect(south!.at(-1)!.y).toBeGreaterThan(terrain.rows);
    expect(west!.at(-1)!.x).toBeLessThan(0);
  });

  it('ne pose pas d’arbre sur l’eau, les chemins ou la cour', () => {
    const trees = terrain.decor.filter((d) => d.kind === 'pine' || d.kind === 'birch');
    expect(trees.length).toBeGreaterThan(100);
    for (const tree of trees) {
      expect(tileAt(terrain, Math.floor(tree.x), Math.floor(tree.y))).toMatch(/grass|heather/);
    }
  });

  it('laisse le muret ouvert aux portes', () => {
    const { gates, courtyard } = terrain;
    const southY = courtyard.y + courtyard.height;
    const atSouthGate = terrain.walls.filter(
      (w) =>
        w.from.y === southY &&
        w.to.y === southY &&
        w.from.x >= gates.south - 1 &&
        w.to.x <= gates.south + 1,
    );
    expect(atSouthGate).toEqual([]);
    const eastX = courtyard.x + courtyard.width;
    const atEastGate = terrain.walls.filter(
      (w) =>
        w.from.x === eastX &&
        w.to.x === eastX &&
        w.from.y >= gates.east - 1 &&
        w.to.y <= gates.east + 1,
    );
    expect(atEastGate).toEqual([]);
  });

  it('laisse la place du chai libre de tout décor', () => {
    const { warehouse } = terrain;
    const inside = terrain.decor.filter(
      (d) =>
        d.x > warehouse.x &&
        d.x < warehouse.x + warehouse.width &&
        d.y > warehouse.y &&
        d.y < warehouse.y + warehouse.height,
    );
    expect(inside).toEqual([]);
  });
});
