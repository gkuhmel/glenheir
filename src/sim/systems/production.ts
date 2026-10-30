import { GIN, PRODUCTION, STAFF, TERROIRS } from '../../data/balance';
import type { RoomType } from '../../data/content';
import { recordTransaction, roundMoney } from '../journal';
import { addToLot, applyModifier, takeFromLot, type Profile } from '../profile';
import type { GameState, StaffRole } from '../state';
import type { SimEvent } from '../tick';
import { TIME } from '../../data/balance';
import { roomGroups, type Building, type Room } from './building';
import type { Bottling } from './bottling';

export type PeatLevel = keyof typeof PRODUCTION.malting.peat;
export type Cut = keyof typeof PRODUCTION.distillation.cuts;
export type StillState = 'ruined' | 'none' | 'small' | 'medium';
/** Lots restant à lancer : un nombre, ou « en continu » tant qu'il y a de la matière. */
export type Orders = number | 'continuous';

/** Lot en cours dans une machine : quantité entrée, profil, avancement en heures. */
export interface Batch {
  amount: number;
  profile: Profile;
  elapsed: number;
  duration: number;
}

export interface MaltingMachine {
  kind: 'malting';
  roomId: number;
  orders: Orders;
  peat: PeatLevel;
  batch: Batch | null;
}

export interface MashingMachine {
  kind: 'mashing';
  roomId: number;
  orders: Orders;
  /** Moût prêt qui attend une cuve libre (en litres dans `amount`). */
  batch: Batch | null;
}

/** Une cuve de fermentation (washback) : vide, ou pleine de moût qui fermente. */
export type Vessel = Batch | null;

export interface FermentationMachine {
  kind: 'fermentation';
  roomId: number;
  long: boolean;
  vessels: Vessel[];
}

export interface StillMachine {
  kind: 'distillation';
  roomId: number;
  orders: Orders;
  stills: StillState;
  cut: Cut;
  batch: Batch | null;
}

/** Atelier gin : du new make et des botaniques, des bouteilles au bout d'un jour. */
export interface GinMachine {
  kind: 'gin';
  roomId: number;
  orders: Orders;
  batch: Batch | null;
}

/** Chaîne d'embouteillage : un lot à la fois, lancé depuis la fiche d'un fût. */
export interface BottlingMachine {
  kind: 'bottling';
  roomId: number;
  batch: Batch | null;
  /** La mise en bouteille en cours, qui rejoint le stock une fois finie. */
  run: Bottling | null;
}

export type Machine =
  | MaltingMachine
  | MashingMachine
  | FermentationMachine
  | StillMachine
  | GinMachine
  | BottlingMachine;

const HOURS_PER_DAY = TIME.hoursPerDay;

/** Machine installée dans une salle de production, réglages par défaut. */
export function createMachine(room: Room, startingStills: boolean): Machine | null {
  switch (room.type as RoomType) {
    case 'malting':
      return { kind: 'malting', roomId: room.id, orders: 0, peat: 'none', batch: null };
    case 'mashing':
      return { kind: 'mashing', roomId: room.id, orders: 0, batch: null };
    case 'fermentation':
      return {
        kind: 'fermentation',
        roomId: room.id,
        long: false,
        vessels: Array.from({ length: PRODUCTION.fermentation.vesselsPerRoom }, () => null),
      };
    case 'stillHouse':
      return {
        kind: 'distillation',
        roomId: room.id,
        orders: 0,
        // La salle des alambics de départ abrite la vieille paire à restaurer.
        stills: startingStills ? 'ruined' : 'none',
        cut: 'medium',
        batch: null,
      };
    case 'ginWorkshop':
      return { kind: 'gin', roomId: room.id, orders: 0, batch: null };
    case 'bottling':
      return { kind: 'bottling', roomId: room.id, batch: null, run: null };
    default:
      return null;
  }
}

/** Ajoute les machines des salles de production qui n'en ont pas encore. */
export function syncMachines(state: GameState, startingStills = false): void {
  for (const room of state.building.rooms) {
    if (state.machines.some((m) => m.roomId === room.id)) continue;
    const machine = createMachine(room, startingStills);
    if (machine) state.machines.push(machine);
  }
}

