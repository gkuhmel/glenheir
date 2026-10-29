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
import { createGround } from './grid';

const WORLD: Size = { width: MAP.cols * MAP.tileSize, height: MAP.rows * MAP.tileSize };

/**
 * Carte de la distillerie : stage PixiJS, sol en grille, caméra pilotée au
 * doigt. `getInsets` donne la place occupée par les barres de l'interface.
 */
export class MapView {
  private camera: Camera = { x: 0, y: 0, zoom: ZOOM.initial };
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
    this.world.addChild(createGround(), this.highlight);
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
      return;
    }
    this.highlight
      .clear()
      .rect(col * MAP.tileSize, row * MAP.tileSize, MAP.tileSize, MAP.tileSize)
      .fill({ color: PALETTE.highlight, alpha: 0.25 })
      .stroke({ width: 2, color: PALETTE.highlight });
    this.highlight.visible = true;
  }

  private apply(camera: Camera): void {
    this.camera = clampCamera(camera, this.viewSize, WORLD, this.getInsets());
    this.world.scale.set(this.camera.zoom);
    this.world.position.set(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom);
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
