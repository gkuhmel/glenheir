import { Container, Graphics, Rectangle } from 'pixi.js';
import { CASKS, WAREHOUSE } from '../../data/balance';
import { createRng } from '../../sim/rng';
import type { GameState } from '../../sim/state';
import { ageYears, extensionsOf, type Cask } from '../../sim/systems/warehouse';
import {
  clampCamera,
  panBy,
  screenToWorld,
  zoomAt,
  type Camera,
  type Insets,
  type Size,
} from '../camera';
import { OUTFITS, Person } from '../characters/person';
import { Particles, type PuffStyle } from '../particles';
import type { Scene } from '../stage';
import {
  CHAI_COLORS as C,
  drawCask,
  drawEmptyPlace,
  drawHall,
  ruinHoles,
  extensionSite,
  windowXs,
} from './drawing';
import {
  AISLE_Y,
  CHAI,
  HALL_TOP,
  columnsFor,
  columnX,
  placeAt,
  placeCenter,
  RACK_FLOOR,
  WORLD_HEIGHT,
  worldWidth,
} from './layout';

export type WarehouseSelection =
  | { kind: 'place'; place: number }
  | { kind: 'extension' }
  /** Chai en ruine touché ailleurs que sur un fût : sa restauration. */
  | { kind: 'ruin' }
  | { kind: 'employee'; employeeId: number };

export interface WarehouseHandlers {
  select(warehouseId: number, selection: WarehouseSelection | null): void;
}

const ZOOM = { min: 0.35, max: 2 };
const FOCUS_MS = 320;
/** Part de l'écran laissée libre au-dessus du tiroir (qui occupe 55 % de la hauteur). */
const ABOVE_DRAWER = 0.45;
/** Les décors sont mis en texture par tranches (limite de taille des textures). */
const SEGMENT_COLS = 10;
/** Part des anges : volutes dorées qui s'échappent des fûts. */
const ANGELS: PuffStyle = {
  color: 0xf3dc9a,
  alpha: 0.32,
  radius: 3,
  vx: 3,
  vy: -16,
  spread: 7,
  grow: 1.6,
  lifeMs: 4200,
};
const WALK_SPEED = 55;
/** Bande verticale montrée par défaut : du toit d'ardoise à l'allée. */
const FRAME = { top: HALL_TOP - 60, bottom: RACK_FLOOR + CHAI.aisle };

/** Vue en coupe d'un chai : fûts sur trois hauteurs, lumière rare, un ouvrier qui fait sa ronde. */
export class WarehouseScene implements Scene {
  readonly root = new Container();
  private readonly world = new Container();
  private readonly hall = new Container();
  private readonly shafts = new Graphics();
  private readonly casks = new Container();
  private readonly lamps = new Container();
  private readonly angels = new Particles(createRng(808));
  private readonly motes: { g: Graphics; x: number; y: number; phase: number }[] = [];
  private readonly selectionRing = new Graphics();
  private readonly master = new Person(OUTFITS.cellarMaster, 1.3);
  /** Le maître de chai en ronde (null : personne au chai). */
  private masterId: number | null = null;
  private readonly rng = createRng(4711);
  private warehouseId: number | null = null;
  private places: number = WAREHOUSE.startPlaces;
  private canExtend = false;
  private ruined = false;
  private filled: Cask[] = [];
  private world_: Size = { width: 1, height: WORLD_HEIGHT };
  private camera: Camera = { x: 0, y: 0, zoom: 1 };
  private view: Size = { width: 1, height: 1 };
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private signature = '';
  private framed = false;
  private selection: WarehouseSelection | null = null;
  private focus: { from: Camera; to: Camera; elapsed: number } | null = null;
  private time = 0;
  private angelTimer = 0;
  private walk = { target: 300, pause: 0 };

  constructor(
    private readonly invalidate: () => void,
    private readonly handlers: WarehouseHandlers,
  ) {
    this.selectionRing.visible = false;
    this.shafts.blendMode = 'add';
    this.master.view.scale.set(0.95);
    this.master.view.position.set(300, AISLE_Y);
    this.world.addChild(
      this.hall,
      this.shafts,
      this.casks,
      this.lamps,
      this.angels.container,
      this.selectionRing,
      this.master.view,
    );
    this.root.addChild(this.world);
  }

  /** Chai affiché ; la caméra repart de la porte à chaque entrée. */
  open(warehouseId: number): void {
    if (warehouseId !== this.warehouseId) this.signature = '';
    this.warehouseId = warehouseId;
    this.framed = false;
    this.clearSelection();
  }

  get currentId(): number | null {
    return this.warehouseId;
  }

