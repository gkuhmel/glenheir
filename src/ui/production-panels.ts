import type { Game } from '../app/game';
import { BARLEY_VARIETIES, EXCISE, GIN, MARKET, PRODUCTION, TERROIRS } from '../data/balance';
import { formatMoney, formatNumber, formatShortDuration, t, type MessageKey } from '../i18n';
import type { Command } from '../sim/commands';
import { PROFILE_AXES, type Profile } from '../sim/profile';
import { canSowAt, growth, isRipe, seedCost, type BarleyVariety } from '../sim/systems/fields';
import { exciseFor } from '../sim/systems/finance';
import { barleyPrice, newMakeValue } from '../sim/systems/market';
import {
  isDone,
  remainingHours,
  type Cut,
  type FermentationMachine,
  type Machine,
  type MaltingMachine,
  type Orders,
  type PeatLevel,
  type StillMachine,
} from '../sim/systems/production';
import type { PanelContent } from './building-panel';
import { machineStatus } from './machine-status';
import { showToast } from './toast';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const amount = (value: number, digits = 1) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(value);

/**
 * Petites jauges des 6 axes aromatiques et de la qualité. Sans maître de chai,
 * la qualité d'un fût n'est connue qu'en fourchette : on masque alors sa jauge.
 */
export function profileBars(profile: Profile, options: { quality?: boolean } = {}): HTMLElement {
  const box = el('div', 'profile-bars');
  for (const axis of PROFILE_AXES) {
    if (axis === 'quality' && options.quality === false) continue;
    const row = el('div', 'profile-row');
    const bar = el('span', 'profile-bar');
    const fill = el('span', `profile-fill axis-${axis}`);
    fill.style.width = `${profile[axis]}%`;
    bar.append(fill);
    row.append(
      el('span', 'profile-label', t(`profile.${axis}` as MessageKey)),
      bar,
      el('span', 'profile-value', formatNumber(profile[axis])),
    );
    box.append(row);
  }
  return box;
}

/** Panneaux de production : machines, champs, onglets Production et Marché. */
export class ProductionPanels {
  constructor(private readonly game: Game) {}

  private run(command: Command, success?: string): void {
    const result = this.game.execute(command);
    if (!result.ok) showToast(t(`error.${result.error}` as MessageKey));
    else if (success) showToast(success);
  }

  private button(
    label: string,
    onClick: () => void,
    options: { active?: boolean; disabled?: boolean; small?: boolean } = {},
  ) {
    const button = el(
      'button',
      `parchment-button${options.small === false ? '' : ' small'}`,
      label,
    );
    button.type = 'button';
    if (options.active) button.classList.add('is-active');
    button.disabled = options.disabled ?? false;
    button.addEventListener('click', onClick);
    return button;
  }

  private section(title: string, ...children: (HTMLElement | string)[]): HTMLElement {
    const section = el('section', 'panel-section');
    section.append(el('h3', '', title));
    for (const child of children)
      section.append(typeof child === 'string' ? el('p', 'panel-desc', child) : child);
    return section;
  }

  private ordersSection(machine: Machine & { orders: Orders }): HTMLElement {
    const current =
      machine.orders === 'continuous'
        ? t('orders.continuous')
        : machine.orders > 0
          ? t('orders.count', { n: machine.orders })
          : t('orders.none');
    const set = (orders: Orders) => () =>
      this.run({ type: 'setOrders', roomId: machine.roomId, orders });
    const row = el('div', 'button-row');
    row.append(
      this.button(t('orders.one'), set(machine.orders === 'continuous' ? 1 : machine.orders + 1)),
      this.button(t('orders.three'), set(machine.orders === 'continuous' ? 3 : machine.orders + 3)),
      this.button(t('orders.continuousButton'), set('continuous'), {
        active: machine.orders === 'continuous',
      }),
      this.button(t('orders.stop'), set(0), { disabled: machine.orders === 0 }),
    );
    return this.section(t('orders.title'), current, row);
  }

  private stockLine(key: MessageKey, value: string): HTMLElement {
    const line = el('div', 'stock-line');
    line.append(el('span', '', t(key)), el('strong', '', value));
    return line;
  }

