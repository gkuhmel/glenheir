import { t, type MessageKey } from '../i18n';

export type TabId = 'map' | 'production' | 'warehouse' | 'market' | 'staff';

const ICONS: Record<TabId, string> = {
  // Plan de la distillerie : bâtiment.
  map: '<path d="M3 21V10l9-6 9 6v11h-6v-6H9v6z"/>',
  // Production : alambic.
  production:
    '<path d="M10 3h4v3l3 3v9a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V9l3-3z"/><path d="M17 11h3v6"/>',
  // Chai : fût.
  warehouse: '<ellipse cx="12" cy="12" rx="7" ry="9"/><path d="M5.5 8h13M5.5 16h13M12 3v18"/>',
  // Marché : bouteille.
  market: '<path d="M10 2h4v5l2 3v11H8V10l2-3z"/><path d="M8 14h8"/>',
  // Équipe : personnes.
  staff:
    '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 14c3 0 6 1.5 6 5"/>',
};

export const TABS: readonly TabId[] = ['map', 'production', 'warehouse', 'market', 'staff'];

export interface BottomBar {
  element: HTMLElement;
  setActive(tab: TabId): void;
}

/** Barre du bas à 5 onglets. */
export function createBottomBar(onSelect: (tab: TabId) => void): BottomBar {
  const element = document.createElement('nav');
  element.className = 'bottombar';
  const buttons = new Map<TabId, HTMLButtonElement>();
  for (const tab of TABS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab';
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[tab]}</svg><span></span>`;
    button.querySelector('span')!.textContent = t(`tab.${tab}` as MessageKey);
    button.addEventListener('click', () => onSelect(tab));
    buttons.set(tab, button);
    element.appendChild(button);
  }
  const bar: BottomBar = {
    element,
    setActive(active) {
      for (const [tab, button] of buttons) {
        button.classList.toggle('is-active', tab === active);
        button.setAttribute('aria-current', tab === active ? 'page' : 'false');
      }
    },
  };
  bar.setActive('map');
  return bar;
}
