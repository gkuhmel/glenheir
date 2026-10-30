import { Container, Graphics } from 'pixi.js';
import type { Rng } from '../../sim/rng';
import type { Employee, GameState } from '../../sim/state';
import type { Rect } from '../../sim/terrain';
import { OUTFITS } from '../characters/person';

interface Point {
  x: number;
  y: number;
}

const SPEED = 22;

/** Silhouette vue de dessus : épaules à la couleur de la tenue, tête, casquette. */
function figure(employee: Employee): Container {
  const outfit = OUTFITS[employee.role];
  const shoulders = 'overlay' in outfit ? outfit.overlay : outfit.shirt;
  const g = new Graphics()
    .ellipse(1.5, 2, 7, 4)
    .fill({ color: 0x000000, alpha: 0.25 })
    .ellipse(0, 0, 7, 4.5)
    .fill(shoulders)
    .circle(0, -1, 3.6)
    .fill(outfit.hair);
  if ('hat' in outfit && outfit.hat === 'cap')
    g.circle(0, -1.3, 3.2).fill(outfit.hatColor ?? 0x4a4038);
  // Un peu plus grand que nature pour qu'on les voie bien sur la carte.
  g.scale.set(1.35);
  const view = new Container();
  view.addChild(g);
  return view;
}

interface MapWalker {
  id: number;
  view: Container;
  path: Point[];
  pause: number;
  phase: number;
}

/**
 * Le personnel vu sur la carte : au repos, on va prendre l'air jusqu'aux champs ;
 * le maître de chai en ronde fait les cent pas devant le chai. Ceux qui tiennent
 * une machine sont à l'intérieur de la distillerie.
 */
export class MapPeople {
  readonly container = new Container();
  private walkers: MapWalker[] = [];
  private spots: { home: Point; house: Rect; fields: Rect[]; warehouse: Point } | null = null;
  private duties = new Map<number, 'out' | 'cellar'>();

  constructor(private readonly rng: Rng) {}

  /** Points de repère : porte et emprise de la distillerie, champs, porte du chai. */
  setSpots(home: Point, house: Rect, fields: Rect[], warehouse: Point): void {
    this.spots = { home, house, fields, warehouse };
  }

  /**
   * Chemin vers une destination : pour passer de la cour (au sud) aux champs
   * (au nord), on contourne la distillerie par l'est au lieu de traverser le toit.
   */
  private route(from: Point, to: Point): Point[] {
    const house = this.spots!.house;
    const south = (p: Point) => p.y > house.y + house.height;
    const north = (p: Point) => p.y < house.y;
    if ((south(from) && north(to)) || (north(from) && south(to))) {
      const east = house.x + house.width + 26 + this.rng.range(0, 14);
      return [{ x: east, y: from.y }, { x: east, y: to.y }, to];
    }
    return [to];
  }

  setState(state: GameState): void {
    const outside = new Map<number, Employee>();
    for (const e of state.staff) {
      if (e.trainingUntil !== null) continue;
      if (e.role === 'cellarMaster' && e.working) outside.set(e.id, e);
      else if (e.roomId === null && !e.working) outside.set(e.id, e);
    }
    this.walkers = this.walkers.filter((w) => {
      if (outside.has(w.id)) return true;
      w.view.destroy({ children: true });
      return false;
    });
    for (const [id, e] of outside) {
      const duty = e.role === 'cellarMaster' && e.working ? 'cellar' : 'out';
      if (this.walkers.some((w) => w.id === id)) {
        if (this.duties.get(id) !== duty) {
          const walker = this.walkers.find((w) => w.id === id)!;
          walker.path = this.route(walker.view.position, this.target(duty));
          walker.pause = 0;
        }
      } else if (this.spots) {
        const view = figure(e);
        view.position.set(this.spots.home.x, this.spots.home.y);
        this.container.addChild(view);
        this.walkers.push({
          id,
          view,
          path: this.route(this.spots.home, this.target(duty)),
          pause: 0,
          phase: this.rng.range(0, 6),
        });
      }
      this.duties.set(id, duty);
    }
  }

  get active(): boolean {
    return this.walkers.length > 0;
  }

  private target(duty: 'out' | 'cellar'): Point {
    const spots = this.spots!;
    if (duty === 'cellar')
      return {
        x: spots.warehouse.x + this.rng.range(-40, 40),
        y: spots.warehouse.y + this.rng.range(8, 30),
      };
    // Le long d'un champ, côté chemin, ou dans la cour.
    if (this.rng.chance(0.7) && spots.fields.length > 0) {
      const f = this.rng.pick(spots.fields);
      return { x: f.x + this.rng.range(8, f.width - 8), y: f.y + f.height + this.rng.range(6, 18) };
    }
    return { x: spots.home.x + this.rng.range(-90, 90), y: spots.home.y + this.rng.range(10, 60) };
  }

  update(dtMs: number): void {
    for (const w of this.walkers) {
      const target = w.path[0];
      if (!target) {
        w.pause -= dtMs;
        w.view.scale.set(1);
        if (w.pause <= 0)
          w.path = this.route(w.view.position, this.target(this.duties.get(w.id) ?? 'out'));
        continue;
      }
      const dx = target.x - w.view.x;
      const dy = target.y - w.view.y;
      const dist = Math.hypot(dx, dy);
      const step = (SPEED * dtMs) / 1000;
      w.phase += dtMs / 1000;
      // Léger balancement de la marche, et la silhouette s'oriente vers sa destination.
      w.view.rotation = Math.atan2(dy, dx) + Math.PI / 2;
      w.view.scale.set(1 + 0.06 * Math.sin(w.phase * 12));
      if (dist <= step) {
        w.view.position.set(target.x, target.y);
        w.path.shift();
        if (w.path.length === 0) w.pause = this.rng.range(3000, 8000);
      } else {
        w.view.position.set(w.view.x + (dx / dist) * step, w.view.y + (dy / dist) * step);
      }
    }
  }
}
