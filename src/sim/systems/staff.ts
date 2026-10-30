import { STAFF } from '../../data/balance';
import { FIRST_NAMES, LAST_NAMES } from '../../data/content';
import type { Rng } from '../rng';
import type { Candidate, Employee, GameState, StaffRole } from '../state';
import type { SimEvent } from '../tick';
import { toGameDate } from '../time';
import { roomGroups } from './building';
import { needsOperator, type Machine } from './production';

/** Rôles qui peuvent tenir chaque machine (les cuves fermentent seules). */
const OPERATORS: Record<Machine['kind'], readonly StaffRole[]> = {
  distillation: ['distiller', 'worker'],
  mashing: ['worker'],
  gin: ['worker'],
  malting: ['worker'],
  fermentation: [],
};

/** Ordre de priorité : l'aval d'abord, pour que la chaîne ne s'engorge pas. */
const PRIORITY: Machine['kind'][] = ['distillation', 'mashing', 'gin', 'malting'];

/** Nouvel employé, frais et motivé. */
export function newEmployee(
  id: number,
  candidate: { role: StaffRole; level: number; name: string },
): Employee {
  return {
    id,
    role: candidate.role,
    level: candidate.level,
    name: candidate.name,
    morale: STAFF.morale.start,
    xp: 0,
    roomId: null,
    working: false,
    trainingUntil: null,
    despairHours: 0,
  };
}

export const isPresent = (employee: Employee): boolean => employee.trainingUntil === null;

/** Vitesse de travail : +5 % par niveau, −20 % quand le moral est au plus bas. */
export function workEfficiency(employee: Employee): number {
  const morale = STAFF.morale;
  const speed = 1 + STAFF.speedPerLevel * (employee.level - 1);
  return speed * (employee.morale < morale.lowThreshold ? morale.lowEfficiency : 1);
}

/** Le meilleur maître de chai présent (il révèle la qualité et réduit la part des anges). */
export function cellarMaster(state: GameState): Employee | null {
  let best: Employee | null = null;
  for (const e of state.staff) {
    if (e.role === 'cellarMaster' && isPresent(e) && (!best || e.level > best.level)) best = e;
  }
  return best;
}

export const hasStaffRoom = (state: GameState): boolean =>
  state.building.rooms.some((r) => r.type === 'staffRoom' && !r.ruined);

/**
 * Répartit le personnel présent sur les machines qui ont du travail, de l'aval
 * vers l'amont. Un employé garde sa machine d'une heure à l'autre quand il le
 * peut ; les alambics vont d'abord à un distillateur. Renvoie l'opérateur de
 * chaque salle. Une machine qui a du travail sans opérateur reste à l'arrêt.
 */
export function assignStaff(state: GameState): Map<number, Employee> {
  const previous = new Map(state.staff.map((e) => [e.id, e.roomId]));
  for (const e of state.staff) {
    e.roomId = null;
    e.working = false;
  }
  const active = new Set<number>();
  for (const group of roomGroups(state.building)) for (const id of group.roomIds) active.add(id);

  const operators = new Map<number, Employee>();
  const free = state.staff.filter(isPresent);
  const take = (employee: Employee, machine: Machine) => {
    employee.roomId = machine.roomId;
    employee.working = true;
    operators.set(machine.roomId, employee);
    free.splice(free.indexOf(employee), 1);
  };
  for (const kind of PRIORITY) {
    for (const machine of state.machines) {
      if (machine.kind !== kind || !active.has(machine.roomId)) continue;
      if (!needsOperator(state, machine)) continue;
      const roles = OPERATORS[kind];
      const capable = free.filter((e) => roles.includes(e.role));
      if (capable.length === 0) continue;
      // Le même qu'à l'heure précédente, sinon le rôle préféré, puis le plus compétent.
      const chosen =
        capable.find((e) => previous.get(e.id) === machine.roomId) ??
        [...capable].sort(
          (a, b) => roles.indexOf(a.role) - roles.indexOf(b.role) || b.level - a.level,
        )[0]!;
      take(chosen, machine);
    }
  }
  // Le maître de chai fait sa ronde de jour, s'il y a des fûts dans un chai restauré.
  const hour = toGameDate(state.time.hour).hour;
  const [start, end] = STAFF.cellarMaster.workHours;
  const restored = new Set(state.warehouses.filter((w) => !w.ruined).map((w) => w.id));
  const casks = state.casks.some((c) => restored.has(c.warehouseId));
  for (const e of free) {
    if (e.role === 'cellarMaster' && casks && hour >= start && hour < end) e.working = true;
  }
  return operators;
}

/**
 * Une heure pour le personnel : moral (le travail use, le repos répare),
 * expérience, fin des formations, démissions.
 */
export function runStaff(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const hour = state.time.hour;
  const { morale } = STAFF;
  const rest = morale.restPerHour * (hasStaffRoom(state) ? morale.staffRoomFactor : 1);
  for (const e of [...state.staff]) {
    if (e.trainingUntil !== null && hour >= e.trainingUntil) {
      e.trainingUntil = null;
      e.level = Math.min(STAFF.maxLevel, e.level + 1);
      e.xp = 0;
      events.push({ type: 'trainingDone', hour, employeeId: e.id, level: e.level });
    }
    e.morale = Math.min(100, Math.max(0, e.morale + (e.working ? morale.workPerHour : rest)));
    if (e.working && e.level < STAFF.maxLevel) {
      e.xp += 1;
      if (e.xp >= STAFF.xpHoursPerLevel * e.level) {
        e.level += 1;
        e.xp = 0;
        events.push({ type: 'levelUp', hour, employeeId: e.id, level: e.level });
      }
    }
    e.despairHours = e.morale <= 0 ? e.despairHours + 1 : 0;
    if (e.despairHours >= morale.quitAfterHours) {
      state.staff.splice(state.staff.indexOf(e), 1);
      events.push({ type: 'employeeQuit', hour, name: e.name, role: e.role });
    }
  }
  return events;
}

function pickLevel(rng: Rng): number {
  const roll = rng.next();
  let sum = 0;
  for (let i = 0; i < STAFF.hiring.levelWeights.length; i++) {
    sum += STAFF.hiring.levelWeights[i]!;
    if (roll < sum) return i + 1;
  }
  return 1;
}

/** Nouveaux candidats du mois : 2 par rôle recrutable, de niveau 1 à 3. */
export function refreshCandidates(state: GameState, rng: Rng): void {
  const candidates: Candidate[] = [];
  for (const role of STAFF.hireableRoles) {
    for (let i = 0; i < STAFF.hiring.candidatesPerRole; i++) {
      candidates.push({
        id: state.nextId++,
        role,
        level: pickLevel(rng),
        name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      });
    }
  }
  state.candidates = candidates;
}
