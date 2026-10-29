import { DEBUG, FINANCE, PRODUCTION, WAREHOUSE } from '../data/balance';
import type { RoomType } from '../data/content';
import { recordTransaction, roundMoney } from './journal';
import { addToLot, baseProfile, takeFromLot } from './profile';
import { createRng } from './rng';
import type { GameState, Terroir } from './state';
import { canSowAt, harvest, isRipe, seedCost, sow, type BarleyVariety } from './systems/fields';
import { barleyPrice, newMakeValue } from './systems/market';
import {
  syncMachines,
  type Cut,
  type Machine,
  type Orders,
  type PeatLevel,
} from './systems/production';
import { buildCost, isPurchasable, restoreCost, slotCost } from './systems/building';
import { loanPayment, outstandingDebt } from './systems/finance';
import type { SimEvent } from './tick';

/** Actions du joueur. L'interface n'écrit jamais directement dans l'état. */
export type Command =
  | { type: 'takeLoan'; amount: number }
  | { type: 'repayLoan'; loanId: number; amount?: number }
  | { type: 'restoreRoom'; roomId: number }
  | { type: 'buySlot'; col: number; level: number }
  | { type: 'buildRoom'; roomId: number; roomType: RoomType }
  | { type: 'restoreWarehouse'; warehouseId: number }
  | { type: 'chooseTerroir'; terroir: Terroir }
  | { type: 'sowField'; fieldId: number; variety: BarleyVariety }
  | { type: 'harvestField'; fieldId: number }
  | { type: 'buyBarley'; tonnes: number }
  | { type: 'sellNewMake'; lpa: number }
  | { type: 'setOrders'; roomId: number; orders: Orders }
  | { type: 'setPeat'; roomId: number; peat: PeatLevel }
  | { type: 'setLongFermentation'; roomId: number; long: boolean }
  | { type: 'setCut'; roomId: number; cut: Cut }
  | { type: 'restoreStills'; roomId: number }
  | { type: 'buyStills'; roomId: number }
  | { type: 'debugAddCash' };

/** Raison d'un refus, traduite par l'interface (clé `error.<code>`). */
export type CommandError =
  | 'bankrupt'
  | 'loanAmountInvalid'
  | 'loanLimitReached'
  | 'loanNotFound'
  | 'notEnoughCash'
  | 'roomNotFound'
  | 'roomNotRuined'
  | 'slotNotPurchasable'
  | 'slotNotEmpty'
  | 'warehouseNotFound'
  | 'warehouseNotRuined'
  | 'terroirAlreadyChosen'
  | 'fieldNotFound'
  | 'fieldBusy'
  | 'notSowingSeason'
  | 'notRipe'
  | 'amountInvalid'
  | 'notEnoughStock'
  | 'machineNotFound'
  | 'stillsNotRuined'
  | 'stillsPresent'
  | 'roomRuined';

export type CommandResult = { ok: true; events: SimEvent[] } | { ok: false; error: CommandError };

const fail = (error: CommandError): CommandResult => ({ ok: false, error });

/** Montant encore empruntable sous le plafond d'encours. */
export function loanCapacity(state: GameState): number {
  return Math.max(0, roundMoney(FINANCE.loan.maxOutstanding - outstandingDebt(state)));
}

function takeLoan(state: GameState, amount: number): CommandResult {
  if (!Number.isFinite(amount) || amount < FINANCE.loan.minAmount) return fail('loanAmountInvalid');
  if (amount > loanCapacity(state)) return fail('loanLimitReached');
  const id = state.nextId++;
  const principal = roundMoney(amount);
  state.finance.loans.push({
    id,
    principal,
    monthlyPayment: loanPayment(principal),
    monthsLeft: FINANCE.loan.termMonths,
  });
  recordTransaction(state, principal, 'loanProceeds');
  return {
    ok: true,
    events: [{ type: 'loanTaken', hour: state.time.hour, loanId: id, amount: principal }],
  };
}

/** Remboursement anticipé, sans pénalité ; la mensualité est recalculée sur la durée restante. */
function repayLoan(state: GameState, loanId: number, requested?: number): CommandResult {
  const loan = state.finance.loans.find((l) => l.id === loanId);
  if (!loan) return fail('loanNotFound');
  const amount = roundMoney(Math.min(requested ?? loan.principal, loan.principal));
  if (!Number.isFinite(amount) || amount <= 0) return fail('loanAmountInvalid');
  if (amount > state.finance.cash) return fail('notEnoughCash');
  recordTransaction(state, -amount, 'loanPrincipal');
  loan.principal = roundMoney(loan.principal - amount);
  if (loan.principal <= 0) {
    state.finance.loans = state.finance.loans.filter((l) => l.id !== loanId);
    return { ok: true, events: [{ type: 'loanRepaid', hour: state.time.hour, loanId }] };
  }
  loan.monthlyPayment = loanPayment(loan.principal, loan.monthsLeft);
  return { ok: true, events: [] };
}

