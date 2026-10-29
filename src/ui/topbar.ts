import { formatMoney, formatNumber, t } from '../i18n';
import type { GameState } from '../sim/state';
import { toGameDate } from '../sim/time';

const SECRET_TAPS = 5;
const SECRET_WINDOW_MS = 2_000;

export interface TopBar {
  element: HTMLElement;
  update(state: GameState): void;
}

export function formatDate(hour: number): { date: string; detail: string } {
  const d = toGameDate(hour);
  const day = d.day === 1 ? t('date.dayFirst') : String(d.day);
  const month = t(`month.${d.month}` as Parameters<typeof t>[0]);
  return {
    date: t('date.full', { day, month, year: d.year }),
    detail: `${t(`season.${d.season}`)} · ${t('date.hour', { hour: d.hour })}`,
  };
}

/**
 * Barre du haut : trésorerie, renommée, date et saison.
 * Cinq taps rapides sur la date ouvrent le panneau de debug (geste caché).
 */
export function createTopBar(onSecretGesture: () => void): TopBar {
  const element = document.createElement('header');
  element.className = 'topbar';
  element.innerHTML = `
    <div class="stat stat-cash">
      <span class="stat-label"></span>
      <span class="stat-value"></span>
    </div>
    <div class="stat stat-renown">
      <span class="stat-label"></span>
      <span class="stat-value"></span>
    </div>
    <div class="stat stat-date">
      <span class="stat-value"></span>
      <span class="stat-label"></span>
    </div>`;
  const [cashLabel, cashValue] = element.querySelectorAll<HTMLElement>('.stat-cash span');
  const [renownLabel, renownValue] = element.querySelectorAll<HTMLElement>('.stat-renown span');
  const [dateValue, dateDetail] = element.querySelectorAll<HTMLElement>('.stat-date span');
  cashLabel!.textContent = t('topbar.cash');
  renownLabel!.textContent = t('topbar.renown');

  let taps: number[] = [];
  element.querySelector('.stat-date')!.addEventListener('click', (event) => {
    const now = event.timeStamp;
    taps = [...taps.filter((time) => now - time < SECRET_WINDOW_MS), now];
    if (taps.length >= SECRET_TAPS) {
      taps = [];
      onSecretGesture();
    }
  });

  let last = '';
  return {
    element,
    update(state) {
      const { date, detail } = formatDate(state.time.hour);
      const key = `${state.cash}|${state.renown}|${date}|${detail}`;
      if (key === last) return;
      last = key;
      cashValue!.textContent = formatMoney(state.cash);
      renownValue!.textContent = formatNumber(state.renown);
      dateValue!.textContent = date;
      dateDetail!.textContent = detail;
    },
  };
}
