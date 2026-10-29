import { Container, Graphics } from 'pixi.js';
import { BUILDING } from '../../data/balance';
import { createRng } from '../../sim/rng';
import type { GameState } from '../../sim/state';
import { isPurchasable, roomAt, type Building } from '../../sim/systems/building';
import type { SimEvent } from '../../sim/tick';
import {
  clampCamera,
  panBy,
  screenToWorld,
  zoomAt,
  type Camera,
  type Insets,
  type Size,
} from '../camera';
import { OUTFITS } from '../characters/person';
import { Walker } from '../characters/walker';
import type { Scene } from '../stage';
import { createBackdrop } from './backdrop';
import { colX, levelTop, MARGIN, ROOM, SKY, WORLD } from './layout';
import { INTERIOR as P } from './palette';
import { drawRoomInterior } from './rooms';
import { drawShell, drawSlots } from './shell';

export type InteriorSelection =
  { kind: 'room'; roomId: number } | { kind: 'slot'; col: number; level: number };

export interface InteriorHandlers {
  select(selection: InteriorSelection | null): void;
}

const ZOOM = { min: 0.3, max: 1.8 };
const FADE_MS = 1600;
const FOCUS_MS = 320;
/** Part de l'écran laissée libre au-dessus du tiroir (qui occupe 55 % de la hauteur). */
const ABOVE_DRAWER = 0.45;

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  max: number;
  grow: number;
}

/** Vue en coupe de la distillerie : salles, machines, personnages. */
export class InteriorScene implements Scene {
  readonly root = new Container();
  private readonly world = new Container();
  private readonly backdrop = createBackdrop();
  private readonly rooms = new Container();
  private readonly shell = new Container();
  private readonly slots = new Container();
  private buildMode = false;
  private readonly people = new Container();
  private readonly effects = new Container();
  private readonly selectionBox = new Graphics();
  private readonly roomGraphics = new Map<number, Graphics>();
  private readonly particles: Particle[] = [];
  private readonly fading: { g: Graphics; life: number }[] = [];
  private readonly motes: { g: Graphics; x: number; y: number; phase: number }[] = [];
  private readonly rng = createRng(777);
  private walkers: Walker[] = [];
  private camera: Camera = { x: 0, y: 0, zoom: 0.8 };
  private view: Size = { width: 1, height: 1 };
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private signature = '';
  private building: Building | null = null;
  private selection: InteriorSelection | null = null;
  private framed = false;
  private focus: { from: Camera; to: Camera; elapsed: number } | null = null;

  constructor(
    private readonly invalidate: () => void,
    private readonly handlers: InteriorHandlers,
  ) {
    this.selectionBox.visible = false;
    this.world.addChild(
      this.backdrop,
      this.rooms,
      this.shell,
      this.people,
      this.slots,
      this.effects,
      this.selectionBox,
    );
    this.slots.visible = false;
    this.backdrop.cacheAsTexture({ resolution: 1 });
    this.root.addChild(this.world);
  }

  /** Met la scène à jour ; les événements déclenchent les transitions de restauration. */
  setState(state: GameState, events: readonly SimEvent[] = []): void {
    const signature = JSON.stringify(state.building);
    if (signature !== this.signature) {
      const changed = new Set<number>();
      for (const e of events) {
        if (e.type === 'roomRestored' || e.type === 'roomBuilt' || e.type === 'slotPurchased')
          changed.add(e.roomId);
      }
      this.rebuild(state.building, changed);
      this.signature = signature;
    }
    this.syncWalkers(state);
  }

  /** Mode « Agrandir » : montre les emplacements achetables et permet de les toucher. */
  setBuildMode(on: boolean): void {
    this.buildMode = on;
    this.slots.visible = on;
    if (!on && this.selection?.kind === 'slot') {
      this.clearSelection();
      this.handlers.select(null);
    }
    this.invalidate();
  }

  /** Recadre la caméra sur le bâtiment à la prochaine entrée dans la scène. */
  reframe(): void {
    this.framed = false;
  }

  clearSelection(): void {
    this.selection = null;
    this.selectionBox.visible = false;
    this.invalidate();
  }

  resize(view: Size, insets: Insets): void {
    this.view = view;
    this.insets = insets;
    if (!this.framed && this.building) {
      this.framed = true;
      this.frame(this.building);
    }
    this.apply(this.camera);
  }

  pan(dx: number, dy: number): void {
    this.focus = null;
    this.apply(panBy(this.camera, dx, dy));
  }