  setState(state: GameState): void {
    const warehouse = state.warehouses.find((w) => w.id === this.warehouseId);
    if (!warehouse) return;
    // Le maître de chai n'est là que pendant sa ronde.
    const master = state.staff.find(
      (e) => e.role === 'cellarMaster' && e.working && !warehouse.ruined,
    );
    this.masterId = master?.id ?? null;
    if (this.master.view.visible !== (master !== undefined)) {
      this.master.view.visible = master !== undefined;
      this.invalidate();
    }
    const casks = state.casks.filter((c) => c.warehouseId === warehouse.id);
    const looks = casks.map((c) => [
      c.place,
      c.type,
      ageYears(c, state.time.hour) >= CASKS.legalAgeYears,
    ]);
    const signature = JSON.stringify([warehouse, looks]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.filled = casks;
    this.places = warehouse.places;
    this.ruined = warehouse.ruined;
    this.canExtend = !warehouse.ruined && extensionsOf(warehouse) < WAREHOUSE.maxExtensions;
    this.rebuild(state);
  }

  clearSelection(): void {
    const had = this.selection !== null;
    this.selection = null;
    this.selectionRing.visible = false;
    // Le tiroir se ferme : la caméra revient doucement sur les fûts.
    if (had) this.focus = { from: { ...this.camera }, to: this.restingCamera(), elapsed: 0 };
    else this.apply(this.camera);
  }

  resize(view: Size, insets: Insets): void {
    this.view = view;
    this.insets = insets;
    if (!this.framed && this.warehouseId !== null) {
      this.framed = true;
      this.frame();
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
    if (this.warehouseId === null) return;
    const p = screenToWorld(this.camera, sx, sy);
    const v = this.master.view;
    if (
      this.masterId !== null &&
      v.visible &&
      Math.abs(p.x - v.x) < 22 &&
      p.y < v.y + 6 &&
      p.y > v.y - 100
    ) {
      this.clearSelection();
      this.selection = { kind: 'employee', employeeId: this.masterId };
      this.handlers.select(this.warehouseId, this.selection);
      return;
    }
    const place = placeAt(p.x, p.y, this.places);
    const site = extensionSite(this.places);
    if (this.ruined) {
      // En ruine, seuls les vieux fûts se touchent ; le reste propose la restauration.
      const cask = place !== null && this.filled.some((c) => c.place === place);
      if (cask) this.select({ kind: 'place', place });
      else {
        this.clearSelection();
        this.selection = { kind: 'ruin' };
        this.handlers.select(this.warehouseId, this.selection);
      }
    } else if (place !== null) this.select({ kind: 'place', place });
    else if (this.canExtend && p.x >= site.x0 && p.x < site.x1 && p.y < RACK_FLOOR + 20)
      this.select({ kind: 'extension' });
    else {
      this.clearSelection();
      this.handlers.select(this.warehouseId, null);
    }
  }

  update(dtMs: number): boolean {
    this.time += dtMs / 1000;
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
    // Les puits de lumière respirent avec les nuages qui passent dehors.
    this.shafts.alpha = 0.75 + 0.25 * Math.sin(this.time * 0.35) * Math.sin(this.time * 0.13);
    this.lamps.children.forEach((lamp, i) => {
      const glow = (lamp as Container).children[0];
      if (glow)
        glow.alpha = 0.8 + 0.2 * Math.sin(this.time * 7 + i) * Math.sin(this.time * 2.3 + i);
    });
    for (const m of this.motes) {
      m.phase += dtMs / 1000;
      m.g.position.set(m.x + Math.sin(m.phase * 0.5) * 16, m.y + Math.sin(m.phase * 0.3) * 12);
      m.g.alpha = 0.3 + 0.3 * Math.sin(m.phase * 1.1);
    }
    this.angelTimer -= dtMs;
    if (this.angelTimer <= 0 && this.filled.length > 0) {
      const cask = this.filled[this.rng.int(0, this.filled.length - 1)]!;
      const c = placeCenter(cask.place);
      this.angels.emit(c.x + this.rng.range(-12, 12), c.y - CHAI.caskRadius + 4, ANGELS);
      this.angelTimer = Math.max(250, 1600 - this.filled.length * 40);
    }
    this.angels.update(dtMs);
    this.updateWorker(dtMs);
    if (this.selection) this.selectionRing.alpha = 0.7 + 0.3 * Math.sin(performance.now() / 260);
    return true;
  }

  /** Ronde de l'ouvrier : il marche dans l'allée, s'arrête, sonde un fût, repart. */
  private updateWorker(dtMs: number): void {
    const person = this.master;
    const x = person.view.x;
    if (this.walk.pause > 0) {
      this.walk.pause -= dtMs;
      if (this.walk.pause <= 0) {
        const right = Math.max(200, columnX(columnsFor(this.places)) - 20);
        this.walk.target = this.rng.range(150, right);
      }
    } else {
      const dx = this.walk.target - x;
      if (Math.abs(dx) < 2) {
        person.pose = this.rng.chance(0.6) ? 'work' : 'idle';
        this.walk.pause = this.rng.range(2500, 6000);
      } else {
        person.pose = 'walk';
        person.face(dx);
        person.view.x += Math.sign(dx) * Math.min(Math.abs(dx), (WALK_SPEED * dtMs) / 1000);
      }
    }
    person.update(dtMs);
  }

  private select(selection: WarehouseSelection): void {
    if (this.warehouseId === null) return;
    this.selection = selection;
    const center = this.drawRing();
    this.focusOn(center.x, center.y);
    this.handlers.select(this.warehouseId, selection);
    this.invalidate();
  }

  /** Anneau de laiton autour de la place ou du chantier choisi ; renvoie son centre. */
  private drawRing(): { x: number; y: number } {
    this.selectionRing.clear();
    this.selectionRing.visible = this.selection !== null;
    if (this.selection?.kind === 'place') {
      const c = placeCenter(this.selection.place);
      this.selectionRing
        .circle(c.x, c.y + 2, CHAI.caskRadius + 7)
        .stroke({ width: 4, color: C.brassLight });
      return c;
    }
    const site = extensionSite(this.places);
    if (this.selection?.kind === 'extension' && this.canExtend) {
      this.selectionRing
        .roundRect(site.x0 + 4, RACK_FLOOR - 290, site.x1 - site.x0 - 8, 290, 12)
        .stroke({ width: 4, color: C.brassLight });
    }
    return { x: (site.x0 + site.x1) / 2, y: RACK_FLOOR - 140 };
  }

  /** Avec le tiroir ouvert, on peut faire défiler le chai jusqu'au-dessus du tiroir. */
  private clampInsets(): Insets {
    if (!this.selection) return this.insets;
    return {
      ...this.insets,
      bottom: Math.max(this.insets.bottom, this.view.height * (1 - ABOVE_DRAWER)),
    };
  }

  private focusOn(cx: number, cy: number): void {
    const { zoom } = this.camera;
    const screenY = (this.insets.top + this.view.height * ABOVE_DRAWER) / 2;
    const target = clampCamera(
      { zoom, x: cx - this.view.width / 2 / zoom, y: cy - screenY / zoom },
      this.view,
      this.world_,
      this.clampInsets(),
    );
    this.focus = { from: { ...this.camera }, to: target, elapsed: 0 };
  }

  /** Cadrage d'entrée : la porte à gauche et quatre rangées de fûts, du toit à l'allée. */
  private frame(): void {
    const visibleH = this.view.height - this.insets.top - this.insets.bottom;
    const fit = Math.min(
      visibleH / (FRAME.bottom - FRAME.top),
      this.view.width / (CHAI.endWall + 4.3 * CHAI.colWidth),
    );
    const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, fit));
    this.camera = { ...this.restingCamera(zoom), x: 0 };
  }

