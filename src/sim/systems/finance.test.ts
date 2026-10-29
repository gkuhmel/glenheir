import { describe, expect, it } from 'vitest';
import { FINANCE } from '../../data/balance';
import { executeCommand } from '../commands';
import { createInitialState, type GameState } from '../state';
import { runTicks } from '../tick';
import { HOURS_PER_MONTH, monthIndex } from '../time';
import {
  annuityPayment,
  exciseFor,
  loanPayment,
  monthlyPayroll,
  outstandingDebt,
  salaryOf,
} from './finance';

/** Heures jusqu'au prochain 1er du mois à minuit, depuis le début de partie (1er mars, 8 h). */
const TO_FIRST_MONTH = HOURS_PER_MONTH - 8;

function advanceMonths(state: GameState, months: number) {
  const hours =
    state.time.hour === 0
      ? TO_FIRST_MONTH + (months - 1) * HOURS_PER_MONTH
      : months * HOURS_PER_MONTH;
  return runTicks(state, hours);
}

describe('prêts', () => {
  it('calcule une mensualité constante à 6 %/an sur 5 ans', () => {
    expect(loanPayment(100_000)).toBeCloseTo(1933.28, 2);
    expect(annuityPayment(1200, 0, 12)).toBe(100);
  });

  it('rembourse exactement le capital et les intérêts en 60 mensualités', () => {
    const state = createInitialState(1);
    state.staff = [];
    executeCommand(state, { type: 'takeLoan', amount: 100_000 });
    const events = advanceMonths(state, FINANCE.loan.termMonths);
    expect(state.finance.loans).toEqual([]);
    expect(events.filter((e) => e.type === 'loanPaid')).toHaveLength(60);
    expect(events.filter((e) => e.type === 'loanRepaid')).toHaveLength(1);
    // Coût total du crédit : environ 16 000 £ d'intérêts.
    const cost = 50_000 + 100_000 - state.finance.cash - 100_000;
    expect(cost).toBeGreaterThan(15_990);
    expect(cost).toBeLessThan(16_010);
  });

  it('additionne l’encours de plusieurs emprunts', () => {
    const state = createInitialState(1);
    executeCommand(state, { type: 'takeLoan', amount: 30_000 });
    executeCommand(state, { type: 'takeLoan', amount: 20_000 });
    expect(outstandingDebt(state)).toBe(50_000);
  });
});

describe('salaires', () => {
  it('suit la grille de chaque rôle', () => {
    expect(salaryOf({ id: 1, role: 'worker', level: 1 })).toBe(1_800);
    expect(salaryOf({ id: 1, role: 'cellarMaster', level: 5 })).toBe(6_500);
  });

  it('verse les salaires le 1er de chaque mois, pas au démarrage', () => {
    const state = createInitialState(1);
    runTicks(state, TO_FIRST_MONTH - 1);
    expect(state.finance.cash).toBe(50_000);
    const events = runTicks(state, 1);
    expect(events).toContainEqual({
      type: 'salariesPaid',
      hour: TO_FIRST_MONTH,
      amount: monthlyPayroll(state),
    });
    expect(state.finance.cash).toBe(50_000 - 1_800);
  });
});

describe('accise', () => {
  it('taxe les ventes au Royaume-Uni et exonère l’export et le vrac', () => {
    expect(exciseFor('shop', 10)).toBe(90);
    expect(exciseFor('retail', 1)).toBe(9);
    expect(exciseFor('export', 100)).toBe(0);
    expect(exciseFor('bulk', 100)).toBe(0);
  });
});

describe('faillite', () => {
  it('avertit au premier mois négatif puis déclare la faillite au troisième', () => {
    const state = createInitialState(1);
    state.finance.cash = 1_000;
    const first = advanceMonths(state, 1);
    expect(first).toContainEqual(
      expect.objectContaining({ type: 'bankruptcyWarning', monthsLeft: 2 }),
    );
    const second = advanceMonths(state, 1);
    expect(second).toContainEqual(
      expect.objectContaining({ type: 'bankruptcyWarning', monthsLeft: 1 }),
    );
    const third = advanceMonths(state, 1);
    expect(third).toContainEqual(expect.objectContaining({ type: 'bankrupt' }));
    expect(state.finance.bankrupt).toBe(true);
  });

  it('remet le compteur à zéro quand la trésorerie redevient positive', () => {
    const state = createInitialState(1);
    state.finance.cash = 1_000;
    advanceMonths(state, 1);
    expect(state.finance.negativeMonths).toBe(1);
    executeCommand(state, { type: 'takeLoan', amount: 10_000 });
    advanceMonths(state, 1);
    expect(state.finance.negativeMonths).toBe(0);
  });
});

describe('journal', () => {
  it('ne garde le détail que des 24 derniers mois', () => {
    const state = createInitialState(1);
    advanceMonths(state, 36);
    const current = monthIndex(state.time.hour);
    const oldestDetailed = monthIndex(state.journal.entries[0]!.hour);
    expect(current - oldestDetailed).toBeLessThanOrEqual(FINANCE.journalDetailMonths);
    expect(state.journal.monthly.length).toBeGreaterThan(0);
    // Rien ne se perd : détail + archives = total des salaires versés.
    const detailed = state.journal.entries.reduce((sum, e) => sum + e.amount, 0);
    const archived = state.journal.monthly.reduce((sum, m) => sum + (m.totals.salaries ?? 0), 0);
    expect(detailed + archived).toBe(-36 * 1_800);
  });
});
