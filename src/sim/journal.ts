import { FINANCE } from '../data/balance';
import type { GameState } from './state';
import { monthIndex } from './time';

export type IncomeCategory = 'sales' | 'tickets' | 'cafe' | 'prizes' | 'loanProceeds' | 'debug';
export type ExpenseCategory =
  | 'salaries'
  | 'maintenance'
  | 'energy'
  | 'excise'
  | 'materials'
  | 'loanInterest'
  | 'loanPrincipal'
  | 'investment'
  | 'recruitment'
  | 'training';
export type Category = IncomeCategory | ExpenseCategory;

export type Channel = 'shop' | 'retail' | 'export' | 'bulk';

/** Une ligne du journal : entrée (montant positif) ou sortie (négatif). */
export interface Transaction {
  hour: number;
  amount: number;
  category: Category;
  product?: string;
  channel?: Channel;
}

/** Totaux d'un mois ancien, par catégorie. */
export interface MonthTotals {
  month: number;
  totals: Partial<Record<Category, number>>;
}

export interface Journal {
  /** Transactions détaillées des derniers mois, de la plus ancienne à la plus récente. */
  entries: Transaction[];
  /** Mois plus anciens, regroupés par catégorie. */
  monthly: MonthTotals[];
}

/** Arrondi au penny. */
export const roundMoney = (amount: number): number => Math.round(amount * 100) / 100;

/** Encaisse ou débourse un montant et l'inscrit au journal. */
export function recordTransaction(
  state: GameState,
  amount: number,
  category: Category,
  details: Pick<Transaction, 'product' | 'channel'> = {},
): Transaction {
  const transaction: Transaction = {
    hour: state.time.hour,
    amount: roundMoney(amount),
    category,
    ...details,
  };
  state.finance.cash = roundMoney(state.finance.cash + transaction.amount);
  state.journal.entries.push(transaction);
  return transaction;
}

/** Regroupe par mois et catégorie les transactions plus vieilles que la fenêtre détaillée. */
export function compactJournal(state: GameState): void {
  const oldest = monthIndex(state.time.hour) - FINANCE.journalDetailMonths;
  const { journal } = state;
  let cut = 0;
  while (
    cut < journal.entries.length &&
    monthIndex((journal.entries[cut] as Transaction).hour) < oldest
  ) {
    const entry = journal.entries[cut] as Transaction;
    const month = monthIndex(entry.hour);
    let bucket = journal.monthly.at(-1);
    if (!bucket || bucket.month !== month) {
      bucket = { month, totals: {} };
      journal.monthly.push(bucket);
    }
    bucket.totals[entry.category] = roundMoney((bucket.totals[entry.category] ?? 0) + entry.amount);
    cut++;
  }
  if (cut > 0) journal.entries.splice(0, cut);
}

/** Totaux par catégorie des transactions détaillées depuis une heure donnée (incluse). */
export function totalsSince(state: GameState, fromHour: number): Partial<Record<Category, number>> {
  const totals: Partial<Record<Category, number>> = {};
  for (const entry of state.journal.entries) {
    if (entry.hour < fromHour) continue;
    totals[entry.category] = roundMoney((totals[entry.category] ?? 0) + entry.amount);
  }
  return totals;
}
