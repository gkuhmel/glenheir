import { Container, Graphics, Text } from 'pixi.js';
import type { GameState } from '../../sim/state';
import { isDone, type Machine } from '../../sim/systems/production';
import { machineStatus } from '../../ui/machine-status';
import { Particles, runEmitters, STYLES, type Emitter } from '../particles';
import { createRng } from '../../sim/rng';
import { colX, levelTop, ROOM } from './layout';
import { BOTTLING_BELT } from './rooms';
import { INTERIOR as P } from './palette';

const W = ROOM.width;
const FLOOR = ROOM.height - ROOM.floor;
/** Hauteur des toits dessinés par shell.ts (faîtage au-dessus du haut de la salle). */
const ROOF_H = 118;

interface Glow {
  g: Graphics;
  phase: number;
}

/**
 * Vie des machines dans la vue en coupe : feux qui vacillent, vapeur, fumée de
 * tourbe, bulles de fermentation, gouttes d'alcool, et un badge d'état par machine.
 */
export class MachineActivity {
  readonly container = new Container();
  private readonly particles = new Particles(createRng(55));
  private readonly glows: Glow[] = [];
  private readonly belts: {
    container: Container;
    bottles: Container[];
    x0: number;
    y: number;
    offset: number;
  }[] = [];
  private readonly badges = new Container();
  private emitters: Emitter[] = [];
  private signature = '';

  constructor() {
    this.container.addChild(this.particles.container, this.badges);
  }

  setState(state: GameState): void {
    const statuses = state.machines.map((m) => [m.roomId, machineStatus(state, m)] as const);
    const signature = JSON.stringify([statuses, state.building.rooms]);
    if (signature === this.signature) return;
    this.signature = signature;

    for (const glow of this.glows) glow.g.destroy();
    this.glows.length = 0;
    for (const b of this.belts) b.container.destroy({ children: true });
    this.belts.length = 0;
    this.badges.removeChildren().forEach((c) => c.destroy({ children: true }));
    const emitters: Emitter[] = [];

    for (const machine of state.machines) {
      const room = state.building.rooms.find((r) => r.id === machine.roomId);
      if (!room || room.ruined) continue;
      const status = machineStatus(state, machine);
      const x0 = colX(room.col);
      const y0 = levelTop(room.level);
      this.badge(status.text, status.running, x0 + W - 12, y0 + 52);
      // Faîte du toit de la colonne (pour la fumée de la pagode et de la cheminée).
      const topLevel = Math.max(
        ...state.building.rooms
          .filter((r) => r.col === room.col && r.level >= 0)
          .map((r) => r.level),
      );
      const apex = levelTop(topLevel) - ROOF_H;
      this.machineEffects(machine, status.running, x0, y0, apex, emitters);
    }
    const key = (e: Emitter) => `${e.x}:${e.y}:${e.everyMs}`;
    const previous = new Map(this.emitters.map((e) => [key(e), e]));
    this.emitters = emitters.map((e) => previous.get(key(e)) ?? e);
  }

  /** Bouteilles qui avancent sur le tapis : vides, remplies, puis étiquetées. */
  private belt(x0: number, floor: number): void {
    const bottles: Container[] = [];
    const container = new Container();
    for (let i = 0; i < 8; i++) {
      const bottle = new Container();
      const glass = new Graphics()
        .roundRect(-4, -22, 8, 22, 2)
        .fill({ color: 0x8fb39a, alpha: 0.7 })
        .rect(-1.5, -29, 3, 8)
        .fill({ color: 0x8fb39a, alpha: 0.7 });
      const whisky = new Graphics().roundRect(-3, -16, 6, 15, 1.5).fill(P.bottle[0]!);
      const label = new Graphics()
        .rect(-4, -14, 8, 7)
        .fill(P.parchment)
        .rect(-4, -12, 8, 1.5)
        .fill(P.brass)
        .rect(-1.5, -31, 3, 3)
        .fill(0x7a2b2b);
      bottle.addChild(glass, whisky, label);
      container.addChild(bottle);
      bottles.push(bottle);
    }
    this.container.addChildAt(container, 0);
    this.belts.push({ container, bottles, x0, y: floor - BOTTLING_BELT.y, offset: 0 });
  }