  zoom(factor: number, sx: number, sy: number): void {
    this.apply(zoomAt(this.camera, factor, sx, sy, ZOOM));
  }

  tap(sx: number, sy: number): void {
    if (!this.building) return;
    const p = screenToWorld(this.camera, sx, sy);
    const col = Math.floor((p.x - MARGIN) / ROOM.width);
    const level = BUILDING.maxLevel - Math.floor((p.y - SKY) / ROOM.height);
    const room = roomAt(this.building, col, level);
    if (room) this.select({ kind: 'room', roomId: room.id }, col, level);
    else if (this.buildMode && isPurchasable(this.building, { col, level })) {
      this.select({ kind: 'slot', col, level }, col, level);
    } else {
      this.clearSelection();
      this.handlers.select(null);
    }
  }

  update(dtMs: number): boolean {
    if (this.focus) {
      this.focus.elapsed += dtMs;
      const t = Math.min(1, this.focus.elapsed / FOCUS_MS);
      const ease = 1 - (1 - t) ** 3;
      const { from, to } = this.focus;
      this.apply({
        zoom: from.zoom + (to.zoom - from.zoom) * ease,
        x: from.x + (to.x - from.x) * ease,
        y: from.y + (to.y - from.y) * ease,
      });
      if (t >= 1) this.focus = null;
    }
    for (const walker of this.walkers) walker.update(dtMs);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dtMs;
      const t = p.life / p.max;
      p.g.x += (p.vx * dtMs) / 1000;
      p.g.y += (p.vy * dtMs) / 1000;
      p.g.scale.set(1 + t * p.grow);
      p.g.alpha = Math.max(0, 1 - t);
      if (t >= 1) {
        p.g.destroy();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i]!;
      f.life += dtMs;
      f.g.alpha = Math.max(0, 1 - f.life / FADE_MS);
      if (f.life >= FADE_MS) {
        f.g.destroy();
        this.fading.splice(i, 1);
      }
    }
    // Poussière en suspension dans la lumière.
    for (const m of this.motes) {
      m.phase += dtMs / 1000;
      m.g.position.set(m.x + Math.sin(m.phase * 0.7) * 14, m.y + Math.sin(m.phase * 0.4) * 10);
      m.g.alpha = 0.25 + 0.25 * Math.sin(m.phase * 1.3);
    }
    if (this.selection) this.selectionBox.alpha = 0.75 + 0.25 * Math.sin(performance.now() / 260);
    return true;
  }

  private select(selection: InteriorSelection, col: number, level: number): void {
    this.selection = selection;
    this.selectionBox
      .clear()
      .roundRect(colX(col) + 4, levelTop(level) + 4, ROOM.width - 8, ROOM.height - 8, 10)
      .stroke({ width: 5, color: P.brassLight });
    this.selectionBox.visible = true;
    this.focusCell(col, level);
    this.handlers.select(selection);
    this.invalidate();
  }

  /** Fait glisser la caméra pour que la case reste visible au-dessus du tiroir. */
  private focusCell(col: number, level: number): void {
    const { zoom } = this.camera;
    const cx = colX(col) + ROOM.width / 2;
    const cy = levelTop(level) + ROOM.height / 2;
    const screenY = (this.insets.top + this.view.height * ABOVE_DRAWER) / 2;
    const target = clampCamera(
      { zoom, x: cx - this.view.width / 2 / zoom, y: cy - screenY / zoom },
      this.view,
      WORLD,
      this.insets,
    );
    this.focus = { from: { ...this.camera }, to: target, elapsed: 0 };
  }

  /** Cadrage initial : le rez-de-chaussée et ses toits, centrés entre les barres. */
  private frame(building: Building): void {
    const cols = building.rooms.map((r) => r.col);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    const hasUpper = building.rooms.some((r) => r.level > 0);
    const top = levelTop(hasUpper ? 1 : 0) - 200;
    const bottom = levelTop(0) + ROOM.height + 30;
    const visibleH = this.view.height - this.insets.top - this.insets.bottom;
    // Environ une salle et demie de large sur un téléphone en portrait.
    const fit = Math.min(visibleH / (bottom - top), this.view.width / (ROOM.width * 1.7));
    const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, fit));
    const visibleW = this.view.width / zoom;
    const width = colX(maxCol + 1) - colX(minCol);
    // Bâtiment plus large que l'écran : on commence par la gauche (malterie).
    const x =
      width > visibleW ? colX(minCol) - 40 : (colX(minCol) + colX(maxCol + 1) - visibleW) / 2;
    // Bâtiment centré verticalement entre les barres.
    const y = (top + bottom) / 2 - (this.insets.top + visibleH / 2) / zoom;
    this.camera = { zoom, x, y };
  }

  private apply(camera: Camera): void {
    this.camera = clampCamera(camera, this.view, WORLD, this.insets);
    this.world.scale.set(this.camera.zoom);
    this.world.position.set(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom);
    this.invalidate();
  }

  private rebuild(building: Building, changed: Set<number>): void {
    const first = this.building === null;
    this.building = building;
    for (const walker of this.walkers) walker.setBuilding(building);

    // Les anciennes versions des salles transformées s'effacent en fondu.
    for (const id of changed) {
      const old = this.roomGraphics.get(id);
      if (old) {
        this.rooms.removeChild(old);
        this.effects.addChild(old);
        this.fading.push({ g: old, life: 0 });
        this.roomGraphics.delete(id);
      }
      const room = building.rooms.find((r) => r.id === id);
      if (room) this.burst(colX(room.col) + ROOM.width / 2, levelTop(room.level) + ROOM.height / 2);
    }
    for (const g of this.roomGraphics.values()) g.destroy();
    this.roomGraphics.clear();
    this.rooms.removeChildren();
    for (const room of building.rooms) {
      const g = new Graphics();
      drawRoomInterior(
        g,
        createRng(room.id * 7919 + (room.ruined ? 1 : 0)),
        room.type,
        room.ruined,
        room.level,
      );
      g.position.set(colX(room.col), levelTop(room.level));
      // Décor statique mis en texture : il n'est plus redessiné à chaque image.
      g.cacheAsTexture({ resolution: 3 });
      this.rooms.addChild(g);
      this.roomGraphics.set(room.id, g);
    }
    this.shell.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.shell.addChild(drawShell(building, createRng(99)));
    this.slots.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.slots.addChild(drawSlots(building));
    // Les salles en fondu restent au-dessus des nouvelles, sous la structure.
    for (const f of this.fading) this.world.addChildAt(f.g, this.world.getChildIndex(this.shell));

    for (const m of this.motes) m.g.destroy();
    this.motes.length = 0;
    for (const room of building.rooms) {
      for (let i = 0; i < 4; i++) {
        const g = new Graphics().circle(0, 0, this.rng.range(1, 2.2)).fill(P.dust);
        const x = colX(room.col) + this.rng.range(30, ROOM.width - 30);
        const y = levelTop(room.level) + this.rng.range(40, ROOM.height - 40);
        g.position.set(x, y);
        this.effects.addChild(g);
        this.motes.push({ g, x, y, phase: this.rng.range(0, 10) });
      }
    }
    if (first) this.framed = false;
    this.invalidate();
  }

  /** Nuage de poussière et étincelles dorées au moment d'une restauration. */
  private burst(cx: number, cy: number): void {
    for (let i = 0; i < 26; i++) {
      const dust = new Graphics()
        .circle(0, 0, this.rng.range(8, 18))
        .fill({ color: 0xcdbb98, alpha: 0.7 });
      dust.position.set(cx + this.rng.range(-120, 120), cy + this.rng.range(-60, 80));
      this.effects.addChild(dust);
      this.particles.push({
        g: dust,
        vx: this.rng.range(-30, 30),
        vy: this.rng.range(-40, -5),
        life: 0,
        max: this.rng.range(900, 1600),
        grow: 1.5,
      });
    }
    for (let i = 0; i < 22; i++) {
      const spark = new Graphics().star(0, 0, 4, 6, 2.5).fill(P.brassLight);
      spark.position.set(cx + this.rng.range(-130, 130), cy + this.rng.range(-40, 90));
      this.effects.addChild(spark);
      this.particles.push({
        g: spark,
        vx: this.rng.range(-15, 15),
        vy: this.rng.range(-90, -40),
        life: 0,
        max: this.rng.range(1000, 1800),
        grow: 0.2,
      });
    }
  }

  /** Un personnage par ouvrier de la simulation. */
  private syncWalkers(state: GameState): void {
    const workers = state.staff.filter((e) => e.role === 'worker');
    while (this.walkers.length < workers.length) {
      const walker = new Walker(
        OUTFITS.worker,
        state.building,
        createRng(1000 + this.walkers.length),
      );
      this.walkers.push(walker);
      this.people.addChild(walker.person.view);
    }
    while (this.walkers.length > workers.length) {
      this.walkers.pop()!.person.view.destroy({ children: true });
    }
  }
}