export const isDone = (batch: Batch): boolean => batch.elapsed >= batch.duration;

/** Heures restantes d'un lot. */
export const remainingHours = (batch: Batch): number => Math.max(0, batch.duration - batch.elapsed);

function workingRooms(building: Building): Map<number, number> {
  const efficiency = new Map<number, number>();
  for (const group of roomGroups(building)) {
    for (const id of group.roomIds) efficiency.set(id, group.efficiency);
  }
  return efficiency;
}

const hasOrders = (orders: Orders) => orders === 'continuous' || orders > 0;
const consumeOrder = (machine: { orders: Orders }) => {
  if (machine.orders !== 'continuous') machine.orders = Math.max(0, machine.orders - 1);
};

export function stillsCapacity(machine: StillMachine): number {
  return machine.stills === 'small' || machine.stills === 'medium'
    ? PRODUCTION.distillation.stills[machine.stills].litresPerDay
    : 0;
}

/** Cuve pleine dont la fermentation est terminée (la plus ancienne d'abord). */
function readyVessel(
  state: GameState,
  active: Map<number, number>,
): { machine: FermentationMachine; index: number } | null {
  for (const machine of state.machines) {
    if (machine.kind !== 'fermentation' || !active.has(machine.roomId)) continue;
    const index = machine.vessels.findIndex((v) => v !== null && isDone(v));
    if (index >= 0) return { machine, index };
  }
  return null;
}

function emptyVessel(
  state: GameState,
  active: Map<number, number>,
): { machine: FermentationMachine; index: number } | null {
  for (const machine of state.machines) {
    if (machine.kind !== 'fermentation' || !active.has(machine.roomId)) continue;
    const index = machine.vessels.findIndex((v) => v === null);
    if (index >= 0) return { machine, index };
  }
  return null;
}

function runStills(
  state: GameState,
  machine: StillMachine,
  efficiency: number,
  events: SimEvent[],
  operator: Operator | undefined,
): void {
  const hour = state.time.hour;
  const capacity = stillsCapacity(machine);
  if (machine.batch) {
    machine.batch.elapsed += efficiency;
    if (!isDone(machine.batch)) return;
    const { distillation } = PRODUCTION;
    const cut = distillation.cuts[machine.cut];
    const lpa = Math.round(machine.batch.amount * distillation.lpaPerLitre * cut.volume * 10) / 10;
    const stills =
      machine.stills === 'medium' ? distillation.stills.medium : distillation.stills.small;
    // Un distillateur aux alambics affine les coupes : pénalité réduite et qualité en plus.
    const distiller = operator?.role === 'distiller' ? operator.level : 0;
    const { cutPenaltyReductionPerLevel, qualityPerLevel } = STAFF.distiller;
    const cutQuality =
      cut.quality < 0
        ? cut.quality * Math.max(0, 1 - cutPenaltyReductionPerLevel * distiller)
        : cut.quality;
    const profile = applyModifier(applyModifier(machine.batch.profile, stills.profile), {
      ...cut.profile,
      quality: cutQuality + qualityPerLevel * distiller,
    });
    addToLot(state.stocks.newMake, lpa, profile);
    machine.batch = null;
    events.push({ type: 'distilled', hour, roomId: machine.roomId, lpa });
    return;
  }
  if (capacity === 0 || !hasOrders(machine.orders)) return;
  const active = workingRooms(state.building);
  const source = readyVessel(state, active);
  if (!source) return;
  const wash = source.machine.vessels[source.index]!;
  source.machine.vessels[source.index] = null;
  const duration = Math.ceil((wash.amount / capacity) * HOURS_PER_DAY);
  recordTransaction(
    state,
    -roundMoney((PRODUCTION.distillation.energyPerDay * duration) / HOURS_PER_DAY),
    'energy',
  );
  // L'heure du lancement compte déjà comme une heure de travail.
  machine.batch = { amount: wash.amount, profile: wash.profile, elapsed: efficiency, duration };
  consumeOrder(machine);
  events.push({ type: 'batchStarted', hour, roomId: machine.roomId });
}

function runFermentation(machine: FermentationMachine, efficiency: number): void {
  for (const vessel of machine.vessels) {
    if (vessel && !isDone(vessel)) vessel.elapsed += efficiency;
  }
}

