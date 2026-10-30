import { describe, expect, it } from 'vitest';
import { CASKS, SALARIES, STAFF, TERROIRS } from '../../data/balance';
import { baseProfile } from '../profile';
import { executeCommand } from '../commands';
import { createInitialState, type Employee, type GameState } from '../state';
import { runTicks } from '../tick';
import { HOURS_PER_YEAR } from '../time';
import { newEmployee } from './staff';
import type { Machine, StillMachine } from './production';

const DAY = 24;

/** Distillerie restaurée, alambics en état, de l'orge et du malt en stock. */
function distillery(): GameState {
  const state = createInitialState(3);
  state.finance.cash = 1_000_000;
  executeCommand(state, { type: 'chooseTerroir', terroir: 'speyside' });
  for (const room of state.building.rooms)
    executeCommand(state, { type: 'restoreRoom', roomId: room.id });
  const still = machine<StillMachine>(state, 'distillation');
  executeCommand(state, { type: 'restoreStills', roomId: still.roomId });
  state.stocks.barley.amount = 8;
  state.stocks.malt.amount = 4;
  return state;
}

function machine<T extends Machine>(state: GameState, kind: Machine['kind']): T {
  return state.machines.find((m) => m.kind === kind) as T;
}

const order = (state: GameState, kind: Machine['kind']) =>
  executeCommand(state, { type: 'setOrders', roomId: machine(state, kind).roomId, orders: 1 });

function addEmployee(state: GameState, role: Employee['role'], level = 1): Employee {
  const employee = newEmployee(state.nextId++, { role, level, name: 'Test' });
  state.staff.push(employee);
  return employee;
}

describe('ouvriers aux machines', () => {
  it('une machine sans ouvrier s’arrête : un seul ouvrier va d’abord en aval', () => {
    const state = distillery();
    order(state, 'malting');
    order(state, 'mashing');
    runTicks(state, 1);
    // L'unique ouvrier tient la brasserie ; la malterie attend.
    expect(state.staff[0]!.roomId).toBe(machine(state, 'mashing').roomId);
    expect(machine(state, 'malting').kind === 'malting' && machine(state, 'malting')).toMatchObject(
      { batch: null },
    );
    // Le brassin fini, l'ouvrier passe à la malterie.
    runTicks(state, DAY);
    expect(state.staff[0]!.roomId).toBe(machine(state, 'malting').roomId);
  });

  it('avec deux ouvriers, les deux machines tournent en même temps', () => {
    const state = distillery();
    addEmployee(state, 'worker');
    order(state, 'malting');
    order(state, 'mashing');
    runTicks(state, 2);
    const rooms = state.staff.map((e) => e.roomId).sort();
    expect(rooms).toEqual(
      [machine(state, 'malting').roomId, machine(state, 'mashing').roomId].sort(),
    );
  });

  it('sans personne, rien ne tourne', () => {
    const state = distillery();
    executeCommand(state, { type: 'fire', employeeId: state.staff[0]!.id });
    order(state, 'malting');
    runTicks(state, 5 * DAY);
    expect(state.stocks.barley.amount).toBe(8);
    expect(state.stocks.malt.amount).toBe(4);
  });

  it('donne les alambics au distillateur, qui ne touche pas aux autres machines', () => {
    const state = distillery();
    const distiller = addEmployee(state, 'distiller');
    // Une cuve de bière prête pour les alambics.
    const fermentation = state.machines.find((m) => m.kind === 'fermentation')!;
    if (fermentation.kind === 'fermentation')
      fermentation.vessels[0] = {
        amount: 5_000,
        profile: baseProfile(),
        elapsed: 48,
        duration: 48,
      };
    order(state, 'distillation');
    order(state, 'mashing');
    runTicks(state, 1);
    expect(distiller.roomId).toBe(machine(state, 'distillation').roomId);
    expect(state.staff[0]!.roomId).toBe(machine(state, 'mashing').roomId);
  });

  it('un distillateur aux alambics affine les coupes et ajoute de la qualité', () => {
    const run = (role: Employee['role']) => {
      const state = distillery();
      state.staff = [];
      addEmployee(state, role, 3);
      const still = machine<StillMachine>(state, 'distillation');
      executeCommand(state, { type: 'setCut', roomId: still.roomId, cut: 'wide' });
      const fermentation = state.machines.find((m) => m.kind === 'fermentation')!;
      if (fermentation.kind === 'fermentation')
        fermentation.vessels[0] = {
          amount: 5_000,
          profile: { ...baseProfile(), quality: 50 },
          elapsed: 48,
          duration: 48,
        };
      order(state, 'distillation');
      runTicks(state, 3 * DAY);
      return state.stocks.newMake.profile.quality;
    };
    const worker = run('worker');
    const distiller = run('distiller');
    const { cutPenaltyReductionPerLevel, qualityPerLevel } = STAFF.distiller;
    // Coupe large : −10 ; un distillateur niveau 3 efface 45 % de la pénalité et ajoute +6.
    expect(distiller - worker).toBeCloseTo(
      10 * cutPenaltyReductionPerLevel * 3 + qualityPerLevel * 3,
      5,
    );
  });
});

