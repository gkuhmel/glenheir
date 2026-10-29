import { Application, Container, Graphics } from 'pixi.js';
import { MAP } from '../data/balance';
import {
  centerOn,
  clampCamera,
  panBy,
  screenToWorld,
  zoomAt,
  type Camera,
  type Insets,
  type Size,
} from './camera';
import { MAX_RESOLUTION, PALETTE, ZOOM } from './config';
import { attachGestures } from './gestures';
import { createGrid } from './grid';
import { createGround } from './ground';
import { createScenery } from './scenery';
import { generateTerrain } from '../sim/terrain';

const WORLD: Size = { width: MAP.cols * MAP.tileSize, height: MAP.rows * MAP.tileSize };

/**
 * Carte de la distillerie : stage PixiJS, sol en grille, caméra pilotée au
 * doigt. `getInsets` donne la place occupée par les barres de l'interface.
 */
export class MapView {
  private camera: Camera = { x: 0, y: 0, zoom: ZOOM.initial };
  private renderQueued = false;
  private readonly world = new Container();
  private readonly highlight = new Graphics();

  private constructor(
    private readonly app: Application,
    private readonly host: HTMLElement,
    private readonly getInsets: () => Insets,
  ) {}

  static async create(host: HTMLElement, getInsets: () => Insets): Promise<MapView> {
    const app = new Application();
    await app.init({
      // Rendu à la demande : la carte est statique tant que la caméra ne bouge pas.
      autoStart: false,
      resizeTo: host,
      background: PALETTE.background,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION),
    });
    host.appendChild(app.canvas);
    const view = new MapView(app, host, getInsets);
    view.setup();
    return view;
  }

  private get viewSize(): Size {
    return { width: this.app.screen.width, height: this.app.screen.height };
  }

  private setup(): void {
    this.highlight.visible = false;
    const terrain = generateTerrain();
    const grid = createGrid();
    grid.visible = false;
    this.world.addChild(createGround(terrain), createScenery(terrain), grid, this.highlight);
    this.app.stage.addChild(this.world);

    this.camera = centerOn(
      WORLD.width / 2,
      WORLD.height / 2,
      ZOOM.initial,
      this.viewSize,
      this.getInsets(),
    );
    this.apply(this.camera);

    attachGestures(this.app.canvas, {
      onPan: (dx, dy) => this.apply(panBy(this.camera, dx, dy)),
      onZoom: (factor, sx, sy) => this.apply(zoomAt(this.camera, factor, sx, sy, ZOOM)),
      onTap: (sx, sy) => this.selectTile(sx, sy),
    });
    this.app.renderer.on('resize', () => this.apply(this.camera));
  }

  /** Met en surbrillance la tuile touchée (repère visuel en attendant les bâtiments). */
  private selectTile(sx: number, sy: number): void {
    const point = screenToWorld(this.camera, sx, sy);
    const col = Math.floor(point.x / MAP.tileSize);
    const row = Math.floor(point.y / MAP.tileSize);
    if (col < 0 || row < 0 || col >= MAP.cols || row >= MAP.rows) {
      this.highlight.visible = false;
      this.requestRender();
      return;
    }
    this.highlight
      .clear()
      .rect(col * MAP.tileSize, row * MAP.tileSize, MAP.tileSize, MAP.tileSize)
      .fill({ color: PALETTE.highlight, alpha: 0.18 })
      .stroke({ width: 2, color: PALETTE.highlight, alpha: 0.9 });
    this.highlight.visible = true;
    this.requestRender();
  }

  private apply(camera: Camera): void {
    this.camera = clampCamera(camera, this.viewSize, WORLD, this.getInsets());
    this.world.scale.set(this.camera.zoom);
    this.world.position.set(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom);
    this.requestRender();
  }

  /** Redessine à la prochaine image (une seule fois, même si plusieurs gestes arrivent). */
  private requestRender(): void {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.app.render();
    });
  }

  /** À appeler quand la taille des barres change. */
  refresh(): void {
    this.app.resize();
    this.apply(this.camera);
  }

  get element(): HTMLElement {
    return this.host;
  }
}