  /** Caméra centrée verticalement sur le chai, à la position horizontale actuelle. */
  private restingCamera(zoom = this.camera.zoom): Camera {
    const visibleH = this.view.height - this.insets.top - this.insets.bottom;
    const y = (FRAME.top + FRAME.bottom) / 2 - (this.insets.top + visibleH / 2) / zoom;
    return clampCamera({ zoom, x: this.camera.x, y }, this.view, this.world_, this.insets);
  }

  private apply(camera: Camera): void {
    this.camera = clampCamera(camera, this.view, this.world_, this.clampInsets());
    this.world.scale.set(this.camera.zoom);
    this.world.position.set(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom);
    this.invalidate();
  }

  private rebuild(state: GameState): void {
    const width = worldWidth(this.places, this.canExtend);
    this.world_ = { width, height: WORLD_HEIGHT };
    const cols = columnsFor(this.places);

    this.hall.removeChildren().forEach((c) => c.destroy({ children: true }));
    const seed = 31 + (this.warehouseId ?? 0);
    const drawn = () => drawHall(createRng(seed), this.places, this.canExtend, width, this.ruined);
    for (const slice of slices(drawn, width)) this.hall.addChild(slice);

    this.shafts.clear();
    // Le jour tombe en grands puits par les trous du toit.
    if (this.ruined) {
      for (const x of ruinHoles(width)) {
        this.shafts
          .poly([
            x - 40,
            HALL_TOP - 60,
            x + 40,
            HALL_TOP - 60,
            x + 130,
            RACK_FLOOR + 40,
            x - 10,
            RACK_FLOOR + 40,
          ])
          .fill({ color: C.daylight, alpha: 0.1 });
      }
    }
    for (const x of windowXs(cols)) {
      this.shafts
        .poly([
          x - 14,
          HALL_TOP + 70,
          x + 14,
          HALL_TOP + 70,
          x + 120,
          RACK_FLOOR,
          x + 40,
          RACK_FLOOR,
        ])
        .fill({ color: C.daylight, alpha: 0.07 });
      this.shafts
        .poly([x - 8, HALL_TOP + 72, x + 8, HALL_TOP + 72, x + 96, RACK_FLOOR, x + 52, RACK_FLOOR])
        .fill({ color: C.daylight, alpha: 0.06 });
    }
    // Jour qui entre par la porte ouverte.
    this.shafts
      .poly([
        34,
        RACK_FLOOR - 150,
        120,
        RACK_FLOOR - 150,
        260,
        RACK_FLOOR + CHAI.aisle,
        34,
        RACK_FLOOR + CHAI.aisle,
      ])
      .fill({
        color: C.daylight,
        alpha: 0.08,
      });

    for (const m of this.motes) m.g.destroy();
    this.motes.length = 0;
    for (const x of windowXs(cols)) {
      for (let i = 0; i < 7; i++) {
        const g = new Graphics().circle(0, 0, this.rng.range(1, 2)).fill(C.daylight);
        const t = this.rng.range(0.1, 0.95);
        const mx = x + t * 70 + this.rng.range(-15, 15);
        const my = HALL_TOP + 80 + t * (RACK_FLOOR - HALL_TOP - 90);
        g.position.set(mx, my);
        this.shafts.addChild(g);
        this.motes.push({ g, x: mx, y: my, phase: this.rng.range(0, 10) });
      }
    }

    this.lamps.removeChildren().forEach((c) => c.destroy({ children: true }));
    for (let col = 2; col < cols && !this.ruined; col += 6) {
      const x = columnX(col) + CHAI.colWidth / 2;
      const lamp = new Container();
      const glow = new Graphics()
        .circle(x, HALL_TOP + 196, 46)
        .fill({ color: C.lamp, alpha: 0.12 })
        .circle(x, HALL_TOP + 196, 22)
        .fill({ color: C.lamp, alpha: 0.18 });
      glow.blendMode = 'add';
      const body = new Graphics()
        .moveTo(x, HALL_TOP + 164)
        .lineTo(x, HALL_TOP + 184)
        .stroke({ width: 1.5, color: 0x1a1612 })
        .roundRect(x - 7, HALL_TOP + 184, 14, 20, 4)
        .fill({ color: C.lamp, alpha: 0.9 })
        .stroke({ width: 2, color: 0x2a241d })
        .rect(x - 8, HALL_TOP + 182, 16, 4)
        .fill(0x2a241d);
      lamp.addChild(glow, body);
      this.lamps.addChild(lamp);
    }

    this.casks.removeChildren().forEach((c) => c.destroy({ children: true }));
    const byPlace = new Map(this.filled.map((c) => [c.place, c]));
    // Seules les places de la tranche (et de ses bords) sont dessinées.
    const drawCasks = (x0: number, x1: number) => {
      const content = new Container();
      const empty = new Graphics();
      content.addChild(empty);
      for (let place = 0; place < this.places; place++) {
        const c = placeCenter(place);
        if (c.x < x0 || c.x > x1) continue;
        const cask = byPlace.get(place);
        if (!cask) {
          if (!this.ruined) drawEmptyPlace(empty, c.x, c.y);
        } else
          drawCask(content, createRng(cask.id * 131), c.x, c.y, {
            type: cask.type,
            id: cask.id,
            legal: ageYears(cask, state.time.hour) >= CASKS.legalAgeYears,
          });
      }
      return content;
    };
    for (const slice of slices(drawCasks, width)) this.casks.addChild(slice);

    if (this.master.view.x > columnX(cols)) this.master.view.x = columnX(cols) - 40;
    // Chai agrandi pendant que le chantier est choisi : on suit le nouveau chantier.
    if (this.selection?.kind === 'extension') {
      const center = this.drawRing();
      this.focusOn(center.x, center.y);
    }
    this.invalidate();
  }
}

/**
 * Découpe un décor large en tranches mises en texture : une texture géante
 * dépasserait la limite des cartes graphiques des téléphones. Chaque tranche
 * redessine le décor (même graine, même dessin) et n'en garde que sa part.
 */
function slices(draw: (x0: number, x1: number) => Container, width: number): Container[] {
  const step = SEGMENT_COLS * CHAI.colWidth;
  const out: Container[] = [];
  for (let x = 0; x < width; x += step) {
    const w = Math.min(step, width - x);
    const slice = new Container();
    const part = draw(x - CHAI.colWidth, x + w + CHAI.colWidth);
    const mask = new Graphics().rect(x, 0, w, WORLD_HEIGHT).fill(0xffffff);
    part.mask = mask;
    slice.addChild(part, mask);
    slice.boundsArea = new Rectangle(x, 0, w, WORLD_HEIGHT);
    slice.cacheAsTexture({ resolution: 2 });
    out.push(slice);
  }
  return out;
}
