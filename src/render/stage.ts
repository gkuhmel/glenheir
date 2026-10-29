import { Application, type Container } from 'pixi.js';
import type { Insets, Size } from './camera';
import { MAX_RESOLUTION, PALETTE } from './config';
import { attachGestures } from './gestures';

/** Une scène plein écran (carte, vue intérieure) avec sa propre caméra. */
export interface Scene {
  readonly root: Container;
  resize(view: Size, insets: Insets): void;
  pan(dx: number, dy: number): void;
  zoom(factor: number, sx: number, sy: number): void;
  tap(sx: number, sy: number): void;
  /** Avance les animations ; renvoie vrai si la scène bouge et doit être redessinée. */
  update(dtMs: number): boolean;
}

/** Durée maximale prise en compte entre deux images (évite les sauts après une pause). */
const MAX_FRAME_MS = 100;

/**
 * Canevas PixiJS partagé par les scènes. Une seule scène est affichée à la fois ;
 * elle reçoit les gestes et n'est redessinée que si elle s'anime ou a changé.
 */
export class Stage {
  private active: Scene | null = null;
  private dirty = true;
  private last = 0;

  private constructor(
    private readonly app: Application,
    private readonly getInsets: () => Insets,
  ) {}

  static async create(host: HTMLElement, getInsets: () => Insets): Promise<Stage> {
    const app = new Application();
    await app.init({
      autoStart: false,
      resizeTo: host,
      background: PALETTE.background,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION),
    });
    host.appendChild(app.canvas);
    const stage = new Stage(app, getInsets);
    stage.start();
    return stage;
  }

  get viewSize(): Size {
    return { width: this.app.screen.width, height: this.app.screen.height };
  }

  get insets(): Insets {
    return this.getInsets();
  }

  /** Demande un rendu à la prochaine image. */
  readonly invalidate = (): void => {
    this.dirty = true;
  };

  show(scene: Scene): void {
    if (this.active) this.app.stage.removeChild(this.active.root);
    this.active = scene;
    this.app.stage.addChild(scene.root);
    scene.resize(this.viewSize, this.getInsets());
    this.invalidate();
  }

  get current(): Scene | null {
    return this.active;
  }

  /** À appeler quand la taille des barres change. */
  refresh(): void {
    this.app.resize();
    this.active?.resize(this.viewSize, this.getInsets());
    this.invalidate();
  }

  private start(): void {
    attachGestures(this.app.canvas, {
      onPan: (dx, dy) => this.active?.pan(dx, dy),
      onZoom: (factor, sx, sy) => this.active?.zoom(factor, sx, sy),
      onTap: (sx, sy) => this.active?.tap(sx, sy),
    });
    this.app.renderer.on('resize', () => {
      this.active?.resize(this.viewSize, this.getInsets());
      this.invalidate();
    });
    const frame = (now: number) => {
      const dt = this.last ? Math.min(MAX_FRAME_MS, now - this.last) : 16;
      this.last = now;
      const animating = this.active?.update(dt) ?? false;
      if (animating || this.dirty) {
        this.dirty = false;
        this.app.render();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
