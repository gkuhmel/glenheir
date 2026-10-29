import type { Season } from '../sim/time';
import type { TabId } from './bottombar';

const svg = (body: string, className = 'icon') =>
  `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

/** Icônes des onglets : trait laiton, aplats sombres. */
export const TAB_ICONS: Record<TabId, string> = {
  // Domaine : collines, soleil et pin.
  map: svg(
    '<path class="fill" d="M2 20l6-8 4 5 3-3 7 6z"/><path d="M2 20l6-8 4 5 3-3 7 6zM2 20h20"/><circle cx="17" cy="6.5" r="2.5"/><path d="M6 12V9.5M4.5 10.5 6 7l1.5 3.5"/>',
  ),
  // Production : alambic à repasse.
  production: svg(
    '<path class="fill" d="M5 21v-4.5a5 5 0 0 1 10 0V21z"/><path d="M4 21h12M5 21v-4.5a5 5 0 0 1 10 0V21M8.5 11.8 9.2 6h1.6l.7 5.8M10 6V4.5h7.5l2 3V18M17.5 18h4"/>',
  ),
  // Chai : fût couché.
  warehouse: svg(
    '<path class="fill" d="M3 7.5c3-2 15-2 18 0v9c-3 2-15 2-18 0z"/><path d="M3 7.5c3-2 15-2 18 0v9c-3 2-15 2-18 0zM8 5.8v12.4M16 5.8v12.4"/><circle cx="12" cy="12" r="1.2"/>',
  ),
  // Marché : bouteille de whisky.
  market: svg(
    '<path class="fill" d="M8 11c0-2 2-3 2-4.5V2.5h4v4c0 1.5 2 2.5 2 4.5v10H8z"/><path d="M8 11c0-2 2-3 2-4.5V2.5h4v4c0 1.5 2 2.5 2 4.5v10H8zM9.5 2.5h5M8 13h8v5H8z"/>',
  ),
  // Équipe : deux silhouettes.
  staff: svg(
    '<circle class="fill" cx="9" cy="7.5" r="3"/><path d="M3 20.5c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="9" cy="7.5" r="3"/><circle cx="16.5" cy="8.5" r="2.4"/><path d="M15.5 14.2c3.2-.4 5.5 1.8 5.5 5.3"/>',
  ),
};

/** Pièce frappée d'une livre. */
export const COIN_ICON = svg(
  '<circle class="fill" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6.5" stroke-width="0.8"/><path d="M14.5 8.5c-.5-1-1.4-1.5-2.4-1.5-1.5 0-2.4 1-2.4 2.6V16M8.3 12.2h4.5M8.3 16h6.4"/>',
  'icon icon-stat',
);

/** Chardon d'Écosse, emblème de la renommée. */
export const THISTLE_ICON = svg(
  '<ellipse class="fill" cx="12" cy="13.5" rx="3.6" ry="3.2"/><ellipse cx="12" cy="13.5" rx="3.6" ry="3.2"/><path d="M9.6 11.6l4.8 3.8M14.4 11.6l-4.8 3.8M12 10.3 7 5.5M12 10.3 9.2 3.8M12 10.3V3M12 10.3l2.8-6.5M12 10.3l5-4.8M12 16.7V22M12 19.8l-3.5-2.6 1.2-.2-2.4-1.6M12 19.8l3.5-2.6-1.2-.2 2.4-1.6"/>',
  'icon icon-stat',
);

export const SEASON_ICONS: Record<Season, string> = {
  spring: svg(
    '<circle cx="12" cy="6.8" r="3"/><circle cx="16.9" cy="10.4" r="3"/><circle cx="15" cy="16.2" r="3"/><circle cx="9" cy="16.2" r="3"/><circle cx="7.1" cy="10.4" r="3"/><circle class="fill" cx="12" cy="12" r="2.4" fill-opacity="0.9"/>',
    'icon icon-season',
  ),
  summer: svg(
    '<circle class="fill" cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    'icon icon-season',
  ),
  autumn: svg(
    '<path class="fill" d="M12 21c-5-3-7-8-5-13 3 1 5 0 5-5 0 5 2 6 5 5 2 5 0 10-5 13z"/><path d="M12 21c-5-3-7-8-5-13 3 1 5 0 5-5 0 5 2 6 5 5 2 5 0 10-5 13zM12 21V8"/>',
    'icon icon-season',
  ),
  winter: svg(
    '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4l2.5 2.5L14.5 4M9.5 20l2.5-2.5 2.5 2.5"/>',
    'icon icon-season',
  ),
};

/** Triquetra (nœud de la Trinité), ornement des titres. */
export const TRIQUETRA = `<svg class="ornament" viewBox="0 0 40 40" aria-hidden="true">
  <g fill="none" stroke-width="2.2">
    <path d="M20 22 Q8 15 20 3 Q32 15 20 22"/>
    <path d="M20 22 Q8 15 20 3 Q32 15 20 22" transform="rotate(120 20 22)"/>
    <path d="M20 22 Q8 15 20 3 Q32 15 20 22" transform="rotate(240 20 22)"/>
    <circle cx="20" cy="22" r="8.5"/>
  </g>
</svg>`;