/** Remplit une cuve de fermentation avec le moût d'un brassin. */
function fillVessel(
  target: { machine: FermentationMachine; index: number },
  litres: number,
  profile: Profile,
): void {
  const { fermentation } = PRODUCTION;
  const long = target.machine.long;
  target.machine.vessels[target.index] = {
    amount: Math.round(litres * (long ? 1 - fermentation.longVolumeLoss : 1)),
    profile: long ? applyModifier(profile, { fruity: fermentation.longFruity }) : profile,
    elapsed: 0,
    duration: (long ? fermentation.longDays : fermentation.shortDays) * HOURS_PER_DAY,
  };
}

function runMashing(
  state: GameState,
  machine: MashingMachine,
  efficiency: number,
  events: SimEvent[],
): void {
  const hour = state.time.hour;
  const active = workingRooms(state.building);
  if (machine.batch) {
    if (!isDone(machine.batch)) machine.batch.elapsed += efficiency;
    if (!isDone(machine.batch)) return;
    // Le moût attend qu'une cuve se libère.
    const target = emptyVessel(state, active);
    if (!target) return;
    fillVessel(target, machine.batch.amount, machine.batch.profile);
    events.push({ type: 'mashed', hour, roomId: machine.roomId, litres: machine.batch.amount });
    machine.batch = null;
    return;
  }
  const { mashing } = PRODUCTION;
  if (!hasOrders(machine.orders) || state.stocks.malt.amount < mashing.minTonnes) return;
  const malt = takeFromLot(state.stocks.malt, mashing.batchTonnes);
  machine.batch = {
    amount: Math.round(malt.amount * mashing.litresPerTonne),
    // L'eau du terroir marque le moût (Speyside : +10 fruité).
    profile: applyModifier(malt.profile, TERROIRS[state.terroir].water),
    elapsed: efficiency,
    duration: mashing.days * HOURS_PER_DAY,
  };
  consumeOrder(machine);
  events.push({ type: 'batchStarted', hour, roomId: machine.roomId });
}

function runMalting(
  state: GameState,
  machine: MaltingMachine,
  efficiency: number,
  events: SimEvent[],
): void {
  const hour = state.time.hour;
  const { malting } = PRODUCTION;
  if (machine.batch) {
    machine.batch.elapsed += efficiency;
    if (!isDone(machine.batch)) return;
    const tonnes = Math.round(machine.batch.amount * malting.maltPerBarley * 1000) / 1000;
    addToLot(state.stocks.malt, tonnes, machine.batch.profile);
    machine.batch = null;
    events.push({ type: 'malted', hour, roomId: machine.roomId, tonnes });
    return;
  }
  if (!hasOrders(machine.orders) || state.stocks.barley.amount < malting.minTonnes) return;
  const barley = takeFromLot(state.stocks.barley, malting.batchTonnes);
  const peat = malting.peat[machine.peat];
  const peatCost = roundMoney(
    peat.costPerTonne * barley.amount * TERROIRS[state.terroir].peatCostFactor,
  );
  if (peatCost > 0) recordTransaction(state, -peatCost, 'materials', { product: 'peat' });
  machine.batch = {
    amount: barley.amount,
    profile: applyModifier(barley.profile, { peaty: peat.peaty }),
    elapsed: efficiency,
    duration: malting.days * HOURS_PER_DAY,
  };
  consumeOrder(machine);
  events.push({ type: 'batchStarted', hour, roomId: machine.roomId });
}

function runGin(
  state: GameState,
  machine: GinMachine,
  efficiency: number,
  events: SimEvent[],
): void {
  const hour = state.time.hour;
  if (machine.batch) {
    machine.batch.elapsed += efficiency;
    if (!isDone(machine.batch)) return;
    state.stocks.gin += machine.batch.amount;
    events.push({
      type: 'ginBottled',
      hour,
      roomId: machine.roomId,
      bottles: machine.batch.amount,
    });
    machine.batch = null;
    return;
  }
  const lpa = GIN.batchBottles * GIN.lpaPerBottle;
  if (!hasOrders(machine.orders) || state.stocks.newMake.amount < lpa) return;
  const spirit = takeFromLot(state.stocks.newMake, lpa);
  recordTransaction(state, -roundMoney(GIN.batchBottles * GIN.botanicalsPerBottle), 'materials', {
    product: 'botanicals',
  });
  machine.batch = {
    amount: GIN.batchBottles,
    profile: spirit.profile,
    elapsed: efficiency,
    duration: GIN.days * HOURS_PER_DAY,
  };
  consumeOrder(machine);
  events.push({ type: 'batchStarted', hour, roomId: machine.roomId });
}

