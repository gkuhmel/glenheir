import { t, type MessageKey } from '../i18n';
import type { Insets } from '../render/camera';
import type { GameState } from '../sim/state';
import { createBottomBar, type TabId } from './bottombar';
import { createDrawer } from './drawer';
import { createTopBar } from './topbar';
import './styles.css';

export interface Ui {
  update(state: GameState): void;
  /** Place occupée par les barres, pour la caméra de la carte. */
  insets(): Insets;
}

/** Monte l'interface HTML par-dessus la carte. */
export function mountUi(root: HTMLElement, onSecretGesture: () => void): Ui {
  let activeTab: TabId = 'map';
  const topBar = createTopBar(onSecretGesture);
  const drawer = createDrawer(() => {
    activeTab = 'map';
    bottomBar.setActive(activeTab);
  });
  const bottomBar = createBottomBar((tab: TabId) => {
    // L'onglet Distillerie montre la carte seule ; retoucher l'onglet actif referme le tiroir.
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
    update: (state) => topBar.update(state),
    insets: () => ({
      top: topBar.element.getBoundingClientRect().bottom,
      bottom: window.innerHeight - bottomBar.element.getBoundingClientRect().top,
      left: 0,
      right: 0,
    }),
  };
}
