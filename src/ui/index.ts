import { t, type MessageKey } from '../i18n';
import type { Insets } from '../render/camera';
import type { Game } from '../app/game';
import type { GameState } from '../sim/state';
import { createFinancePanel } from './finance-panel';
import { createBottomBar, type TabId } from './bottombar';
import { createDrawer } from './drawer';
import { createTopBar } from './topbar';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/uncial-antiqua/latin-400.css';
import './styles.css';

/** Hauteur des bandeaux d'entrelacs collés aux barres (voir styles.css). */
const KNOT_BAND_HEIGHT = 14;

export interface Ui {
  update(state: GameState): void;
  /** Place occupée par les barres, pour la caméra de la carte. */
  insets(): Insets;
}

/** Monte l'interface HTML par-dessus la carte. */
export function mountUi(root: HTMLElement, game: Game, onSecretGesture: () => void): Ui {
  let activeTab: TabId = 'map';
  let financeOpen = false;
  const finance = createFinancePanel(game);
  const topBar = createTopBar(onSecretGesture, () => {
    if (financeOpen && drawer.isOpen) {
      drawer.close();
      financeOpen = false;
      return;
    }
    finance.render();
    drawer.open(t('finance.title'), finance.element);
    financeOpen = true;
    activeTab = 'map';
    bottomBar.setActive(activeTab);
  });
  const drawer = createDrawer(() => {
    activeTab = 'map';
    financeOpen = false;
    bottomBar.setActive(activeTab);
  });
  const bottomBar = createBottomBar((tab: TabId) => {
    // L'onglet Distillerie montre la carte seule ; retoucher l'onglet actif referme le tiroir.
    financeOpen = false;
    if (tab === 'map' || (drawer.isOpen && activeTab === tab)) {
      drawer.close();
      activeTab = 'map';
    } else {
      drawer.open(t(`tab.${tab}` as MessageKey), t('drawer.soon'));
      activeTab = tab;
    }
    bottomBar.setActive(activeTab);
  });

  root.append(topBar.element, drawer.element, bottomBar.element);

  return {
    update: (state) => {
      topBar.update(state);
      if (financeOpen && drawer.isOpen) finance.render();
    },
    insets: () => ({
      top: topBar.element.getBoundingClientRect().bottom + KNOT_BAND_HEIGHT,
      bottom: window.innerHeight - bottomBar.element.getBoundingClientRect().top + KNOT_BAND_HEIGHT,
      left: 0,
      right: 0,
    }),
  };
}
