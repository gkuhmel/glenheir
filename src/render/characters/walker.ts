import { BUILDING } from '../../data/balance';
import type { Rng } from '../../sim/rng';
import { roomAt, stairColumn, type Building, type Room } from '../../sim/systems/building';
import { colX, floorY, ROOM, STAIR } from '../interior/layout';
import { Person, type Outfit } from './person';

interface Point {
  x: number;
  y: number;
}

/** Où doit être l'employé : à une machine, au repos (salle du personnel si elle existe). */
export type Duty = { kind: 'machine'; roomId: number } | { kind: 'rest'; roomId: number | null };

const SPEED = 75;

/** Les cases d'un niveau reliées à son escalier (ou tout le rez-de-chaussée). */
function reachable(building: Building, room: Room): boolean {
  if (room.level === 0) return true;
  const lower = room.level > 0 ? 0 : -1;
  const stair = stairColumn(building, lower);
  if (stair === null) return false;
  const [from, to] = room.col < stair ? [room.col, stair] : [stair, room.col];
  for (let col = from; col <= to; col++) if (!roomAt(building, col, room.level)) return false;
  return true;
}

/**
 * Un employé dans la vue en coupe : il se rend à la machine que la simulation
 * lui a confiée et y travaille ; au repos, il rejoint la salle du personnel ou
 * flâne d'une salle à l'autre. Purement visuel : la simulation ne dépend pas de
 * ses déplacements.
 */
export class Walker {
  readonly person: Person;
  private level = 0;
  private path: Point[] = [];
  private timer = 0;
  private building: Building;
  private duty: Duty = { kind: 'rest', roomId: null };
  /** Consigne changée en chemin : il finit son trajet (escalier compris) puis repart. */
  private redirect = false;

  constructor(
    readonly employeeId: number,
    outfit: Outfit,
    building: Building,
    private readonly rng: Rng,
  ) {
    this.person = new Person(outfit, rng.range(0, 10));
    this.building = building;
    const start = building.rooms.find((r) => r.level === 0)!;
    this.person.view.position.set(colX(start.col) + ROOM.width / 2, floorY(0));
    this.timer = rng.range(300, 1200);
  }

  setBuilding(building: Building): void {
    this.building = building;
  }

  /** Nouvelle consigne : il part aussitôt vers sa machine ou vers le repos. */
  setDuty(duty: Duty): void {
    if (duty.kind === this.duty.kind && duty.roomId === this.duty.roomId) return;
    this.duty = duty;
    this.timer = 0;
    if (this.path.length > 0) this.redirect = true;
    else this.goTo(this.dutyRoom());
  }

  update(dtMs: number): void {
    this.person.update(dtMs);
    const view = this.person.view;
    const target = this.path[0];
    if (target) {
      const dx = target.x - view.x;
      const dy = target.y - view.y;
      const dist = Math.hypot(dx, dy);
      const step = (SPEED * dtMs) / 1000;
      this.person.pose = 'walk';
      this.person.face(dx);
      if (dist <= step) {
        view.position.set(target.x, target.y);
        this.path.shift();
        if (this.path.length === 0) {
          if (this.redirect) {
            this.redirect = false;
            this.goTo(this.dutyRoom());
          } else this.arrive();
        }
      } else {
        view.position.set(view.x + (dx / dist) * step, view.y + (dy / dist) * step);
      }
      return;
    }
    this.timer -= dtMs;
    if (this.timer > 0) return;
    // À sa machine, il change de geste de temps en temps ; au repos, il flâne.
    if (this.duty.kind === 'machine' || this.duty.roomId !== null) this.goTo(this.dutyRoom());
    else this.goTo(this.wanderRoom());
  }

  private arrive(): void {
    this.person.pose = this.duty.kind === 'machine' ? 'work' : 'idle';
    this.timer =
      this.duty.kind === 'machine' ? this.rng.range(6000, 12000) : this.rng.range(3000, 8000);
  }

  private dutyRoom(): Room | null {
    const id = this.duty.roomId;
    return id === null ? this.wanderRoom() : (this.building.rooms.find((r) => r.id === id) ?? null);
  }

  /** Une salle en état, au hasard (ou une ruine à déblayer s'il n'y a rien d'autre). */
  private wanderRoom(): Room | null {
    const candidates = this.building.rooms.filter((r) => reachable(this.building, r));
    if (candidates.length === 0) return null;
    const usable = candidates.filter((r) => r.type && !r.ruined);
    return this.rng.pick(usable.length > 0 ? usable : candidates);
  }

  private goTo(room: Room | null): void {
    if (!room || !reachable(this.building, room)) {
      this.timer = 1000;
      return;
    }
    const x = colX(room.col) + this.rng.range(70, ROOM.width - 70);
    this.path = this.route(room.level, x);
    if (this.path.length === 0) this.timer = 1000;
  }

  private route(targetLevel: number, targetX: number): Point[] {
    const points: Point[] = [];
    let level = this.level;
    while (level !== targetLevel) {
      const up = targetLevel > level;
      const lower = up ? level : level - 1;
      const stair = stairColumn(this.building, lower);
      if (stair === null || lower < BUILDING.minLevel) return [];
      const bottom = { x: colX(stair) + STAIR.bottomX, y: floorY(lower) };
      const top = { x: colX(stair) + STAIR.topX, y: floorY(lower + 1) };
      points.push(...(up ? [bottom, top] : [top, bottom]));
      level += up ? 1 : -1;
    }
    points.push({ x: targetX, y: floorY(targetLevel) });
    this.level = targetLevel;
    return points;
  }
}
