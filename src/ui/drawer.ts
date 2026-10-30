import { t } from '../i18n';
import { TRIQUETRA } from './icons';

export interface Drawer {
  element: HTMLElement;
  open(title: string, body: HTMLElement | string): void;
  close(): void;
  readonly isOpen: boolean;
}

/** Panneau en tiroir qui monte du bas ; la carte reste visible au-dessus. */
export function createDrawer(onClose: () => void): Drawer {
  const element = document.createElement('section');
  element.className = 'drawer';
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `
    <div class="drawer-handle" aria-hidden="true"></div>
    <div class="drawer-header">
      ${TRIQUETRA}
      <h2 class="drawer-title"></h2>
      <button type="button" class="icon-button drawer-close"></button>
    </div>
    <div class="drawer-rule" aria-hidden="true"></div>
    <div class="drawer-body"></div>`;
  const title = element.querySelector<HTMLElement>('.drawer-title')!;
  const body = element.querySelector<HTMLElement>('.drawer-body')!;
  const closeButton = element.querySelector<HTMLButtonElement>('.drawer-close')!;
  closeButton.setAttribute('aria-label', t('drawer.close'));
  closeButton.textContent = '✕';

  let open = false;
  const drawer: Drawer = {
    element,
    get isOpen() {
      return open;
    },
    open(heading, content) {
      // Nouveau contenu : on repart du haut ; simple rafraîchissement : on garde la position.
      const fresh = !open || heading !== title.textContent;
      title.textContent = heading;
      body.replaceChildren(
        typeof content === 'string'
          ? Object.assign(document.createElement('p'), { textContent: content })
          : content,
      );
      if (fresh) body.scrollTop = 0;
      open = true;
      element.classList.add('is-open');
      element.setAttribute('aria-hidden', 'false');
    },
    close() {
      open = false;
      element.classList.remove('is-open');
      element.setAttribute('aria-hidden', 'true');
    },
  };
  closeButton.addEventListener('click', () => {
    drawer.close();
    onClose();
  });
  return drawer;
}