describe('moral et expérience', () => {
  it('le travail sans relâche use le moral, le repos le répare (deux fois plus vite avec une salle du personnel)', () => {
    const state = distillery();
    const worker = state.staff[0]!;
    executeCommand(state, {
      type: 'setOrders',
      roomId: machine(state, 'malting').roomId,
      orders: 'continuous',
    });
    state.stocks.barley.amount = 1_000;
    runTicks(state, 10 * DAY);
    expect(worker.morale).toBeCloseTo(STAFF.morale.start + STAFF.morale.workPerHour * 240, 5);

    const resting = createInitialState(1);
    const idle = resting.staff[0]!;
    idle.morale = 20;
    runTicks(resting, 10);
    expect(idle.morale).toBeCloseTo(20 + STAFF.morale.restPerHour * 10, 5);
    resting.building.rooms[0]!.type = 'staffRoom';
    resting.building.rooms[0]!.ruined = false;
    runTicks(resting, 10);
    expect(idle.morale).toBeCloseTo(20 + STAFF.morale.restPerHour * 30, 5);
  });

  it('un employé démoralisé travaille 20 % moins vite et finit par démissionner', () => {
    const slow = distillery();
    slow.staff[0]!.morale = 0;
    order(slow, 'malting');
    runTicks(slow, 5 * 24);
    // Malterie : 5 jours de travail, à 80 % de vitesse, il en faut 6,25.
    expect(slow.stocks.malt.amount).toBe(4);
    runTicks(slow, 35);
    expect(slow.stocks.malt.amount).toBeGreaterThan(4);

    // À la tâche sans relâche et sans moral, il démissionne au bout d'un mois.
    const sad = distillery();
    sad.staff[0]!.morale = 0;
    sad.stocks.barley.amount = 10_000;
    executeCommand(sad, {
      type: 'setOrders',
      roomId: machine(sad, 'malting').roomId,
      orders: 'continuous',
    });
    const events = runTicks(sad, STAFF.morale.quitAfterHours + 1);
    const quit = events.some((e) => e.type === 'employeeQuit');
    expect(quit).toBe(true);
    expect(sad.staff).toHaveLength(0);
  });

  it('gagne un niveau après un mois de travail au niveau 1', () => {
    const state = distillery();
    executeCommand(state, {
      type: 'setOrders',
      roomId: machine(state, 'malting').roomId,
      orders: 'continuous',
    });
    state.stocks.barley.amount = 10_000;
    const events = runTicks(state, STAFF.xpHoursPerLevel + 1);
    expect(state.staff[0]!.level).toBe(2);
    expect(events.some((e) => e.type === 'levelUp')).toBe(true);
  });
});