  /** Réglages et file d'une machine, sous la description de sa salle. */
  machineSections(machine: Machine): HTMLElement[] {
    const state = this.game.state;
    const status = el(
      'p',
      `panel-status${machineStatus(state, machine).running ? ' running' : ''}`,
      machineStatus(state, machine).text,
    );
    switch (machine.kind) {
      case 'malting':
        return [
          status,
          this.stockLine(
            'stock.barley',
            t('stock.tonnes', { amount: amount(state.stocks.barley.amount) }),
          ),
          this.peatSection(machine),
          this.ordersSection(machine),
        ];
      case 'mashing':
        return [
          status,
          this.stockLine(
            'stock.malt',
            t('stock.tonnes', { amount: amount(state.stocks.malt.amount) }),
          ),
          this.ordersSection(machine),
        ];
      case 'fermentation':
        return [status, this.fermentationSection(machine)];
      case 'distillation':
        return [status, ...this.stillSections(machine)];
      case 'gin':
        return [
          status,
          el(
            'p',
            'panel-desc',
            t('gin.recipe', {
              bottles: GIN.batchBottles,
              lpa: amount(GIN.batchBottles * GIN.lpaPerBottle),
            }),
          ),
          this.stockLine(
            'stock.newMake',
            t('stock.lpa', { amount: amount(state.stocks.newMake.amount) }),
          ),
          this.stockLine(
            'stock.gin',
            t('stock.bottles', { amount: formatNumber(state.stocks.gin) }),
          ),
          this.ordersSection(machine),
        ];
    }
  }

  private peatSection(machine: MaltingMachine): HTMLElement {
    const free = TERROIRS[this.game.state.terroir].peatCostFactor === 0;
    const row = el('div', 'segmented');
    for (const level of Object.keys(PRODUCTION.malting.peat) as PeatLevel[]) {
      row.append(
        this.button(
          t(`peat.${level}` as MessageKey),
          () => this.run({ type: 'setPeat', roomId: machine.roomId, peat: level }),
          {
            active: machine.peat === level,
          },
        ),
      );
    }
    const cost = PRODUCTION.malting.peat[machine.peat].costPerTonne;
    const note = free ? t('peat.free') : t('peat.cost', { cost: formatMoney(cost) });
    return this.section(t('peat.title'), row, note);
  }

  private fermentationSection(machine: FermentationMachine): HTMLElement {
    const row = el('div', 'segmented');
    row.append(
      this.button(
        t('fermentation.short'),
        () => this.run({ type: 'setLongFermentation', roomId: machine.roomId, long: false }),
        {
          active: !machine.long,
        },
      ),
      this.button(
        t('fermentation.long'),
        () => this.run({ type: 'setLongFermentation', roomId: machine.roomId, long: true }),
        {
          active: machine.long,
        },
      ),
    );
    const vessels = el('div');
    machine.vessels.forEach((vessel, i) => {
      const text = !vessel
        ? t('fermentation.vesselEmpty')
        : isDone(vessel)
          ? t('fermentation.vesselReady', { litres: formatNumber(vessel.amount) })
          : t('fermentation.vesselBusy', {
              litres: formatNumber(vessel.amount),
              time: formatShortDuration(remainingHours(vessel)),
            });
      vessels.append(this.stockLine('fermentation.vessel', text));
      vessels.lastElementChild!.firstElementChild!.textContent = t('fermentation.vessel', {
        n: i + 1,
      });
    });
    return this.section(t('fermentation.title'), row, vessels);
  }

  private stillSections(machine: StillMachine): HTMLElement[] {
    const state = this.game.state;
    const { distillation } = PRODUCTION;
    if (machine.stills === 'ruined' || machine.stills === 'none') {
      const ruined = machine.stills === 'ruined';
      const cost = ruined ? distillation.restoreOldStillsCost : distillation.stills.small.cost;
      return [
        this.section(
          t('stills.title'),
          t(ruined ? 'stills.ruined' : 'stills.none'),
          this.button(
            t(ruined ? 'stills.restore' : 'stills.buy', { cost: formatMoney(cost) }),
            () =>
              this.run(
                { type: ruined ? 'restoreStills' : 'buyStills', roomId: machine.roomId },
                t('stills.ready'),
              ),
            { disabled: cost > state.finance.cash, small: false },
          ),
        ),
      ];
    }
    const cuts = el('div', 'segmented');
    for (const cut of Object.keys(distillation.cuts) as Cut[]) {
      cuts.append(
        this.button(
          t(`cut.${cut}` as MessageKey),
          () => this.run({ type: 'setCut', roomId: machine.roomId, cut }),
          {
            active: machine.cut === cut,
          },
        ),
      );
    }
    return [
      this.section(t('stills.title'), t('stills.small')),
      this.section(t('cut.title'), cuts),
      this.ordersSection(machine),
      this.newMakeSection(),
    ];
  }

  private newMakeSection(): HTMLElement {
    const { newMake } = this.game.state.stocks;
    const section = this.section(t('stock.newMake'));
    section.append(
      this.stockLine('stock.newMake', t('stock.lpa', { amount: amount(newMake.amount) })),
    );
    if (newMake.amount > 0) {
      section.append(profileBars(newMake.profile));
      const value = newMakeValue(newMake.amount);
      section.append(
        this.button(
          t('market.sellAll', { amount: formatMoney(value) }),
          () =>
            this.run(
              { type: 'sellNewMake', lpa: newMake.amount },
              t('market.sold', { amount: formatMoney(value) }),
            ),
          { small: false },
        ),
      );
    }
    return section;
  }

