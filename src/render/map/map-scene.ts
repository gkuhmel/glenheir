import { Container, Graphics } from 'pixi.js';
import { MAP } from '../../data/balance';
import type { GameState } from '../../sim/state';
import { generateTerrain, type Rect } from '../../sim/terrain';
import {
  centerOn,
  clampCamera,
  panBy,
  screenToWorld,
  zoomAt,
  type Camera,
  type Insets,
  type Size,
} from '../camera';
import { PALETTE, ZOOM } from '../config';
import type { Scene } from '../stage';
import { createRng } from '../../sim/rng';
import { roomAt } from '../../sim/systems/building';
import { Particles, runEmitters, STYLES, type Emitter } from '../particles';
import {
  DISTILLERY,
  distilleryBounds,
  drawDistillery,
  drawWarehouse,
  warehouseFootprint,
} from './buildings';
import { drawField, fieldLook } from './fields';
import { createGrid } from './grid';
import { createGround } from './ground';
import { createScenery } from './scenery';

const WORLD: Size = { width: MAP.cols * MAP.tileSize, height: MAP.rows * MAP.tileSize };

export interface MapHandlers {
  openDistillery(): void;
  selectWarehouse(id: number): void;
  selectField(id: number): void;
}

const T = MAP.tileSize;
const fieldRect = (i: number): Rect => {
  const f = MAP.fields[i]!;
  return { x: f.x * T, y: f.y * T, width: f.width * T, height: f.height * T };
};

const contains = (r: Rect, x: number, y: number) =>
  x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

/** La carte du domaine : terrain, distillerie et chais vus du dessus. */
export class MapScene implements Scene {
  readonly root = new Container();
  private readonly world = new Container();
  private readonly buildings = new Container();
  private readonly fields = new Container();
  private readonly particles = new Particles(createRng(31));
  private emitters: Emitter[] = [];
  private fieldLooks: string[] = [];
  private readonly highlight = new Graphics();
  private readonly terrain = generateTerrain();
  private camera: Camera = { x: 0, y: 0, zoom: ZOOM.initial };
  private view: Size = { width: 1, height: 1 };
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private centered = false;
  private signature = '';
  private state: GameState | null = null;

  constructor(
    private readonly invalidate: () => void,
    private readonly handlers: MapHandlers,
  ) {
    const grid = createGrid();
    grid.visible = false;
    this.highlight.visible = false;
    this.world.addChild(
      createGround(this.terrain),
      createScenery(this.terrain),
      this.fields,
      this.buildings,
      this.particles.container,
      grid,
      this.highlight,
    );
    this.root.addChild(this.world);
  }

