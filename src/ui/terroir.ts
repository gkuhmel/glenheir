import { t, type MessageKey } from '../i18n';
import type { Terroir } from '../sim/state';
import { TRIQUETRA } from './icons';

const TERROIRS: Terroir[] = ['speyside', 'islay'];

/** Petit paysage de chaque terroir : vallée boisée ou côte battue par les vents. */
const LANDSCAPES: Record<Terroir, string> = {
  speyside: `<svg viewBox="0 0 120 54" aria-hidden="true">
    <rect width="120" height="54" fill="#bcd0d6"/>
    <path d="M0 34 L22 18 L40 30 L62 12 L86 30 L104 20 L120 28 V54 H0Z" fill="#7f9184"/>
    <path d="M0 40 Q30 30 60 38 T120 36 V54 H0Z" fill="#5f8240"/>
    <path d="M0 48 Q40 40 70 46 T120 44 V54 H0Z" fill="#4b6b34"/>
    <path d="M18 44l4-10 4 10zM28 46l4-12 4 12zM96 43l4-9 4 9z" fill="#2f4a2c"/>
    <path d="M50 54 Q58 46 72 50 T96 54" stroke="#6e93a8" stroke-width="3" fill="none"/>
  </svg>`,
  islay: `<svg viewBox="0 0 120 54" aria-hidden="true">
    <rect width="120" height="54" fill="#aab9c2"/>
    <path d="M0 30 Q30 26 52 30 L60 26 L74 30 Q100 28 120 30 V54 H0Z" fill="#59707b"/>
    <path d="M0 36 Q20 32 44 36 L64 34 L72 38 V54 H0Z" fill="#6b6150"/>
    <path d="M0 42 Q24 38 50 42 L70 40 V54 H0Z" fill="#7a5a6a"/>
    <path d="M72 38 Q92 40 120 38 V54 H72Z" fill="#3f5a66"/>
    <path d="M78 46 q6 -3 12 0 M96 44 q6 -3 12 0" stroke="#d9e4e8" stroke-width="1.5" fill="none"/>
    <rect x="40" y="31" width="12" height="7" fill="#e9e2d1"/><path d="M39 31 L46 27 L53 31Z" fill="#3a3f47"/>
  </svg>`,
};

/** Écran de nouvelle partie : le pitch, puis le choix entre Speyside et Islay. */
export function showTerroirChoice(onChoose: (terroir: Terroir) => void): void {
  document.querySelector('.terroir')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'absence terroir';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const card = document.createElement('div');
  card.className = 'absence-card terroir-card';
  card.innerHTML = `<div class="absence-header">${TRIQUETRA}<h2></h2></div><div class="drawer-rule" aria-hidden="true"></div><p class="absence-elapsed"></p>`;
  card.querySelector('h2')!.textContent = t('terroir.title');
  card.querySelector('.absence-elapsed')!.textContent = t('terroir.intro');

  for (const terroir of TERROIRS) {
    const name = t(`terroir.${terroir}` as MessageKey);
    const option = document.createElement('section');
    option.className = 'terroir-option';
    option.innerHTML = `${LANDSCAPES[terroir]}<h3></h3><ul class="pros"></ul><ul class="cons"></ul>`;
    option.querySelector('h3')!.textContent = name;
    for (const [list, key] of [
      ['.pros', 'pros'],
      ['.cons', 'cons'],
    ] as const) {
      for (const line of t(`terroir.${terroir}.${key}` as MessageKey).split('|')) {
        const li = document.createElement('li');
        li.textContent = line;
        option.querySelector(list)!.append(li);
      }
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'parchment-button';
    button.textContent = t('terroir.choose', { terroir: name });
    button.addEventListener('click', () => {
      overlay.remove();
      onChoose(terroir);
    });
    option.append(button);
    card.append(option);
  }
  overlay.append(card);
  document.getElementById('ui')?.append(overlay);
}