/** La chaîne remplit, bouche et étiquette ; le lot fini rejoint le stock de bouteilles. */
function runBottling(
  state: GameState,
  machine: BottlingMachine,
  efficiency: number,
  events: SimEvent[],
): void {
  if (!machine.batch || !machine.run) return;
  machine.batch.elapsed += efficiency;
  if (!isDone(machine.batch)) return;
  const bottling = { ...machine.run, bottledHour: state.time.hour };
  state.bottlings.push(bottling);
  machine.batch = null;
  machine.run = null;
  events.push({
    type: 'bottled',
    hour: state.time.hour,
    bottlingId: bottling.id,
    bottles: bottling.bottled,
  });
}

/**
 * La machine a-t-elle du travail cette heure ? Un lot en cours, ou de quoi en
 * lancer un. Le moût qui attend une cuve libre et les cuves qui fermentent n'ont
 * besoin de personne.
 */
export function needsOperator(state: GameState, machine: Machine): boolean {
  switch (machine.kind) {
    case 'fermentation':
      return false;
    case 'mashing':
      if (machine.batch) return !isDone(machine.batch);
      return hasOrders(machine.orders) && state.stocks.malt.amount >= PRODUCTION.mashing.minTonnes;
    case 'malting':
      if (machine.batch) return true;
      return (
        hasOrders(machine.orders) && state.stocks.barley.amount >= PRODUCTION.malting.minTonnes
      );
    case 'distillation':
      if (machine.batch) return true;
      return (
        stillsCapacity(machine) > 0 &&
        hasOrders(machine.orders) &&
        readyVessel(state, workingRooms(state.building)) !== null
      );
    case 'bottling':
      return machine.batch !== null;
    case 'gin':
      if (machine.batch) return true;
      return (
        hasOrders(machine.orders) &&
        state.stocks.newMake.amount >= GIN.batchBottles * GIN.lpaPerBottle
      );
  }
}

/** Qui tient une machine : son rôle et son niveau comptent pour les alambics. */
export interface Operator {
  role: StaffRole;
  level: number;
  /** Vitesse de travail (compétence et moral). */
  efficiency: number;
}

/**
 * Une heure de production, de l'aval vers l'amont pour libérer la place au plus
 * tôt : alambics, cuves, brasserie, malterie. Seules les salles en état tournent ;
 * une salle fusionnée travaille plus vite (son efficacité). Une machine qui a du
 * travail ne tourne que si quelqu'un la tient (voir `assignStaff`).
 */
export function runProduction(
  state: GameState,
  operators: ReadonlyMap<number, Operator>,
): SimEvent[] {
  const events: SimEvent[] = [];
  const active = workingRooms(state.building);
  const order: Machine['kind'][] = [
    'bottling',
    'gin',
    'distillation',
    'fermentation',
    'mashing',
    'malting',
  ];
  for (const kind of order) {
    for (const machine of state.machines) {
      if (machine.kind !== kind) continue;
      const room = active.get(machine.roomId);
      if (room === undefined) continue;
      const operator = operators.get(machine.roomId);
      if (!operator && needsOperator(state, machine)) continue;
      const efficiency = room * (operator?.efficiency ?? 1);
      switch (machine.kind) {
        case 'distillation':
          runStills(state, machine, efficiency, events, operator);
          break;
        case 'fermentation':
          runFermentation(machine, efficiency);
          break;
        case 'mashing':
          runMashing(state, machine, efficiency, events);
          break;
        case 'malting':
          runMalting(state, machine, efficiency, events);
          break;
        case 'gin':
          runGin(state, machine, efficiency, events);
          break;
        case 'bottling':
          runBottling(state, machine, efficiency, events);
          break;
      }
    }
  }
  return events;
}
