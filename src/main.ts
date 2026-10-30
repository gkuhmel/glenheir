import { Game } from './app/game';
import {
  isDebugRequested,
  mountDebugPanel,
  saveDebugPreference,
  type DebugPanel,
} from './debug/panel';
import { t } from './i18n';
import { InteriorScene } from './render/interior/interior-scene';
import { MapScene } from './render/map/map-scene';
import { Stage } from './render/stage';
import { startAutosave } from './save/autosave';
import { mountUi } from './ui';
import { showAbsence } from './ui/absence';
import { BuildingPanel } from './ui/building-panel';
import { menuPanel } from './ui/menu-panel';
import { ProductionPanels } from './ui/production-panels';
import { showTerroirChoice } from './ui/terroir';
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
  const production = new ProductionPanels(game);

  // Outils de test : bouton DBG activé depuis le Menu (ou avec ?debug dans l'adresse).
  let debug: DebugPanel | null = null;
  let debugEnabled = false;
  const setDebug = (enabled: boolean) => {
    debugEnabled = enabled;
    saveDebugPreference(enabled);
    if (enabled) debug ??= mountDebugPanel(uiRoot, game, false);
    debug?.setEnabled(enabled);
    // Accès à la partie depuis la console du navigateur, pour les tests.
    Object.assign(window, { glenheir: enabled ? game : undefined });
  };

  let goToMap = () => {};
  let interiorScene: InteriorScene | null = null;
  const ui = mountUi(uiRoot, game, {
    menuContent: () =>
      menuPanel(game, {
        debugEnabled: () => debugEnabled,
        setDebug: (enabled) => {
          setDebug(enabled);
          ui.refreshPanel();
        },
      }),
    onBack: () => goToMap(),
    onPanelClosed: () => interiorScene?.clearSelection(),
    onBuildMode: (on) => interiorScene?.setBuildMode(on),
    tabContent: (tab) =>
      tab === 'production' ? production.overview() : tab === 'market' ? production.market() : null,
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
    selectField: (id) => ui.showPanel(() => production.forField(id)),
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
  // Nouvelle partie (ou partie réinitialisée) : le joueur choisit d'abord son terroir.
  let choosingTerroir = false;
  const askTerroir = () => {
    if (game.state.terroirChosen || choosingTerroir) return;
    choosingTerroir = true;
    showTerroirChoice((terroir) => {
      choosingTerroir = false;
      game.execute({ type: 'chooseTerroir', terroir });
      showToast(t('terroir.chosen', { terroir: t(`terroir.${terroir}`) }));
    });
  };
  game.loop.onTick((events) => {
    ui.update(game.state);
    map.setState(game.state);
    interior.setState(game.state, events);
    askTerroir();
  });
  askTerroir();

  if (isDebugRequested()) setDebug(true);
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