/** Paie une dépense s'il y a assez de trésorerie. */
function invest(
  state: GameState,
  cost: number,
  category: 'investment' | 'materials' = 'investment',
): boolean {
  if (cost > state.finance.cash) return false;
  if (cost > 0) recordTransaction(state, -cost, category);
  return true;
}

function restoreRoom(state: GameState, roomId: number): CommandResult {
  const room = state.building.rooms.find((r) => r.id === roomId);
  if (!room || !room.type) return fail('roomNotFound');
  if (!room.ruined) return fail('roomNotRuined');
  if (!invest(state, restoreCost(room.type))) return fail('notEnoughCash');
  room.ruined = false;
  return { ok: true, events: [{ type: 'roomRestored', hour: state.time.hour, roomId }] };
}

function buySlot(state: GameState, col: number, level: number): CommandResult {
  const { building } = state;
  if (!isPurchasable(building, { col, level })) return fail('slotNotPurchasable');
  if (!invest(state, slotCost(building))) return fail('notEnoughCash');
  const roomId = state.nextId++;
  building.rooms.push({ id: roomId, col, level, type: null, ruined: false });
  building.slotsPurchased += 1;
  return { ok: true, events: [{ type: 'slotPurchased', hour: state.time.hour, roomId }] };
}

function buildRoom(state: GameState, roomId: number, roomType: RoomType): CommandResult {
  const room = state.building.rooms.find((r) => r.id === roomId);
  if (!room) return fail('roomNotFound');
  if (room.type !== null) return fail('slotNotEmpty');
  if (!invest(state, buildCost(roomType))) return fail('notEnoughCash');
  room.type = roomType;
  syncMachines(state);
  return { ok: true, events: [{ type: 'roomBuilt', hour: state.time.hour, roomId, roomType }] };
}

function restoreWarehouse(state: GameState, warehouseId: number): CommandResult {
  const warehouse = state.warehouses.find((w) => w.id === warehouseId);
  if (!warehouse) return fail('warehouseNotFound');
  if (!warehouse.ruined) return fail('warehouseNotRuined');
  if (!invest(state, WAREHOUSE.restoreCost)) return fail('notEnoughCash');
  warehouse.ruined = false;
  return { ok: true, events: [{ type: 'warehouseRestored', hour: state.time.hour, warehouseId }] };
}

const ok = (state: GameState, events: SimEvent[] = []): CommandResult => ({ ok: true, events });

function sowField(state: GameState, fieldId: number, variety: BarleyVariety): CommandResult {
  const field = state.fields.find((f) => f.id === fieldId);
  if (!field) return fail('fieldNotFound');
  if (field.crop) return fail('fieldBusy');
  if (!canSowAt(state.time.hour)) return fail('notSowingSeason');
  if (!invest(state, seedCost(variety), 'materials')) return fail('notEnoughCash');
  sow(state, field, variety);
  return ok(state, [{ type: 'sown', hour: state.time.hour, fieldId }]);
}

function harvestField(state: GameState, fieldId: number): CommandResult {
  const field = state.fields.find((f) => f.id === fieldId);
  if (!field) return fail('fieldNotFound');
  if (!field.crop || !isRipe(field.crop, state.time.hour)) return fail('notRipe');
  // La météo de l'année est tirée avec le générateur de la partie.
  const rng = createRng(state.rngState);
  const tonnes = harvest(state, field, rng);
  state.rngState = rng.state;
  return ok(state, [{ type: 'harvested', hour: state.time.hour, fieldId, tonnes }]);
}

function buyBarley(state: GameState, tonnes: number): CommandResult {
  if (!Number.isFinite(tonnes) || tonnes <= 0) return fail('amountInvalid');
  const cost = roundMoney(tonnes * barleyPrice(state.time.hour));
  if (!invest(state, cost, 'materials')) return fail('notEnoughCash');
  // Orge du marché : profil de base, sans bonus de variété.
  addToLot(state.stocks.barley, tonnes, baseProfile());
  return ok(state, [{ type: 'traded', hour: state.time.hour }]);
}

