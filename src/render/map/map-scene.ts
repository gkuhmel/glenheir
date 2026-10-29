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
import { distilleryBounds, drawDistillery, drawWarehouse } from './buildings';
import { createGrid } from './grid';
import { createGround } from './ground';
import { createScenery } from './scenery';

const WORLD: Size = { width: MAP.cols * MAP.tileSize, height: MAP.rows * MAP.tileSize };

export interface MapHandlers {
  openDistillery(): void;
  selectWarehouse(id: number): void;
}

const contains = (r: Rect, x: number, y: number) =>
  x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

/** La carte du domaine : terrain, distillerie et chais vus du dessus. */
export class MapScene implements Scene {
  readonly root = new Container();
  private readonly world = new Container();
  private readonly buildings = new Container();
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
      this.buildings,
      grid,
      this.highlight,
    );
    this.root.addChild(this.world);
  }

  /** Redessine les bâtiments quand la distillerie ou les chais changent. */
  setState(state: GameState): void {
    this.state = state;
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
      const cy = (court.y + court.height / 2 - 1) * MAP.tileSize;
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
      const area = this.terrain.warehouse;
      const T = MAP.tileSize;
      const rect = { x: area.x * T, y: area.y * T, width: area.width * T, height: area.height * T };
      const warehouse = this.state.warehouses[0];
      if (warehouse && contains(rect, point.x, point.y)) {
        this.handlers.selectWarehouse(warehouse.id);
        return;
      }
    }
    this.selectTile(point.x, point.y);
  }

  update(): boolean {
    return false;
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
