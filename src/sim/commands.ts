import { DEBUG, FINANCE, WAREHOUSE } from '../data/balance';
import type { RoomType } from '../data/content';
import { recordTransaction, roundMoney } from './journal';
import type { GameState } from './state';
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
  | 'warehouseNotRuined';

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

/** Paie un investissement s'il y a assez de trésorerie. */
function invest(state: GameState, cost: number): boolean {
  if (cost > state.finance.cash) return false;
  recordTransaction(state, -cost, 'investment');
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
    case 'debugAddCash':
      recordTransaction(state, DEBUG.cashGift, 'debug');
      return { ok: true, events: [] };
  }
}
