import type { Game } from '../app/game';
import { FINANCE } from '../data/balance';
import { formatMoney, formatSignedMoney, t, type MessageKey } from '../i18n';
import { loanCapacity } from '../sim/commands';
import { monthlyPayroll } from '../sim/systems/finance';
import { formatDate } from './topbar';
import { showToast } from './toast';

const RECENT_TRANSACTIONS = 20;
const BORROW_STEPS = [10_000, 25_000, 50_000] as const;

export interface FinancePanel {
  element: HTMLElement;
  /** Met à jour l'affichage si l'état a changé. */
  render(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

/** Contenu du tiroir Finances : trésorerie, prêts et dernières opérations. */
export function createFinancePanel(game: Game): FinancePanel {
  const element = el('div', 'finance');
  let lastKey = '';

  const run = (command: Parameters<Game['execute']>[0], success: string) => {
    const result = game.execute(command);
    showToast(result.ok ? success : t(`error.${result.error}` as MessageKey));
    render();
  };

  function render() {
    const { finance, journal } = game.state;
    const key = `${finance.cash}|${journal.entries.length}|${finance.loans.map((l) => l.principal).join()}`;
    if (key === lastKey) return;
    lastKey = key;

    const summary = el('div', 'finance-summary');
    const cash = el('div', 'finance-cash');
    cash.append(
      el('span', 'finance-label', t('finance.cash')),
      el('strong', '', formatMoney(finance.cash)),
    );
    cash.classList.toggle('negative', finance.cash < 0);
    summary.append(
      cash,
      el(
        'p',
        'finance-note',
        t('finance.payroll', { amount: formatMoney(monthlyPayroll(game.state)) }),
      ),
    );

    const loans = el('section');
    loans.append(el('h3', '', t('finance.loans')));
    if (finance.loans.length === 0) loans.append(el('p', 'finance-note', t('finance.noLoan')));
    for (const loan of finance.loans) {
      const line = el('div', 'loan');
      line.append(
        el(
          'span',
          '',
          t('finance.loanLine', {
            principal: formatMoney(loan.principal),
            payment: formatMoney(loan.monthlyPayment),
            months: loan.monthsLeft,
          }),
        ),
      );
      const repay = el('button', 'parchment-button small', t('finance.repay'));
      repay.type = 'button';
      repay.addEventListener('click', () =>
        run({ type: 'repayLoan', loanId: loan.id }, t('finance.loanRepaid')),
      );
      line.append(repay);
      loans.append(line);
    }

    const capacity = loanCapacity(game.state);
    const borrow = el('section');
    borrow.append(el('h3', '', t('finance.borrow')));
    borrow.append(
      el('p', 'finance-note', t('finance.capacity', { amount: formatMoney(capacity) })),
    );
    const buttons = el('div', 'button-row');
    const steps = [...BORROW_STEPS.filter((s) => s < capacity), capacity].filter(
      (s) => s >= FINANCE.loan.minAmount,
    );
    for (const amount of steps) {
      const button = el(
        'button',
        'parchment-button small',
        t('finance.borrowAmount', { amount: formatMoney(amount) }),
      );
      button.type = 'button';
      button.addEventListener('click', () =>
        run({ type: 'takeLoan', amount }, t('finance.loanTaken', { amount: formatMoney(amount) })),
      );
      buttons.append(button);
    }
    borrow.append(buttons);

    const history = el('section');
    history.append(el('h3', '', t('finance.journal')));
    const recent = journal.entries.slice(-RECENT_TRANSACTIONS).reverse();
    if (recent.length === 0) history.append(el('p', 'finance-note', t('finance.empty')));
    const table = el('table', 'ledger');
    for (const entry of recent) {
      const tr = el('tr');
      const { date } = formatDate(entry.hour);
      tr.append(
        el('td', 'ledger-date', date),
        el('td', '', t(`category.${entry.category}` as MessageKey)),
        el(
          'td',
          entry.amount < 0 ? 'amount negative' : 'amount positive',
          formatSignedMoney(entry.amount),
        ),
      );
      table.append(tr);
    }
    history.append(table);

    element.replaceChildren(summary, loans, borrow, history);
  }

  return { element, render };
}
