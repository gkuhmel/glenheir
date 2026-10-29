import { t } from '../i18n';

export interface SceneHeader {
  element: HTMLElement;
  setVisible(visible: boolean): void;
  setBuildMode(on: boolean): void;
}

const HAMMER =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M4 7l5-4 4 3-2 2z"/><path d="M4 7l5-4 4 3-2 2-2-1-1 1zM9 8l10 11-2 2L7 10"/></svg>';

/** Bandeau des vues intérieures : retour au domaine et mode « Agrandir ». */
export function createSceneHeader(
  onBack: () => void,
  onBuildMode: (on: boolean) => void,
): SceneHeader {
  const element = document.createElement('div');
  element.className = 'scene-header';
  element.hidden = true;
  element.innerHTML = `
    <button type="button" class="back-button"><span aria-hidden="true">‹</span><span class="back-label"></span></button>
    <button type="button" class="build-toggle" aria-pressed="false">${HAMMER}<span></span></button>`;
  element.querySelector('.back-label')!.textContent = t('building.back');
  element.querySelector('.back-button')!.addEventListener('click', onBack);
  const toggle = element.querySelector<HTMLButtonElement>('.build-toggle')!;
  const label = toggle.querySelector('span')!;
  let on = false;
  const render = () => {
    toggle.setAttribute('aria-pressed', String(on));
    toggle.classList.toggle('is-on', on);
    label.textContent = t(on ? 'building.buildDone' : 'building.buildMode');
  };
  toggle.addEventListener('click', () => {
    on = !on;
    render();
    onBuildMode(on);
  });
  render();
  return {
    element,
    setVisible(visible) {
      element.hidden = !visible;
    },
    setBuildMode(value) {
      on = value;
      render();
    },
  };
}
