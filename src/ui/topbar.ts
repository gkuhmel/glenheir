import { formatMoney, formatNumber, t } from '../i18n';
import type { GameState } from '../sim/state';
import { toGameDate, type Season } from '../sim/time';
import { COIN_ICON, SEASON_ICONS, THISTLE_ICON } from './icons';

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

const MENU_ICON =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>';

/** Barre du haut : trésorerie, renommée, date et saison, bouton Menu. */
export function createTopBar(onMenu: () => void, onCashTap: () => void): TopBar {
  const element = document.createElement('header');
  element.className = 'topbar';
  element.innerHTML = `
    <button type="button" class="stat stat-cash">
      ${COIN_ICON}
      <div class="stat-text"><span class="stat-label"></span><span class="stat-value"></span></div>
    </button>
    <div class="stat stat-renown">
      ${THISTLE_ICON}
      <div class="stat-text"><span class="stat-label"></span><span class="stat-value"></span></div>
    </div>
    <div class="stat stat-date">
      <div class="stat-text"><span class="stat-value"></span><span class="stat-detail"><span class="season-icon"></span><span class="stat-label"></span></span></div>
    </div>
    <button type="button" class="menu-button">${MENU_ICON}</button>`;
  const [cashLabel, cashValue] = element.querySelectorAll<HTMLElement>(
    '.stat-cash .stat-text span',
  );
  const [renownLabel, renownValue] = element.querySelectorAll<HTMLElement>(
    '.stat-renown .stat-text span',
  );
  const dateValue = element.querySelector<HTMLElement>('.stat-date .stat-value')!;
  const dateDetail = element.querySelector<HTMLElement>('.stat-date .stat-label')!;
  const menuButton = element.querySelector<HTMLButtonElement>('.menu-button')!;
  menuButton.setAttribute('aria-label', t('menu.open'));
  menuButton.addEventListener('click', onMenu);
  const seasonIcon = element.querySelector<HTMLElement>('.season-icon')!;
  cashLabel!.textContent = t('topbar.cash');
  const cashButton = element.querySelector<HTMLButtonElement>('.stat-cash')!;
  cashButton.setAttribute('aria-label', t('topbar.openFinance'));
  cashButton.addEventListener('click', onCashTap);
  renownLabel!.textContent = t('topbar.renown');

  let last = '';
  return {
    element,
    update(state) {
      const { date, detail, season } = formatDate(state.time.hour);
      const key = `${state.finance.cash}|${state.renown}|${date}|${detail}`;
      if (key === last) return;
      last = key;
      cashValue!.textContent = formatMoney(state.finance.cash);
      cashButton.classList.toggle('negative', state.finance.cash < 0);
      renownValue!.textContent = formatNumber(state.renown);
      dateValue.textContent = date;
      dateDetail.textContent = detail;
      if (seasonIcon.dataset.season !== season) {
        seasonIcon.dataset.season = season;
        seasonIcon.innerHTML = SEASON_ICONS[season];
      }
    },
  };
}
