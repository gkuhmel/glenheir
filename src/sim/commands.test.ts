import { describe, expect, it } from 'vitest';
import { DEBUG } from '../data/balance';
import { executeCommand, loanCapacity } from './commands';
import { createInitialState } from './state';

describe('commandes', () => {
  it('accorde un prêt et l’inscrit au journal', () => {
    const state = createInitialState(1);
    const result = executeCommand(state, { type: 'takeLoan', amount: 40_000 });
    expect(result.ok).toBe(true);
    expect(state.finance.cash).toBe(90_000);
    expect(state.finance.loans).toHaveLength(1);
    expect(state.journal.entries.at(-1)).toMatchObject({
      amount: 40_000,
      category: 'loanProceeds',
    });
    expect(loanCapacity(state)).toBe(60_000);
  });

  it('refuse de dépasser le plafond de £100 000', () => {
    const state = createInitialState(1);
    executeCommand(state, { type: 'takeLoan', amount: 80_000 });
    expect(executeCommand(state, { type: 'takeLoan', amount: 30_000 })).toEqual({
      ok: false,
      error: 'loanLimitReached',
    });
  });

  it('refuse un montant invalide', () => {
    const state = createInitialState(1);
    for (const amount of [0, -5, 500, Number.NaN]) {
      expect(executeCommand(state, { type: 'takeLoan', amount })).toEqual({
        ok: false,
        error: 'loanAmountInvalid',
      });
    }
  });

  it('rembourse un prêt par anticipation et recalcule la mensualité', () => {
    const state = createInitialState(1);
    executeCommand(state, { type: 'takeLoan', amount: 50_000 });
    const loan = state.finance.loans[0]!;
    const before = loan.monthlyPayment;
    executeCommand(state, { type: 'repayLoan', loanId: loan.id, amount: 25_000 });
    expect(loan.principal).toBe(25_000);
    expect(loan.monthlyPayment).toBeCloseTo(before / 2, 1);
    const full = executeCommand(state, { type: 'repayLoan', loanId: loan.id });
    expect(full.ok && full.events).toEqual([{ type: 'loanRepaid', hour: 0, loanId: loan.id }]);
    expect(state.finance.loans).toEqual([]);
    expect(state.finance.cash).toBe(50_000);
  });

  it('refuse un remboursement sans trésorerie suffisante', () => {
    const state = createInitialState(1);
    executeCommand(state, { type: 'takeLoan', amount: 50_000 });
    state.finance.cash = 100;
    const loanId = state.finance.loans[0]!.id;
    expect(executeCommand(state, { type: 'repayLoan', loanId })).toEqual({
      ok: false,
      error: 'notEnoughCash',
    });
    expect(executeCommand(state, { type: 'repayLoan', loanId: 999 })).toEqual({
      ok: false,
      error: 'loanNotFound',
    });
  });

  it('ajoute de l’argent en debug', () => {
    const state = createInitialState(1);
    executeCommand(state, { type: 'debugAddCash' });
    expect(state.finance.cash).toBe(50_000 + DEBUG.cashGift);
  });

  it('refuse toute action après la faillite', () => {
    const state = createInitialState(1);
    state.finance.bankrupt = true;
    expect(executeCommand(state, { type: 'takeLoan', amount: 10_000 })).toEqual({
      ok: false,
      error: 'bankrupt',
    });
  });
});
