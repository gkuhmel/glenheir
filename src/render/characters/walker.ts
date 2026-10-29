import { BUILDING } from '../../data/balance';
import type { Rng } from '../../sim/rng';
import { roomAt, stairColumn, type Building, type Room } from '../../sim/systems/building';
import { colX, floorY, ROOM, STAIR } from '../interior/layout';
import { Person, type Outfit } from './person';

interface Point {
  x: number;
  y: number;
}

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
 * Un employé qui vit dans la vue en coupe : il choisit une salle, s'y rend en
 * passant par les escaliers, y travaille un moment, puis recommence.
 * Purement visuel : la simulation ne dépend pas de ses déplacements.
 */
export class Walker {
  readonly person: Person;
  private level = 0;
  private path: Point[] = [];
  private timer = 0;
  private building: Building;

  constructor(
    outfit: Outfit,
    building: Building,
    private readonly rng: Rng,
  ) {
    this.person = new Person(outfit, rng.range(0, 10));
    this.building = building;
    const start = building.rooms.find((r) => r.level === 0)!;
    this.person.view.position.set(colX(start.col) + ROOM.width / 2, floorY(0));
    this.timer = rng.range(500, 1500);
  }

  setBuilding(building: Building): void {
    this.building = building;
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
          this.person.pose = 'work';
          this.timer = this.rng.range(5000, 10000);
        }
      } else {
        view.position.set(view.x + (dx / dist) * step, view.y + (dy / dist) * step);
      }
      return;
    }
    this.timer -= dtMs;
    if (this.timer > 0) return;
    if (this.person.pose === 'work') {
      this.person.pose = 'idle';
      this.timer = this.rng.range(800, 2000);
      return;
    }
    this.chooseDestination();
  }

  /** Salles en état de marche en priorité ; sinon, il déblaie les ruines. */
  private chooseDestination(): void {
    const candidates = this.building.rooms.filter((r) => reachable(this.building, r));
    const weighted = candidates.flatMap((r) => (r.type && !r.ruined ? [r, r, r] : [r]));
    const room = this.rng.pick(weighted);
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