function sellNewMake(state: GameState, lpa: number): CommandResult {
  if (!Number.isFinite(lpa) || lpa <= 0) return fail('amountInvalid');
  if (lpa > state.stocks.newMake.amount + 1e-6) return fail('notEnoughStock');
  const sold = takeFromLot(state.stocks.newMake, lpa);
  recordTransaction(state, newMakeValue(sold.amount), 'sales', {
    product: 'newMake',
    channel: 'bulk',
  });
  return ok(state, [{ type: 'traded', hour: state.time.hour }]);
}

function withMachine<K extends Machine['kind']>(
  state: GameState,
  roomId: number,
  kinds: readonly K[],
  apply: (machine: Extract<Machine, { kind: K }>) => CommandResult,
): CommandResult {
  const machine = state.machines.find((m) => m.roomId === roomId);
  if (!machine || !(kinds as readonly string[]).includes(machine.kind))
    return fail('machineNotFound');
  return apply(machine as Extract<Machine, { kind: K }>);
}

const changed = (state: GameState, roomId: number): CommandResult =>
  ok(state, [{ type: 'machineChanged', hour: state.time.hour, roomId }]);

function restoreStills(state: GameState, roomId: number): CommandResult {
  return withMachine(state, roomId, ['distillation'] as const, (machine) => {
    if (machine.stills !== 'ruined') return fail('stillsNotRuined');
    const room = state.building.rooms.find((r) => r.id === roomId);
    if (room?.ruined) return fail('roomRuined');
    if (!invest(state, PRODUCTION.distillation.restoreOldStillsCost)) return fail('notEnoughCash');
    machine.stills = 'small';
    return ok(state, [{ type: 'stillsReady', hour: state.time.hour, roomId }]);
  });
}

function buyStills(state: GameState, roomId: number): CommandResult {
  return withMachine(state, roomId, ['distillation'] as const, (machine) => {
    if (machine.stills !== 'none') return fail('stillsPresent');
    if (!invest(state, PRODUCTION.distillation.stills.small.cost)) return fail('notEnoughCash');
    machine.stills = 'small';
    return ok(state, [{ type: 'stillsReady', hour: state.time.hour, roomId }]);
  });
}

/** Valide puis applique une commande du joueur. */
export function executeCommand(state: GameState, command: Command): CommandResult {
  if (state.finance.bankrupt) return fail('bankrupt');
  switch (command.type) {
    case 'takeLoan':
      return takeLoan(state, command.amount);
    case 'repayLoan':
      return repayLoan(state, command.loanId, command.amount);
    case 'restoreRoom':
      return restoreRoom(state, command.roomId);
    case 'buySlot':
      return buySlot(state, command.col, command.level);
    case 'buildRoom':
      return buildRoom(state, command.roomId, command.roomType);
    case 'restoreWarehouse':
      return restoreWarehouse(state, command.warehouseId);
    case 'chooseTerroir':
      if (state.terroirChosen) return fail('terroirAlreadyChosen');
      state.terroir = command.terroir;
      state.terroirChosen = true;
      return ok(state, [{ type: 'terroirChosen', hour: state.time.hour }]);
    case 'sowField':
      return sowField(state, command.fieldId, command.variety);
    case 'harvestField':
      return harvestField(state, command.fieldId);
    case 'buyBarley':
      return buyBarley(state, command.tonnes);
    case 'sellNewMake':
      return sellNewMake(state, command.lpa);
    case 'setOrders': {
      const orders = command.orders;
      if (orders !== 'continuous' && (!Number.isInteger(orders) || orders < 0))
        return fail('amountInvalid');
      return withMachine(
        state,
        command.roomId,
        ['malting', 'mashing', 'distillation'] as const,
        (m) => {
          m.orders = orders;
          return changed(state, command.roomId);
        },
      );
    }
    case 'setPeat':
      return withMachine(state, command.roomId, ['malting'] as const, (m) => {
        m.peat = command.peat;
        return changed(state, command.roomId);
      });
    case 'setLongFermentation':
      return withMachine(state, command.roomId, ['fermentation'] as const, (m) => {
        m.long = command.long;
        return changed(state, command.roomId);
      });
    case 'setCut':
      return withMachine(state, command.roomId, ['distillation'] as const, (m) => {
        m.cut = command.cut;
        return changed(state, command.roomId);
      });
    case 'restoreStills':
      return restoreStills(state, command.roomId);
    case 'buyStills':
      return buyStills(state, command.roomId);
    case 'debugAddCash':
      recordTransaction(state, DEBUG.cashGift, 'debug');
      return { ok: true, events: [] };
  }
}
