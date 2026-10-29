import { formatMoney, formatNumber, t } from '../i18n';
import type { GameState } from '../sim/state';
import { toGameDate, type Season } from '../sim/time';
import { COIN_ICON, SEASON_ICONS, THISTLE_ICON } from './icons';

const SECRET_TAPS = 5;
const SECRET_WINDOW_MS = 2_000;

export interface TopBar {
  element: HTMLElement;
  update(state: GameState): void;
}

export function formatDate(hour: number): { date: string; detail: string; season: Season } {
  const d = toGameDate(hour);
  const day = d.day === 1 ? t('date.dayFirst') : String(d.day);
  const month = t(`month.${d.month}` as Parameters<typeof t>[0]);
  return {
    date: t('date.full', { day, month }),
    detail: t('date.detail', { year: d.year, season: t(`season.${d.season}`), hour: d.hour }),
    season: d.season,
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
      ${COIN_ICON}
      <div class="stat-text"><span class="stat-label"></span><span class="stat-value"></span></div>
    </div>
    <div class="stat stat-renown">
      ${THISTLE_ICON}
      <div class="stat-text"><span class="stat-label"></span><span class="stat-value"></span></div>
    </div>
    <div class="stat stat-date">
      <div class="stat-text"><span class="stat-value"></span><span class="stat-label"></span></div>
      <span class="season-icon"></span>
    </div>`;
  const [cashLabel, cashValue] = element.querySelectorAll<HTMLElement>(
    '.stat-cash .stat-text span',
  );
  const [renownLabel, renownValue] = element.querySelectorAll<HTMLElement>(
    '.stat-renown .stat-text span',
  );
  const [dateValue, dateDetail] = element.querySelectorAll<HTMLElement>(
    '.stat-date .stat-text span',
  );
  const seasonIcon = element.querySelector<HTMLElement>('.season-icon')!;
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
      const { date, detail, season } = formatDate(state.time.hour);
      const key = `${state.cash}|${state.renown}|${date}|${detail}`;
      if (key === last) return;
      last = key;
      cashValue!.textContent = formatMoney(state.cash);
      renownValue!.textContent = formatNumber(state.renown);
      dateValue!.textContent = date;
      dateDetail!.textContent = detail;
      if (seasonIcon.dataset.season !== season) {
        seasonIcon.dataset.season = season;
        seasonIcon.innerHTML = SEASON_ICONS[season];
      }
    },
  };
}
