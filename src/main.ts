import { Game } from './app/game';
import { isDebugRequested, mountDebugPanel, type DebugPanel } from './debug/panel';
import { t } from './i18n';
import { InteriorScene } from './render/interior/interior-scene';
import { MapScene } from './render/map/map-scene';
import { Stage } from './render/stage';
import { startAutosave } from './save/autosave';
import { mountUi } from './ui';
import { showAbsence } from './ui/absence';
import { BuildingPanel } from './ui/building-panel';
import { showToast } from './ui/toast';

/** Empêche Safari iOS de zoomer la page entière (il ignore user-scalable=no). */
function blockPageZoom(): void {
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  }
  document.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false });
}

/** Les textes dessinés dans les scènes ont besoin des polices déjà chargées. */
async function loadFonts(): Promise<void> {
  await Promise.all([
    document.fonts.load('400 17px "Uncial Antiqua"'),
    document.fonts.load('700 22px "Alegreya Sans"'),
  ]).catch(() => undefined);
}

/** Fondu au noir le temps de changer de scène. */
function fade(switchScene: () => void): void {
  let overlay = document.querySelector<HTMLElement>('.scene-fade');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'scene-fade';
    document.body.append(overlay);
  }
  const el = overlay;
  el.classList.add('is-on');
  window.setTimeout(() => {
    switchScene();
    requestAnimationFrame(() => el.classList.remove('is-on'));
  }, 180);
}

async function main(): Promise<void> {
  document.title = t('app.title');
  blockPageZoom();

  const uiRoot = document.getElementById('ui')!;
  const mapRoot = document.getElementById('map')!;

  const [game] = await Promise.all([Game.start(), loadFonts()]);
  const panel = new BuildingPanel(game);

  let debug: DebugPanel | null = null;
  const openDebug = () => {
    debug ??= mountDebugPanel(uiRoot, game, false);
    debug.toggle();
  };

  let goToMap = () => {};
  let interiorScene: InteriorScene | null = null;
  const ui = mountUi(uiRoot, game, {
    onSecretGesture: openDebug,
    onBack: () => goToMap(),
    onPanelClosed: () => interiorScene?.clearSelection(),
    onBuildMode: (on) => interiorScene?.setBuildMode(on),
  });
  ui.update(game.state);

  const stage = await Stage.create(mapRoot, () => ui.insets());
  const interior = new InteriorScene(stage.invalidate, {
    select: (selection) =>
      selection ? ui.showPanel(() => panel.forSelection(selection)) : ui.closePanel(),
  });
  interiorScene = interior;
  const map = new MapScene(stage.invalidate, {
    openDistillery: () =>
      fade(() => {
        ui.closePanel();
        interior.reframe();
        stage.show(interior);
        ui.setScene('interior');
      }),
    selectWarehouse: (id) => ui.showPanel(() => panel.forWarehouse(id)),
  });
  goToMap = () =>
    fade(() => {
      ui.closePanel();
      interior.clearSelection();
      stage.show(map);
      ui.setScene('map');
    });

  map.setState(game.state);
  interior.setState(game.state);
  stage.show(map);
  game.loop.onTick((events) => {
    ui.update(game.state);
    map.setState(game.state);
    interior.setState(game.state, events);
  });

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
