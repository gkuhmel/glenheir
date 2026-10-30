import type { Game } from '../app/game';
import { CASKS, WAREHOUSE } from '../data/balance';
import { formatMoney, t, type MessageKey } from '../i18n';
import type { Command } from '../sim/commands';
import {
  ageYears,
  caskCapacityLpa,
  caskProfile,
  columnOf,
  extensionsOf,
  qualityEstimate,
  tierOf,
  type Cask,
  type CaskType,
} from '../sim/systems/warehouse';
import { HOURS_PER_YEAR, toGameDate } from '../sim/time';
import type { PanelContent } from './building-panel';
import { profileBars } from './production-panels';
import { showToast } from './toast';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const lpa = (value: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);

const CASK_TYPES = Object.keys(CASKS.types) as CaskType[];

/** Âge lisible : « 2 an(s) 4 mois » ou « 7 mois ». */
export function formatAge(years: number): string {
  const months = Math.max(0, Math.floor(years * 12 + 1e-9));
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y > 0 ? t('age.yearsMonths', { y, m }) : t('age.months', { m });
}

/** Date du calendrier de jeu : « 1er mars de l'an 2 ». */
export function formatGameDate(hour: number): string {
  const d = toGameDate(hour);
  return t('date.withYear', {
    day: d.day === 1 ? t('date.dayFirst') : String(d.day),
    month: t(`month.${d.month}` as MessageKey),
    year: d.year,
  });
}

export interface WarehouseActions {
  /** Entrer dans la vue intérieure d'un chai. */
  enter(warehouseId: number): void;
}

/** Tiroirs du chai : place libre, fiche de fût, agrandissement, onglet Chai. */
export class WarehousePanels {
  constructor(
    private readonly game: Game,
    private readonly actions: WarehouseActions,
  ) {}

  private run(command: Command, success: string): void {
    const result = this.game.execute(command);
    showToast(result.ok ? success : t(`error.${result.error}` as MessageKey));
  }

  private button(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const button = el('button', 'parchment-button', label);
    button.type = 'button';
    button.disabled = disabled;
    button.addEventListener('click', onClick);
    return button;
  }

  private line(label: string, value: string): HTMLElement {
    const line = el('div', 'stock-line');
    line.append(el('span', '', label), el('strong', '', value));
    return line;
  }

  private section(title: string, ...children: HTMLElement[]): HTMLElement {
    const section = el('section', 'panel-section');
    section.append(el('h3', '', title), ...children);
    return section;
  }

  private warehouseTitle(warehouseId: number): string {
    const index = this.game.state.warehouses.findIndex((w) => w.id === warehouseId);
    return t('warehouse.title', { n: index + 1 });
  }

  /** Place touchée dans le chai : choix du fût si elle est libre, fiche du fût sinon. */
  forPlace(warehouseId: number, place: number): PanelContent | null {
    const state = this.game.state;
    const cask = state.casks.find((c) => c.warehouseId === warehouseId && c.place === place);
    return cask ? this.forCask(cask) : this.forEmptyPlace(warehouseId, place);
  }

  private forEmptyPlace(warehouseId: number, place: number): PanelContent | null {
    const state = this.game.state;
    const warehouse = state.warehouses.find((w) => w.id === warehouseId);
    if (!warehouse || place >= warehouse.places) return null;
    const tier = tierOf(place);
    const body = el('div', 'panel');
    body.append(el('p', 'panel-desc', t(`warehouse.tierDesc.${tier}` as MessageKey)));
    const stock = state.stocks.newMake.amount;
    body.append(el('p', 'panel-status', t('warehouse.newMakeStock', { lpa: lpa(stock) })));
    const options = el('div', 'cask-options');
    for (const type of CASK_TYPES) {
      const spec = CASKS.types[type];
      const capacity = caskCapacityLpa(type);
      const minimum = capacity * CASKS.minFillShare;
      const card = el('div', `cask-option cask-${type}`);
      card.append(
        el('h4', '', t(`cask.type.${type}` as MessageKey)),
        el('p', '', t(`cask.desc.${type}` as MessageKey)),
        el(
          'p',
          'cask-capacity',
          stock >= minimum
            ? t('cask.capacity', { lpa: lpa(capacity) })
            : t('warehouse.noNewMake', { lpa: lpa(minimum) }),
        ),
        this.button(
          t('cask.fill', { cost: formatMoney(spec.price) }),
          () =>
            this.run(
              { type: 'fillCask', warehouseId, place, caskType: type },
              t('cask.filled', { lpa: lpa(Math.min(capacity, stock)) }),
            ),
          stock < minimum || spec.price > state.finance.cash,
        ),
      );
      options.append(card);
    }
    body.append(options);
    body.append(
      el('p', 'panel-cash', t('building.cash', { amount: formatMoney(state.finance.cash) })),
    );
    return {
      title: t('warehouse.placeTitle', { tier: t(`tier.${tier}` as MessageKey) }),
      body,
    };
  }

