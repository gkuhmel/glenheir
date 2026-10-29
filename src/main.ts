import { Game } from './app/game';
import { isDebugRequested, mountDebugPanel, type DebugPanel } from './debug/panel';
import { t } from './i18n';
import { MapView } from './render/map-view';
import { startAutosave } from './save/autosave';
import { mountUi } from './ui';
import { showAbsence } from './ui/absence';
import { showToast } from './ui/toast';

/** Empêche Safari iOS de zoomer la page entière (il ignore user-scalable=no). */
function blockPageZoom(): void {
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  }
  document.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false });
}

async function main(): Promise<void> {
  document.title = t('app.title');
  blockPageZoom();

  const uiRoot = document.getElementById('ui')!;
  const mapRoot = document.getElementById('map')!;

  const game = await Game.start();

  let debug: DebugPanel | null = null;
  const openDebug = () => {
    debug ??= mountDebugPanel(uiRoot, game, false);
    debug.toggle();
  };
  const ui = mountUi(uiRoot, game, openDebug);
  ui.update(game.loop.state);
  game.loop.onTick(() => ui.update(game.loop.state));

  await MapView.create(mapRoot, () => ui.insets());
  if (isDebugRequested()) openDebug();
  if (game.loadError) showToast(t('load.corrupt'), 6000);
  if (game.startSummary) showAbsence(game.startSummary);
  // Retour au premier plan : rattrapage immédiat et résumé si l'absence a été longue.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const summary = game.resume();
    if (summary) showAbsence(summary);
  });

  startAutosave(() => {
    game.save().catch((error) => console.error('Sauvegarde impossible', error));
  });
  game.loop.start();
}

main().catch((error) => {
  console.error(error);
  document.body.textContent = String(error);
});
