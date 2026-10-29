import { EXCISE, FINANCE, SALARIES } from '../../data/balance';
import { compactJournal, recordTransaction, roundMoney, type Channel } from '../journal';
import type { Employee, GameState } from '../state';
import type { SimEvent } from '../tick';

const MONTHLY_RATE = FINANCE.loan.annualRate / 12;

/** Mensualité constante d'un emprunt (capital + intérêts). */
export function annuityPayment(principal: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return roundMoney(principal / months);
  return roundMoney((principal * monthlyRate) / (1 - (1 + monthlyRate) ** -months));
}

export function loanPayment(principal: number, months: number = FINANCE.loan.termMonths): number {
  return annuityPayment(principal, MONTHLY_RATE, months);
}

export function salaryOf(employee: Employee): number {
  const scale = SALARIES[employee.role];
  return scale[Math.min(scale.length, Math.max(1, employee.level)) - 1] as number;
}

export function monthlyPayroll(state: GameState): number {
  return state.staff.reduce((sum, employee) => sum + salaryOf(employee), 0);
}

export function outstandingDebt(state: GameState): number {
  return roundMoney(state.finance.loans.reduce((sum, loan) => sum + loan.principal, 0));
}

/** Droits d'accise dus pour une vente : seules les ventes au Royaume-Uni sont taxées. */
export function exciseFor(channel: Channel, bottles: number): number {
  return channel === 'shop' || channel === 'retail' ? roundMoney(bottles * EXCISE.perUkBottle) : 0;
}

/** Échéance de chaque prêt : intérêts du mois, puis capital. */
function payLoans(state: GameState, events: SimEvent[]): void {
  const remaining = [];
  for (const loan of state.finance.loans) {
    const interest = roundMoney(loan.principal * MONTHLY_RATE);
    // La dernière mensualité solde le capital restant (arrondis compris).
    const capital =
      loan.monthsLeft <= 1
        ? loan.principal
        : roundMoney(Math.min(loan.principal, loan.monthlyPayment - interest));
    recordTransaction(state, -interest, 'loanInterest');
    recordTransaction(state, -capital, 'loanPrincipal');
    loan.principal = roundMoney(loan.principal - capital);
    loan.monthsLeft -= 1;
    events.push({
      type: 'loanPaid',
      hour: state.time.hour,
      loanId: loan.id,
      amount: roundMoney(interest + capital),
    });
    if (loan.principal <= 0 || loan.monthsLeft <= 0) {
      events.push({ type: 'loanRepaid', hour: state.time.hour, loanId: loan.id });
    } else {
      remaining.push(loan);
    }
  }
  state.finance.loans = remaining;
}

/** Faillite : trois débuts de mois de suite en négatif, avec un avertissement au premier. */
function checkBankruptcy(state: GameState, events: SimEvent[]): void {
  const { finance } = state;
  if (finance.bankrupt) return;
  finance.negativeMonths = finance.cash < 0 ? finance.negativeMonths + 1 : 0;
  const hour = state.time.hour;
  if (finance.negativeMonths >= FINANCE.bankruptcy.defeatMonths) {
    finance.bankrupt = true;
    events.push({ type: 'bankrupt', hour });
  } else if (finance.negativeMonths >= FINANCE.bankruptcy.warningMonths) {
    events.push({
      type: 'bankruptcyWarning',
      hour,
      monthsLeft: FINANCE.bankruptcy.defeatMonths - finance.negativeMonths,
    });
  }
}

/** Échéances du 1er du mois : salaires, prêts, contrôle de faillite, archivage du journal. */
export function runMonthlyFinance(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const payroll = monthlyPayroll(state);
  if (payroll > 0) {
    recordTransaction(state, -payroll, 'salaries');
    events.push({ type: 'salariesPaid', hour: state.time.hour, amount: payroll });
  }
  payLoans(state, events);
  checkBankruptcy(state, events);
  compactJournal(state);
  return events;
}