  private forCask(cask: Cask): PanelContent {
    const hour = this.game.state.time.hour;
    const age = ageYears(cask, hour);
    const legalHour = cask.filledHour + CASKS.legalAgeYears * HOURS_PER_YEAR;
    const body = el('div', 'panel');
    const fill = cask.fill === 1 ? t('cask.firstFill') : t('cask.refill');
    body.append(
      this.line(t('cask.type'), `${t(`cask.type.${cask.type}` as MessageKey)} · ${fill}`),
      this.line(t('cask.age'), formatAge(age)),
      this.line(t('cask.filledOn'), formatGameDate(cask.filledHour)),
      this.line(
        t('cask.volume'),
        t('cask.volumeValue', { lpa: lpa(cask.lpa), lost: lpa(cask.initialLpa - cask.lpa) }),
      ),
      this.line(
        t('cask.legal'),
        age >= CASKS.legalAgeYears
          ? t('cask.legalDone')
          : t('cask.legalOn', { date: formatGameDate(legalHour) }),
      ),
      this.line(
        t('cask.position'),
        t('cask.positionValue', {
          col: columnOf(cask.place) + 1,
          tier: t(`tier.${tierOf(cask.place)}` as MessageKey),
        }),
      ),
    );
    const estimate = qualityEstimate(cask);
    const profile = this.section(
      t('cask.profile'),
      profileBars(caskProfile(cask), { quality: false }),
      el('p', 'panel-status', t('cask.quality', estimate)),
      el('p', 'panel-desc', t('cask.qualityHint')),
    );
    body.append(profile);
    return { title: t('cask.title', { id: cask.id }), body };
  }

  /** Chantier au bout du chai : +20 places. */
  forExtension(warehouseId: number): PanelContent | null {
    const state = this.game.state;
    const warehouse = state.warehouses.find((w) => w.id === warehouseId);
    if (!warehouse) return null;
    const body = el('div', 'panel');
    const casks = state.casks.filter((c) => c.warehouseId === warehouseId).length;
    body.append(
      el('p', 'panel-desc', t('warehouse.extendDesc')),
      el('p', 'panel-status', t('warehouse.occupancy', { casks, places: warehouse.places })),
    );
    body.append(this.extendButton(warehouseId));
    body.append(
      el('p', 'panel-cash', t('building.cash', { amount: formatMoney(state.finance.cash) })),
    );
    return { title: t('warehouse.extendTitle'), body };
  }

  private extendButton(warehouseId: number): HTMLElement {
    const warehouse = this.game.state.warehouses.find((w) => w.id === warehouseId)!;
    if (extensionsOf(warehouse) >= WAREHOUSE.maxExtensions)
      return el('p', 'panel-status', t('warehouse.maxed'));
    return this.button(
      t('warehouse.extend', { cost: formatMoney(WAREHOUSE.extensionCost) }),
      () => this.run({ type: 'extendWarehouse', warehouseId }, t('warehouse.extended')),
      WAREHOUSE.extensionCost > this.game.state.finance.cash,
    );
  }

  /** Onglet Chai : remplissage de chaque chai et liste des fûts, du plus vieux au plus jeune. */
  overview(): PanelContent {
    const state = this.game.state;
    const body = el('div', 'panel');
    const open = state.warehouses.filter((w) => !w.ruined);
    if (open.length === 0) body.append(el('p', 'panel-desc', t('chai.none')));
    for (const warehouse of open) {
      const casks = state.casks
        .filter((c) => c.warehouseId === warehouse.id)
        .sort((a, b) => a.filledHour - b.filledHour);
      const section = this.section(
        this.warehouseTitle(warehouse.id),
        el(
          'p',
          'panel-status',
          t('warehouse.occupancy', { casks: casks.length, places: warehouse.places }),
        ),
      );
      const row = el('div', 'button-row');
      row.append(this.button(t('warehouse.enter'), () => this.actions.enter(warehouse.id)));
      const extend = this.extendButton(warehouse.id);
      if (extend instanceof HTMLButtonElement) row.append(extend);
      section.append(row);
      if (extensionsOf(warehouse) >= WAREHOUSE.maxExtensions) section.append(extend);
      if (casks.length === 0) section.append(el('p', 'panel-desc', t('chai.empty')));
      for (const cask of casks) {
        const estimate = qualityEstimate(cask);
        const line = this.line(
          t('chai.caskLine', {
            type: t(`cask.type.${cask.type}` as MessageKey),
            age: formatAge(ageYears(cask, state.time.hour)),
          }),
          t('chai.caskQuality', estimate),
        );
        if (ageYears(cask, state.time.hour) >= CASKS.legalAgeYears) line.classList.add('is-legal');
        section.append(line);
      }
      body.append(section);
    }
    return { title: t('chai.title'), body };
  }
}