  forField(fieldId: number): PanelContent | null {
    const state = this.game.state;
    const index = state.fields.findIndex((f) => f.id === fieldId);
    const field = state.fields[index];
    if (!field) return null;
    const body = el('div', 'panel');
    const crop = field.crop;
    const hour = state.time.hour;
    if (crop && isRipe(crop, hour)) {
      body.append(
        el(
          'p',
          'panel-status running',
          t('field.ripe', { variety: t(`variety.${crop.variety}` as MessageKey) }),
        ),
      );
      body.append(
        this.button(
          t('field.harvest'),
          () => {
            const before = state.stocks.barley.amount;
            const result = this.game.execute({ type: 'harvestField', fieldId });
            if (!result.ok) showToast(t(`error.${result.error}` as MessageKey));
            else
              showToast(
                t('field.harvested', {
                  tonnes: amount(this.game.state.stocks.barley.amount - before),
                }),
              );
          },
          { small: false },
        ),
        el('p', 'panel-desc', t('field.autoHarvest')),
      );
    } else if (crop) {
      body.append(
        el(
          'p',
          'panel-status',
          t('field.growing', {
            variety: t(`variety.${crop.variety}` as MessageKey),
            progress: Math.round(growth(crop, hour) * 100),
          }),
        ),
      );
    } else {
      body.append(
        el(
          'p',
          'panel-desc',
          field.lastHarvest
            ? t('field.stubble', { tonnes: amount(field.lastHarvest.tonnes) })
            : t('field.fallow'),
        ),
      );
      if (canSowAt(hour)) {
        const list = el('div', 'variety-list');
        for (const variety of Object.keys(BARLEY_VARIETIES) as BarleyVariety[]) {
          const cost = seedCost(variety);
          const card = el('div', 'variety-card');
          card.append(
            el('strong', '', t(`variety.${variety}` as MessageKey)),
            el('span', '', t(`variety.desc.${variety}` as MessageKey)),
            this.button(
              t('field.sowButton', { cost: formatMoney(cost) }),
              () => this.run({ type: 'sowField', fieldId, variety }, t('field.sown')),
              { disabled: cost > state.finance.cash },
            ),
          );
          list.append(card);
        }
        body.append(this.section(t('field.sowTitle'), list));
      } else {
        body.append(el('p', 'panel-desc', t('field.notSeason')));
      }
    }
    return { title: t('field.title', { n: index + 1 }), body };
  }

  /** Onglet Production : réserves, état des machines, orge du marché. */
  overview(): PanelContent {
    const state = this.game.state;
    const body = el('div', 'panel');
    const wash = state.machines.reduce(
      (sum, m) =>
        sum + (m.kind === 'fermentation' ? m.vessels.reduce((s, v) => s + (v?.amount ?? 0), 0) : 0),
      0,
    );
    const stocks = this.section(
      t('stock.title'),
      this.stockLine(
        'stock.barley',
        t('stock.tonnes', { amount: amount(state.stocks.barley.amount) }),
      ),
      this.stockLine('stock.malt', t('stock.tonnes', { amount: amount(state.stocks.malt.amount) })),
      this.stockLine('stock.wash', t('stock.litres', { amount: formatNumber(wash) })),
      this.stockLine(
        'stock.newMake',
        t('stock.lpa', { amount: amount(state.stocks.newMake.amount) }),
      ),
    );
    if (state.stocks.newMake.amount > 0) stocks.append(profileBars(state.stocks.newMake.profile));
    body.append(stocks);

    const machines = this.section(t('production.machines'));
    const working = state.machines.filter(
      (m) => !state.building.rooms.find((r) => r.id === m.roomId)?.ruined,
    );
    if (working.length === 0) machines.append(el('p', 'panel-desc', t('production.empty')));
    for (const machine of working) {
      const room = state.building.rooms.find((r) => r.id === machine.roomId)!;
      machines.append(
        this.stockLine(`room.${room.type}` as MessageKey, machineStatus(state, machine).text),
      );
    }
    body.append(machines, this.barleySection());
    return { title: t('production.title'), body };
  }

