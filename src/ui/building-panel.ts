import type { Game } from '../app/game';
import { BUILDING } from '../data/balance';
import { ROOM_TYPES, type RoomType } from '../data/content';
import { formatMoney, t, type MessageKey } from '../i18n';
import type { InteriorSelection } from '../render/interior/interior-scene';
import type { Command } from '../sim/commands';
import { buildCost, restoreCost, roomGroups, slotCost } from '../sim/systems/building';
import { ProductionPanels } from './production-panels';
import { showToast } from './toast';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const roomName = (type: RoomType | null) => t(type ? (`room.${type}` as MessageKey) : 'room.empty');

export interface PanelContent {
  title: string;
  body: HTMLElement;
}

/** Contenu du tiroir pour ce qu'on a touché dans la scène : salle, emplacement ou chai. */
export class BuildingPanel {
  private readonly production: ProductionPanels;

  constructor(private readonly game: Game) {
    this.production = new ProductionPanels(game);
  }

  /** Exécute une commande et annonce le résultat ; renvoie vrai si elle a réussi. */
  private run(command: Command, success: string): boolean {
    const result = this.game.execute(command);
    showToast(result.ok ? success : t(`error.${result.error}` as MessageKey));
    return result.ok;
  }

  private action(label: string, onClick: () => void, cost: number): HTMLButtonElement {
    const button = el('button', 'parchment-button', label);
    button.type = 'button';
    button.disabled = cost > this.game.state.finance.cash;
    button.addEventListener('click', onClick);
    return button;
  }

  private cashLine(): HTMLElement {
    return el(
      'p',
      'panel-cash',
      t('building.cash', { amount: formatMoney(this.game.state.finance.cash) }),
    );
  }

  forSelection(selection: InteriorSelection): PanelContent | null {
    return selection.kind === 'room'
      ? this.forRoom(selection.roomId)
      : this.forSlot(selection.col, selection.level);
  }

  private forRoom(roomId: number): PanelContent | null {
    const { building } = this.game.state;
    const room = building.rooms.find((r) => r.id === roomId);
    if (!room) return null;
    const body = el('div', 'panel');
    const title = roomName(room.type);
    body.append(
      el(
        'p',
        'panel-desc',
        t(room.type ? (`room.desc.${room.type}` as MessageKey) : 'room.desc.empty'),
      ),
    );

    if (room.type && room.ruined) {
      const cost = restoreCost(room.type);
      body.append(el('p', 'panel-status warning', t('building.ruined')));
      body.append(
        this.action(
          t('building.restore', { cost: formatMoney(cost) }),
          () => this.run({ type: 'restoreRoom', roomId }, t('building.restored', { room: title })),
          cost,
        ),
      );
      body.append(this.cashLine());
    } else if (room.type) {
      const machine = this.game.state.machines.find((m) => m.roomId === roomId);
      if (machine) body.append(...this.production.machineSections(machine));
      else body.append(el('p', 'panel-status', t('building.working')));
      const group = roomGroups(building).find((g) => g.roomIds.includes(roomId));
      if (group && group.cols.length > 1) {
        body.append(
          el(
            'p',
            'panel-status',
            t('building.merged', {
              count: group.cols.length,
              bonus: Math.round(BUILDING.mergeBonus * 100 * (group.cols.length - 1)),
            }),
          ),
        );
      }
    } else {
      body.append(el('h3', '', t('building.buildTitle')));
      const grid = el('div', 'build-grid');
      for (const type of ROOM_TYPES) {
        const cost = buildCost(type);
        grid.append(
          this.action(
            t('building.build', { room: roomName(type), cost: formatMoney(cost) }),
            () =>
              this.run(
                { type: 'buildRoom', roomId, roomType: type },
                t('building.built', { room: roomName(type) }),
              ),
            cost,
          ),
        );
      }
      body.append(grid, this.cashLine());
    }
    return { title, body };
  }

  private forSlot(col: number, level: number): PanelContent {
    const body = el('div', 'panel');
    const cost = slotCost(this.game.state.building);
    body.append(el('p', 'panel-desc', t(`building.buyLevel.${level}` as MessageKey)));
    body.append(
      this.action(
        t('building.buy', { cost: formatMoney(cost) }),
        () => this.run({ type: 'buySlot', col, level }, t('building.bought')),
        cost,
      ),
    );
    body.append(this.cashLine());
    return { title: t('building.buyTitle'), body };
  }
}
