import type { Game } from '../app/game';
import { DEBUG, TIME } from '../data/balance';
import { t, type MessageKey } from '../i18n';
import { HOURS_PER_SEASON } from '../sim/time';
import { showToast } from '../ui/toast';
import './panel.css';

export interface DebugPanel {
  toggle(): void;
}

/** Le panneau est disponible avec `?debug` dans l'URL, ou par le geste caché. */
export function isDebugRequested(): boolean {
  return new URLSearchParams(window.location.search).has('debug');
}

const button = (label: string, onClick: () => void, className = '') => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
};

const section = (titleKey: MessageKey, ...children: HTMLElement[]) => {
  const el = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = t(titleKey);
  const row = document.createElement('div');
  row.className = 'debug-row';
  row.append(...children);
  el.append(heading, row);
  return el;
};

/** Panneau de test : vitesse, saut dans le temps, sauvegarde, état brut. */
export function mountDebugPanel(root: HTMLElement, game: Game, startOpen: boolean): DebugPanel {
  const { loop } = game;

  const fab = button('DBG', () => toggle(), 'debug-fab');
  fab.setAttribute('aria-label', t('debug.toggle'));

  const panel = document.createElement('aside');
  panel.className = 'debug-panel';
  panel.hidden = true;

  const heading = document.createElement('h2');
  heading.textContent = t('debug.title');
  const closeButton = button('✕', () => toggle(), 'debug-close');

  const speedButtons = DEBUG.speeds.map((speed) =>
    button(`×${speed}`, () => {
      loop.setSpeed(speed);
      refresh();
    }),
  );

  const skip = (hours: number) => () => loop.advance(hours);

  const text = document.createElement('textarea');
  text.rows = 3;
  text.spellcheck = false;

  const state = document.createElement('pre');
  const storageInfo = document.createElement('p');
  storageInfo.textContent = t('debug.storage', { backend: game.storage.backend });

  panel.append(
    heading,
    closeButton,
    section('debug.speed', ...speedButtons),
    section(
      'debug.skip',
      button(t('debug.skipHour'), skip(1)),
      button(t('debug.skipDay'), skip(TIME.hoursPerDay)),
      button(t('debug.skipSeason'), skip(HOURS_PER_SEASON)),
    ),
    section(
      'debug.cheats',
      button(t('debug.addCash'), () => {
        game.execute({ type: 'debugAddCash' });
      }),
    ),
    section(
      'debug.save',
      button(t('debug.saveNow'), async () => {
        await game.save();
        showToast(t('debug.saved'));
      }),
      button(t('debug.export'), async () => {
        text.value = game.exportSave();
        text.select();
        await navigator.clipboard?.writeText(text.value).catch(() => undefined);
        showToast(t('debug.exported'));
      }),
      button(t('debug.import'), async () => {
        try {
          await game.importSave(text.value);
          showToast(t('debug.imported'));
        } catch (error) {
          showToast(t('debug.importError', { error: (error as Error).message }));
        }
      }),
      button(
        t('debug.reset'),
        async () => {
          if (window.confirm(t('debug.resetConfirm'))) await game.reset();
        },
        'danger',
      ),
    ),
    text,
    storageInfo,
    section('debug.state', state),
  );

  root.append(fab, panel);

  function refresh() {
    if (panel.hidden) return;
    DEBUG.speeds.forEach((speed, i) =>
      speedButtons[i]?.classList.toggle('is-active', loop.currentSpeed === speed),
    );
    state.textContent = JSON.stringify(
      { ...loop.state, syncedAtRealMs: loop.syncedAt, speed: loop.currentSpeed },
      null,
      2,
    );
  }

  function toggle() {
    panel.hidden = !panel.hidden;
    fab.hidden = !panel.hidden;
    refresh();
  }

  loop.onTick(refresh);
  if (startOpen) toggle();
  return { toggle };
}