describe('recrutement et gestion', () => {
  it('propose 2 candidats par rôle, renouvelés chaque mois', () => {
    const state = createInitialState(1);
    expect(state.candidates).toHaveLength(6);
    expect(new Set(state.candidates.map((c) => c.role))).toEqual(
      new Set(['worker', 'distiller', 'cellarMaster']),
    );
    expect(state.candidates.every((c) => c.level >= 1 && c.level <= 3)).toBe(true);
    const before = state.candidates.map((c) => c.id);
    runTicks(state, 30 * DAY);
    expect(state.candidates.map((c) => c.id)).not.toEqual(before);
  });

  it('embauche contre un mois de salaire', () => {
    const state = createInitialState(1);
    const candidate = state.candidates.find((c) => c.role === 'distiller')!;
    const cash = state.finance.cash;
    expect(executeCommand(state, { type: 'hire', candidateId: candidate.id }).ok).toBe(true);
    expect(state.finance.cash).toBe(cash - SALARIES.distiller[candidate.level - 1]!);
    expect(state.staff.at(-1)).toMatchObject({ role: 'distiller', name: candidate.name });
    expect(state.candidates.some((c) => c.id === candidate.id)).toBe(false);
  });

  it('forme un employé : 2 mois de salaire, absent 10 jours, +1 niveau', () => {
    const state = createInitialState(1);
    const worker = state.staff[0]!;
    const cash = state.finance.cash;
    expect(executeCommand(state, { type: 'train', employeeId: worker.id }).ok).toBe(true);
    expect(state.finance.cash).toBe(cash - 2 * SALARIES.worker[0]);
    expect(executeCommand(state, { type: 'train', employeeId: worker.id })).toEqual({
      ok: false,
      error: 'inTraining',
    });
    runTicks(state, 10 * DAY - 1);
    expect(worker.level).toBe(1);
    runTicks(state, 1);
    expect(worker.level).toBe(2);
    expect(worker.trainingUntil).toBeNull();
  });

  it('une prime remonte le moral pour un demi-mois de salaire', () => {
    const state = createInitialState(1);
    const worker = state.staff[0]!;
    worker.morale = 40;
    executeCommand(state, { type: 'giveBonus', employeeId: worker.id });
    expect(worker.morale).toBe(65);
    expect(state.finance.cash).toBe(50_000 - SALARIES.worker[0] / 2);
  });

  it('un licenciement coûte un mois de salaire', () => {
    const state = createInitialState(1);
    executeCommand(state, { type: 'fire', employeeId: state.staff[0]!.id });
    expect(state.staff).toHaveLength(0);
    expect(state.finance.cash).toBe(50_000 - SALARIES.worker[0]);
  });
});

describe('maître de chai', () => {
  it('réduit la part des anges de 5 % par niveau dans un chai restauré', () => {
    const state = createInitialState(5);
    state.finance.cash = 100_000;
    executeCommand(state, { type: 'chooseTerroir', terroir: 'speyside' });
    executeCommand(state, { type: 'restoreWarehouse', warehouseId: state.warehouses[0]!.id });
    addEmployee(state, 'cellarMaster', 4);
    const cask = state.casks[0]!;
    const lpa = cask.lpa;
    runTicks(state, HOURS_PER_YEAR);
    expect(cask.lpa).toBeCloseTo(lpa * (1 - TERROIRS.speyside.angelsShare * 0.8), 1);
    expect(CASKS.legalAgeYears).toBe(3);
  });

  it('fait sa ronde au chai de jour', () => {
    const state = createInitialState(5);
    state.finance.cash = 100_000;
    executeCommand(state, { type: 'restoreWarehouse', warehouseId: state.warehouses[0]!.id });
    const master = addEmployee(state, 'cellarMaster');
    runTicks(state, 2); // 10 h
    expect(master.working).toBe(true);
    runTicks(state, 12); // 22 h
    expect(master.working).toBe(false);
  });
});