  /** Redessine les bâtiments quand la distillerie ou les chais changent. */
  setState(state: GameState): void {
    this.state = state;
    this.updateFields(state);
    this.updateSmoke(state);
    const signature = JSON.stringify([state.building.rooms, state.warehouses]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.buildings.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.buildings.addChild(drawDistillery(state.building));
    for (const warehouse of state.warehouses) {
      this.buildings.addChild(drawWarehouse(warehouse, this.terrain.warehouse));
    }
    this.invalidate();
  }

  resize(view: Size, insets: Insets): void {
    this.view = view;
    this.insets = insets;
    if (!this.centered) {
      this.centered = true;
      // Vue de départ centrée sur la distillerie.
      const court = this.terrain.courtyard;
      const cx = (court.x + court.width / 2 + 1) * MAP.tileSize;
      // Un peu au nord de la cour pour voir aussi les parcelles d'orge.
      const cy = (court.y + court.height / 2 - 3) * MAP.tileSize;
      this.camera = centerOn(cx, cy, ZOOM.initial, view, insets);
    }
    this.apply(this.camera);
  }

  pan(dx: number, dy: number): void {
    this.apply(panBy(this.camera, dx, dy));
  }

  zoom(factor: number, sx: number, sy: number): void {
    this.apply(zoomAt(this.camera, factor, sx, sy, ZOOM));
  }

  tap(sx: number, sy: number): void {
    const point = screenToWorld(this.camera, sx, sy);
    if (this.state) {
      if (contains(distilleryBounds(this.state.building), point.x, point.y)) {
        this.handlers.openDistillery();
        return;
      }
      const warehouse = this.state.warehouses[0];
      const area = warehouse && warehouseFootprint(warehouse, this.terrain.warehouse);
      const rect = area && {
        x: area.x * T,
        y: area.y * T,
        width: area.width * T,
        // La porte et les fûts devant le pignon comptent aussi.
        height: area.height * T + 16,
      };
      if (warehouse && rect && contains(rect, point.x, point.y)) {
        this.handlers.selectWarehouse(warehouse.id);
        return;
      }
      for (let i = 0; i < this.state.fields.length; i++) {
        const field = this.state.fields[i]!;
        if (MAP.fields[i] && contains(fieldRect(i), point.x, point.y)) {
          this.handlers.selectField(field.id);
          return;
        }
      }
    }
    this.selectTile(point.x, point.y);
  }

  update(dtMs: number): boolean {
    runEmitters(this.emitters, this.particles, dtMs);
    this.particles.update(dtMs);
    return this.particles.active;
  }

  private updateFields(state: GameState): void {
    const looks = state.fields.map((f) => fieldLook(f, state.time.hour));
    if (looks.join() === this.fieldLooks.join()) return;
    this.fieldLooks = looks;
    this.fields.removeChildren().forEach((c) => c.destroy({ children: true }));
    state.fields.forEach((field, i) => {
      const area = MAP.fields[i];
      if (area) this.fields.addChild(drawField(field, area, state.time.hour));
    });
    this.invalidate();
  }

  /** Fumée de tourbe au-dessus de la pagode, fumée de la cheminée quand les alambics chauffent. */
  private updateSmoke(state: GameState): void {
    const emitters: Emitter[] = [];
    for (const machine of state.machines) {
      const room = state.building.rooms.find((r) => r.id === machine.roomId);
      if (!room || room.ruined || !('batch' in machine) || !machine.batch) continue;
      const rise = roomAt(state.building, room.col, 1) ? DISTILLERY.storey : 0;
      const x = DISTILLERY.x + room.col * DISTILLERY.column + DISTILLERY.column / 2;
      const roofY = DISTILLERY.y - rise;
      if (machine.kind === 'malting') {
        emitters.push({
          x,
          y: roofY + DISTILLERY.depth * 0.46,
          style: STYLES.peatSmoke,
          everyMs: 380,
          timer: 0,
        });
      } else if (machine.kind === 'distillation') {
        const cx = x + DISTILLERY.column * 0.18;
        emitters.push({
          x: cx,
          y: roofY + DISTILLERY.depth * 0.26,
          style: STYLES.smoke,
          everyMs: 300,
          timer: 0,
        });
      }
    }
    // On garde les minuteurs des émetteurs existants pour un débit régulier.
    const key = (e: Emitter) => `${e.x}:${e.y}`;
    const previous = new Map(this.emitters.map((e) => [key(e), e]));
    this.emitters = emitters.map((e) => previous.get(key(e)) ?? e);
  }

  /** Repère sur la tuile touchée (champs et constructions des étapes suivantes). */
  private selectTile(wx: number, wy: number): void {
    const col = Math.floor(wx / MAP.tileSize);
    const row = Math.floor(wy / MAP.tileSize);
    const inside = col >= 0 && row >= 0 && col < MAP.cols && row < MAP.rows;
    this.highlight.visible = inside;
    if (inside) {
      this.highlight
        .clear()
        .rect(col * MAP.tileSize, row * MAP.tileSize, MAP.tileSize, MAP.tileSize)
        .fill({ color: PALETTE.highlight, alpha: 0.18 })
        .stroke({ width: 2, color: PALETTE.highlight, alpha: 0.9 });
    }
    this.invalidate();
  }

  private apply(camera: Camera): void {
    this.camera = clampCamera(camera, this.view, WORLD, this.insets);
    this.world.scale.set(this.camera.zoom);
    this.world.position.set(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom);
    this.invalidate();
  }
}
