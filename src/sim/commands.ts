import { DEBUG, FINANCE } from '../data/balance';
import { recordTransaction, roundMoney } from './journal';
import type { GameState } from './state';
import { loanPayment, outstandingDebt } from './systems/finance';
import type { SimEvent } from './tick';

/** Actions du joueur. L'interface n'écrit jamais directement dans l'état. */
export type Command =
  | { type: 'takeLoan'; amount: number }
  | { type: 'repayLoan'; loanId: number; amount?: number }
  | { type: 'debugAddCash' };

/** Raison d'un refus, traduite par l'interface (clé `error.<code>`). */
export type CommandError =
  'bankrupt' | 'loanAmountInvalid' | 'loanLimitReached' | 'loanNotFound' | 'notEnoughCash';

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

/** Valide puis applique une commande du joueur. */
export function executeCommand(state: GameState, command: Command): CommandResult {
  if (state.finance.bankrupt) return fail('bankrupt');
  switch (command.type) {
    case 'takeLoan':
      return takeLoan(state, command.amount);
    case 'repayLoan':
      return repayLoan(state, command.loanId, command.amount);
    case 'debugAddCash':
      recordTransaction(state, DEBUG.cashGift, 'debug');
      return { ok: true, events: [] };
  }
}
