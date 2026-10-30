import type { Game } from '../app/game';
import { CASKS, MARKET, WAREHOUSE } from '../data/balance';
import { formatMoney, t, type MessageKey } from '../i18n';
import type { Command } from '../sim/commands';
import {
  ageYears,
  caskCapacityLpa,
  caskProfile,
  caskValue,
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
import { cellarMaster } from '../sim/systems/staff';
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
    if (cask) return this.forCask(cask);
    // Fût vendu dans un chai en ruine : rien à remplir ici, le tiroir se ferme.
    if (state.warehouses.find((w) => w.id === warehouseId)?.ruined) return null;
    return this.forEmptyPlace(warehouseId, place);
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
      this.line(
        t('cask.filledOn'),
        cask.inherited ? t('cask.inherited') : formatGameDate(cask.filledHour),
      ),
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
    // Le maître de chai connaît la qualité exacte ; sans lui, une fourchette ±15.
    const known = cellarMaster(this.game.state) !== null;
    const current = caskProfile(cask);
    const profile = known
      ? this.section(
          t('cask.profile'),
          profileBars(current),
          el('p', 'panel-status', t('cask.qualityExact', { quality: Math.round(current.quality) })),
        )
      : this.section(
          t('cask.profile'),
          profileBars(current, { quality: false }),
          el('p', 'panel-status', t('cask.quality', qualityEstimate(cask))),
          el('p', 'panel-desc', t('cask.qualityHint')),
        );
    body.append(profile, this.brokerSection(cask));
    return { title: t('cask.title', { id: cask.id }), body };
  }

  /** Vente du fût entier au courtier : un par mois, whisky de 3 ans et plus. */
  private brokerSection(cask: Cask): HTMLElement {
    const state = this.game.state;
    const broker = MARKET.caskBroker;
    const value = caskValue(cask, state.time.hour);
    const tooYoung = ageYears(cask, state.time.hour) < broker.minYears;
    const capped = state.market.casksSoldThisMonth >= broker.casksPerMonth;
    const warehouse = state.warehouses.find((w) => w.id === cask.warehouseId);
    const section = this.section(t('broker.title'), el('p', 'panel-desc', t('broker.desc')));
    if (warehouse?.ruined)
      section.append(
        el(
          'p',
          'panel-status warning',
          t('broker.leaking', { share: Math.round(WAREHOUSE.ruinedAngelsShare * 100) }),
        ),
      );
    section.append(
      this.button(
        t('broker.sell', { amount: formatMoney(value) }),
        () =>
          this.run(
            { type: 'sellCask', caskId: cask.id },
            t('broker.sold', { amount: formatMoney(value) }),
          ),
        tooYoung || capped,
      ),
    );
    if (tooYoung) section.append(el('p', 'panel-desc', t('error.caskTooYoung')));
    else if (capped) section.append(el('p', 'panel-desc', t('error.brokerCapReached')));
    return section;
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

  private restoreButton(warehouseId: number): HTMLButtonElement {
    return this.button(
      t('warehouse.restore', { cost: formatMoney(WAREHOUSE.restoreCost) }),
      () => this.run({ type: 'restoreWarehouse', warehouseId }, t('warehouse.restored')),
      WAREHOUSE.restoreCost > this.game.state.finance.cash,
    );
  }

  /** Chai en ruine touché ailleurs que sur un fût : sa restauration. */
  forRuin(warehouseId: number): PanelContent | null {
    const warehouse = this.game.state.warehouses.find((w) => w.id === warehouseId);
    if (!warehouse?.ruined) return null;
    const body = el('div', 'panel');
    body.append(
      el('p', 'panel-desc', t('warehouse.ruinedDesc', { places: warehouse.places })),
      el('p', 'panel-status warning', t('chai.ruined')),
      this.restoreButton(warehouseId),
      el(
        'p',
        'panel-cash',
        t('building.cash', { amount: formatMoney(this.game.state.finance.cash) }),
      ),
    );
    return { title: this.warehouseTitle(warehouseId), body };
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
    for (const warehouse of state.warehouses) {
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
      if (warehouse.ruined) {
        section.querySelector('h3')!.after(el('p', 'panel-status warning', t('chai.ruined')));
        row.append(this.restoreButton(warehouse.id));
        section.append(row);
      } else {
        const extend = this.extendButton(warehouse.id);
        if (extend instanceof HTMLButtonElement) row.append(extend);
        section.append(row);
        if (extensionsOf(warehouse) >= WAREHOUSE.maxExtensions) section.append(extend);
      }
      if (casks.length === 0) section.append(el('p', 'panel-desc', t('chai.empty')));
      for (const cask of casks) {
        const known = cellarMaster(state) !== null;
        const line = this.line(
          t('chai.caskLine', {
            type: t(`cask.type.${cask.type}` as MessageKey),
            age: formatAge(ageYears(cask, state.time.hour)),
          }),
          known
            ? t('chai.caskQualityExact', { quality: Math.round(caskProfile(cask).quality) })
            : t('chai.caskQuality', qualityEstimate(cask)),
        );
        if (ageYears(cask, state.time.hour) >= CASKS.legalAgeYears) line.classList.add('is-legal');
        section.append(line);
      }
      body.append(section);
    }
    return { title: t('chai.title'), body };
  }
}