  /** Malt vendu à la distillerie voisine : de l'argent dès la malterie restaurée. */
  private maltSection(): HTMLElement {
    const { malt } = this.game.state.stocks;
    const value = (tonnes: number) => Math.round(tonnes * MARKET.maltPricePerTonne * 100) / 100;
    const section = this.section(
      t('market.maltTitle'),
      t('market.maltDesc', { price: formatMoney(MARKET.maltPricePerTonne) }),
      this.stockLine('stock.malt', t('stock.tonnes', { amount: amount(malt.amount) })),
    );
    if (malt.amount <= 0) {
      section.append(el('p', 'panel-desc', t('market.noMalt')));
      return section;
    }
    const row = el('div', 'button-row');
    for (const tonnes of new Set([Math.min(1, malt.amount), malt.amount])) {
      row.append(
        this.button(
          t('market.sellMalt', { tonnes: amount(tonnes), amount: formatMoney(value(tonnes)) }),
          () =>
            this.run(
              { type: 'sellMalt', tonnes },
              t('market.sold', { amount: formatMoney(value(tonnes)) }),
            ),
        ),
      );
    }
    section.append(row);
    return section;
  }

  /** Rappel du courtier en fûts (la vente se fait depuis la fiche du fût). */
  private brokerLine(): HTMLElement {
    const broker = MARKET.caskBroker;
    const left = Math.max(0, broker.casksPerMonth - this.game.state.market.casksSoldThisMonth);
    return this.section(t('market.brokerTitle'), t('market.brokerDesc', { left }));
  }

  /** Gin vendu aux cavistes : prix plein moins l'accise, volume plafonné chaque mois. */
  private ginSection(): HTMLElement {
    const { stocks, market } = this.game.state;
    const left = Math.max(0, MARKET.retailMonthlyBottles - market.retailBottlesThisMonth);
    const section = this.section(
      t('market.ginTitle'),
      t('market.ginDesc', {
        price: formatMoney(GIN.price),
        excise: formatMoney(EXCISE.perUkBottle),
        left,
      }),
      this.stockLine('stock.gin', t('stock.bottles', { amount: formatNumber(stocks.gin) })),
    );
    const sellable = Math.min(stocks.gin, left);
    if (sellable <= 0) {
      section.append(
        el('p', 'panel-desc', t(stocks.gin > 0 ? 'error.retailCapReached' : 'market.noGin')),
      );
      return section;
    }
    const net = (bottles: number) => bottles * GIN.price - exciseFor('retail', bottles);
    const row = el('div', 'button-row');
    for (const bottles of new Set([Math.min(50, sellable), sellable])) {
      row.append(
        this.button(t('market.sellGin', { bottles, amount: formatMoney(net(bottles)) }), () =>
          this.run(
            { type: 'sellGin', bottles },
            t('market.sold', { amount: formatMoney(net(bottles)) }),
          ),
        ),
      );
    }
    section.append(row);
    return section;
  }

  private barleySection(): HTMLElement {
    const price = barleyPrice(this.game.state.time.hour);
    const row = el('div', 'button-row');
    for (const tonnes of [4, 10, 20]) {
      const cost = Math.round(price * tonnes);
      row.append(
        this.button(
          t('market.buyBarley', { tonnes, cost: formatMoney(cost) }),
          () => this.run({ type: 'buyBarley', tonnes }, t('market.bought', { tonnes })),
          { disabled: cost > this.game.state.finance.cash },
        ),
      );
    }
    return this.section(
      t('market.barleyTitle'),
      t('market.barleyDesc', { price: formatMoney(price) }),
      row,
    );
  }

  /** Onglet Marché : vente du new make aux assembleurs (les autres canaux viendront plus tard). */
  market(): PanelContent {
    const { newMake } = this.game.state.stocks;
    const body = el('div', 'panel');
    const section = this.section(
      t('market.newMakeTitle'),
      t('market.newMakeDesc', { price: formatMoney(MARKET.newMakePricePerLpa) }),
      this.stockLine('stock.newMake', t('stock.lpa', { amount: amount(newMake.amount) })),
    );
    if (newMake.amount > 0) {
      const row = el('div', 'button-row');
      const some = Math.min(100, newMake.amount);
      row.append(
        this.button(
          t('market.sellSome', { lpa: amount(some), amount: formatMoney(newMakeValue(some)) }),
          () =>
            this.run(
              { type: 'sellNewMake', lpa: some },
              t('market.sold', { amount: formatMoney(newMakeValue(some)) }),
            ),
        ),
        this.button(
          t('market.sellAll', { amount: formatMoney(newMakeValue(newMake.amount)) }),
          () =>
            this.run(
              { type: 'sellNewMake', lpa: newMake.amount },
              t('market.sold', { amount: formatMoney(newMakeValue(newMake.amount)) }),
            ),
        ),
      );
      section.append(row);
    } else {
      section.append(el('p', 'panel-desc', t('market.noNewMake')));
    }
    body.append(section, this.maltSection(), this.ginSection(), this.brokerLine());
    body.append(this.barleySection());
    body.append(el('p', 'panel-desc', t('market.later')));
    return { title: t('market.title'), body };
  }
}
