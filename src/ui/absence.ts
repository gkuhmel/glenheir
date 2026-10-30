import { TIME } from '../data/balance';
import { formatDuration, formatSignedMoney, t, type MessageKey } from '../i18n';
import type { AbsenceSummary } from '../sim/summary';
import { describeEvent } from './event-text';
import { TRIQUETRA } from './icons';

const row = (label: string, amount: number, className = '') => {
  const tr = document.createElement('tr');
  tr.className = className;
  const name = document.createElement('td');
  name.textContent = label;
  const value = document.createElement('td');
  value.textContent = formatSignedMoney(amount);
  value.className = amount < 0 ? 'amount negative' : 'amount positive';
  tr.append(name, value);
  return tr;
};

/** Écran « Pendant ton absence » : temps écoulé, argent entré et sorti, faits marquants. */
export function showAbsence(summary: AbsenceSummary): void {
  document.querySelector('.absence')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'absence';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="absence-card">
      <div class="absence-header">${TRIQUETRA}<h2></h2></div>
      <div class="drawer-rule" aria-hidden="true"></div>
      <p class="absence-elapsed"></p>
      <table class="ledger"></table>
      <ul class="absence-events"></ul>
      <button type="button" class="parchment-button"></button>
    </div>`;
  overlay.querySelector('h2')!.textContent = t('absence.title');
  overlay.querySelector('.absence-elapsed')!.textContent = t('absence.elapsed', {
    duration: formatDuration(summary.hours, TIME.hoursPerDay),
  });

  const table = overlay.querySelector('table')!;
  const categories = Object.entries(summary.byCategory).filter(([, amount]) => amount !== 0);
  if (categories.length === 0) {
    const empty = document.createElement('caption');
    empty.textContent = t('absence.quiet');
    table.append(empty);
  } else {
    // Entrées d'abord, puis les montants les plus importants.
    const order = (a: [string, number], b: [string, number]) =>
      Number(b[1] > 0) - Number(a[1] > 0) || Math.abs(b[1]) - Math.abs(a[1]);
    for (const [category, amount] of categories.sort(order)) {
      table.append(row(t(`category.${category}` as MessageKey), amount));
    }
    table.append(row(t('absence.balance'), summary.income + summary.expenses, 'total'));
  }

  const { produced } = summary;
  const items = [
    produced.barley > 0 ? t('absence.producedBarley', { amount: produced.barley }) : '',
    produced.malt > 0 ? t('absence.producedMalt', { amount: produced.malt }) : '',
    produced.newMake > 0 ? t('absence.producedNewMake', { amount: produced.newMake }) : '',
    produced.gin > 0 ? t('absence.producedGin', { amount: produced.gin }) : '',
  ].filter(Boolean);
  if (items.length > 0) {
    const line = document.createElement('p');
    line.className = 'absence-produced';
    line.textContent = t('absence.produced', { items: items.join(', ') });
    table.after(line);
  }

  const list = overlay.querySelector('ul')!;
  for (const event of summary.notable) {
    const text = describeEvent(event);
    if (!text) continue;
    const li = document.createElement('li');
    li.textContent = text;
    if (event.type === 'bankruptcyWarning' || event.type === 'bankrupt') li.className = 'warning';
    list.append(li);
  }

  const button = overlay.querySelector('button')!;
  button.textContent = t('absence.continue');
  button.addEventListener('click', () => overlay.remove());
  document.getElementById('ui')?.append(overlay);
  button.focus();
}