  update(dtMs: number): void {
    const span = BOTTLING_BELT.to - BOTTLING_BELT.from;
    for (const b of this.belts) {
      b.offset = (b.offset + (36 * dtMs) / 1000) % span;
      b.bottles.forEach((bottle, i) => {
        const x = BOTTLING_BELT.from + ((b.offset + (i * span) / b.bottles.length) % span);
        bottle.position.set(b.x0 + x, b.y);
        // Remplie après la remplisseuse, étiquetée après l'étiqueteuse.
        bottle.children[1]!.visible = x > 80;
        bottle.children[2]!.visible = x > 180;
      });
    }
    runEmitters(this.emitters, this.particles, dtMs);
    this.particles.update(dtMs);
    for (const glow of this.glows) {
      glow.phase += dtMs / 1000;
      glow.g.alpha = 0.75 + 0.25 * Math.sin(glow.phase * 9) * Math.sin(glow.phase * 3.7);
    }
  }

  private glow(x: number, y: number, radius: number): void {
    const g = new Graphics()
      .circle(0, 0, radius * 2.4)
      .fill({ color: P.fire, alpha: 0.18 })
      .ellipse(0, 0, radius, radius * 0.55)
      .fill(P.fire)
      .ellipse(0, -1, radius * 0.5, radius * 0.3)
      .fill(P.fireCore);
    g.position.set(x, y);
    this.container.addChildAt(g, 0);
    this.glows.push({ g, phase: x });
  }

  private badge(text: string, running: boolean, right: number, top: number): void {
    const label = new Text({
      text,
      style: { fontFamily: 'Alegreya Sans', fontWeight: '700', fontSize: 15, fill: P.attic },
      resolution: 2,
    });
    const w = label.width + 22;
    const board = new Graphics()
      .roundRect(0, 0, w, 26, 13)
      .fill({ color: running ? 0xf3e3b4 : 0xd9cfb8, alpha: 0.95 })
      .stroke({ width: 1.5, color: running ? P.brass : 0x8a7a5a });
    if (running) board.circle(11, 13, 4).fill(0x5f8a3a);
    label.position.set(running ? 18 : 11, 3);
    const badge = new Container();
    badge.addChild(board, label);
    badge.position.set(right - w, top);
    this.badges.addChild(badge);
  }

  private machineEffects(
    machine: Machine,
    running: boolean,
    x0: number,
    y0: number,
    apex: number,
    emitters: Emitter[],
  ): void {
    const floor = y0 + FLOOR;
    switch (machine.kind) {
      case 'malting':
        if (!running) return;
        this.glow(x0 + W - 53, floor - 10, 18);
        emitters.push({
          x: x0 + W - 53,
          y: floor - 30,
          style: STYLES.spark,
          everyMs: 260,
          timer: 0,
        });
        // Fumée de tourbe au sommet de la pagode.
        emitters.push({
          x: x0 + W / 2,
          y: apex - 120,
          style: STYLES.peatSmoke,
          everyMs: 320,
          timer: 0,
        });
        return;
      case 'mashing':
        if (!running) return;
        emitters.push({ x: x0 + 130, y: floor - 128, style: STYLES.steam, everyMs: 240, timer: 0 });
        emitters.push({
          x: x0 + 170,
          y: floor - 126,
          style: STYLES.steam,
          everyMs: 310,
          timer: 120,
        });
        return;
      case 'fermentation':
        machine.vessels.forEach((vessel, i) => {
          if (!vessel || isDone(vessel)) return;
          const cx = x0 + (i === 0 ? 24 : 160) + 58;
          // Les bulles sortent par la trappe du couvercle, juste sous la passerelle.
          emitters.push({ x: cx, y: y0 + 46, style: STYLES.bubble, everyMs: 140, timer: i * 70 });
        });
        return;
      case 'distillation':
        if (!running) return;
        this.glow(x0 + 82, floor - 7, 12);
        this.glow(x0 + 186, floor - 7, 10);
        emitters.push({ x: x0 + W - 34, y: y0 + 44, style: STYLES.steam, everyMs: 280, timer: 0 });
        emitters.push({ x: x0 + 137, y: floor - 38, style: STYLES.drop, everyMs: 450, timer: 0 });
        // Fumée de la cheminée de briques.
        emitters.push({
          x: x0 + W * 0.72 + 17,
          y: apex - 84,
          style: STYLES.smoke,
          everyMs: 260,
          timer: 0,
        });
        return;
      case 'bottling':
        if (!running) return;
        this.belt(x0, floor);
        return;
      case 'gin':
        if (!running) return;
        // Feu sous le petit alambic, vapeur au panier à botaniques, gouttes au bout du col.
        this.glow(x0 + 210, floor - 9, 11);
        emitters.push({ x: x0 + 210, y: floor - 134, style: STYLES.steam, everyMs: 340, timer: 0 });
        emitters.push({
          x: x0 + W - 16,
          y: floor - 86,
          style: STYLES.drop,
          everyMs: 520,
          timer: 0,
        });
        return;
    }
  }
}
