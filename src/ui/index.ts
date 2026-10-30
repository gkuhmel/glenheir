import { t, type MessageKey } from '../i18n';
import type { Insets } from '../render/camera';
import type { Game } from '../app/game';
import type { GameState } from '../sim/state';
import type { PanelContent } from './building-panel';
import { createFinancePanel } from './finance-panel';
import { createBottomBar, type TabId } from './bottombar';
import { createDrawer } from './drawer';
import { createSceneHeader } from './scene-header';
import { createTopBar } from './topbar';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/uncial-antiqua/latin-400.css';
import './styles.css';

/** Hauteur des bandeaux d'entrelacs collés aux barres (voir styles.css). */
const KNOT_BAND_HEIGHT = 14;

export type SceneId = 'map' | 'interior' | 'warehouse';

export interface Ui {
  update(state: GameState): void;
  /** Place occupée par les barres, pour la caméra des scènes. */
  insets(): Insets;
  /** Ouvre le tiroir avec un contenu recalculé à chaque changement d'état. */
  showPanel(provider: () => PanelContent | null): void;
  closePanel(): void;
  /** Ferme le tiroir d'un onglet (avant de changer de scène). */
  closeTab(): void;
  /** Redessine le tiroir ouvert (après un réglage qui ne change pas l'état du jeu). */
  refreshPanel(): void;
  setScene(scene: SceneId): void;
}

export interface UiHandlers {
  /** Contenu du tiroir Menu. */
  menuContent(): PanelContent;
  /** Retour de la vue intérieure à la carte du domaine. */
  onBack(): void;
  /** Le tiroir d'une sélection a été fermé par le joueur. */
  onPanelClosed(): void;
  /** Mode « Agrandir » de la vue intérieure. */
  onBuildMode(on: boolean): void;
  /** Contenu des onglets Production, Chai, Marché, Équipe (null : bientôt disponible). */
  tabContent(tab: TabId): PanelContent | null;
}

type DrawerMode = 'none' | 'finance' | 'tab' | 'panel';

/** Monte l'interface HTML par-dessus les scènes. */
export function mountUi(root: HTMLElement, game: Game, handlers: UiHandlers): Ui {
  let activeTab: TabId = 'map';
  let mode: DrawerMode = 'none';
  let scene: SceneId = 'map';
  let panelProvider: (() => PanelContent | null) | null = null;
  let panelKey = '';
  /** Le tiroir affiche le Menu (le toucher à nouveau le referme). */
  let menuOpen = false;
  const finance = createFinancePanel(game);

  const resetTab = () => {
    activeTab = 'map';
    bottomBar.setActive(activeTab);
  };
  const closeDrawer = () => {
    const wasPanel = mode === 'panel';
    drawer.close();
    mode = 'none';
    panelProvider = null;
    if (wasPanel) handlers.onPanelClosed();
  };

  const topBar = createTopBar(
    () => {
      if (mode === 'panel' && drawer.isOpen && menuOpen) {
        closeDrawer();
        return;
      }
      openPanel(() => handlers.menuContent());
      menuOpen = true;
    },
    () => {
      if (mode === 'finance' && drawer.isOpen) return closeDrawer();
      if (mode === 'panel') handlers.onPanelClosed();
      finance.render();
      drawer.open(t('finance.title'), finance.element);
      mode = 'finance';
      resetTab();
    },
  );
  const drawer = createDrawer(() => {
    const wasPanel = mode === 'panel';
    mode = 'none';
    panelProvider = null;
    resetTab();
    if (wasPanel) handlers.onPanelClosed();
  });
  const bottomBar = createBottomBar((tab: TabId) => {
    if (tab === 'map') {
      closeDrawer();
      resetTab();
      if (scene !== 'map') handlers.onBack();
      return;
    }
    if (drawer.isOpen && mode === 'tab' && activeTab === tab) {
      closeDrawer();
      resetTab();
      return;
    }
    if (mode === 'panel') handlers.onPanelClosed();
    if (handlers.tabContent(tab)) {
      openPanel(() => handlers.tabContent(tab), tab);
      return;
    }
    drawer.open(t(`tab.${tab}` as MessageKey), t('drawer.soon'));
    mode = 'tab';
    activeTab = tab;
    bottomBar.setActive(activeTab);
  });
  const header = createSceneHeader(handlers.onBack, handlers.onBuildMode);

  root.append(topBar.element, header.element, drawer.element, bottomBar.element);

  const openPanel = (provider: () => PanelContent | null, tab: TabId = 'map') => {
    menuOpen = false;
    panelProvider = provider;
    panelKey = '';
    mode = tab === 'map' ? 'panel' : 'tab';
    activeTab = tab;
    bottomBar.setActive(activeTab);
    renderPanel();
  };

  const renderPanel = () => {
    const content = panelProvider?.();
    if (!content) return closeDrawer();
    drawer.open(content.title, content.body);
  };

  return {
    update: (state) => {
      topBar.update(state);
      if (mode === 'finance' && drawer.isOpen) finance.render();
      if ((mode === 'panel' || mode === 'tab') && panelProvider && drawer.isOpen) {
        // Le contenu dépend de la trésorerie, des bâtiments, de la production et de l'heure.
        const key = JSON.stringify([
          state.time.hour,
          state.finance.cash,
          state.building,
          state.warehouses,
          state.machines,
          state.fields,
          state.stocks,
          state.casks.length,
          state.market,
          state.staff,
          state.candidates,
          state.bottlings,
          state.renown,
        ]);
        if (key !== panelKey) {
          panelKey = key;
          renderPanel();
        }
      }
    },
    insets: () => ({
      top: topBar.element.getBoundingClientRect().bottom + KNOT_BAND_HEIGHT,
      bottom: window.innerHeight - bottomBar.element.getBoundingClientRect().top + KNOT_BAND_HEIGHT,
      left: 0,
      right: 0,
    }),
    showPanel: (provider) => openPanel(provider),
    refreshPanel: () => {
      panelKey = '';
      if (drawer.isOpen && panelProvider) renderPanel();
    },
    closeTab: () => {
      if (mode === 'tab' || mode === 'finance') closeDrawer();
      resetTab();
    },
    closePanel: () => {
      if (mode === 'panel') {
        drawer.close();
        mode = 'none';
        panelProvider = null;
      }
    },
    setScene: (next) => {
      scene = next;
      header.setVisible(next !== 'map');
      header.setBuildVisible(next === 'interior');
      header.setBuildMode(false);
      handlers.onBuildMode(false);
    },
  };
}
