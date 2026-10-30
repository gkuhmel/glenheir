import type { Game } from '../app/game';
import { t } from '../i18n';
import type { PanelContent } from './building-panel';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

export interface MenuOptions {
  debugEnabled(): boolean;
  setDebug(enabled: boolean): void;
}

/** Menu du jeu : outils de test, nouvelle partie, version. */
export function menuPanel(game: Game, options: MenuOptions): PanelContent {
  const body = el('div', 'panel');

  const tools = el('section', 'panel-section');
  tools.append(el('h3', '', t('menu.testTools')), el('p', 'panel-desc', t('menu.testToolsDesc')));
  const enabled = options.debugEnabled();
  const toggle = el(
    'button',
    `parchment-button${enabled ? ' is-active' : ''}`,
    t(enabled ? 'menu.testOn' : 'menu.testOff'),
  );
  toggle.type = 'button';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(enabled));
  toggle.addEventListener('click', () => options.setDebug(!options.debugEnabled()));
  tools.append(toggle);

  const party = el('section', 'panel-section');
  party.append(el('h3', '', t('menu.game')));
  const reset = el('button', 'parchment-button', t('debug.reset'));
  reset.type = 'button';
  reset.addEventListener('click', async () => {
    if (window.confirm(t('debug.resetConfirm'))) await game.reset();
  });
  party.append(reset);

  body.append(tools, party, el('p', 'panel-cash', t('menu.version', { version: __APP_VERSION__ })));
  return { title: t('menu.title'), body };
}
