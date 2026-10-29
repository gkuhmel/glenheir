import { t, type MessageKey } from '../i18n';
import { TAB_ICONS } from './icons';

export type TabId = 'map' | 'production' | 'warehouse' | 'market' | 'staff';

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
    button.innerHTML = `${TAB_ICONS[tab]}<span class="tab-label"></span>`;
    button.querySelector('.tab-label')!.textContent = t(`tab.${tab}` as MessageKey);
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
