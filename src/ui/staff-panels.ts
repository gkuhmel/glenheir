import type { Game } from '../app/game';
import { STAFF } from '../data/balance';
import { formatMoney, t, type MessageKey } from '../i18n';
import type { Command } from '../sim/commands';
import type { Candidate, Employee, StaffRole } from '../sim/state';
import { monthlyPayroll, salaryOf } from '../sim/systems/finance';
import type { PanelContent } from './building-panel';
import { formatGameDate } from './warehouse-panels';
import { showToast } from './toast';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const roleName = (role: StaffRole) => t(`staff.role.${role}` as MessageKey);
const stars = (level: number) => '★'.repeat(level) + '☆'.repeat(STAFF.maxLevel - level);

/** Humeur lisible : motivé, fatigué, épuisé. */
function moraleLabel(morale: number): string {
  if (morale >= 60) return t('staff.morale.good');
  if (morale >= STAFF.morale.lowThreshold) return t('staff.morale.tired');
  return t('staff.morale.low');
}

/** Tiroirs du personnel : l'équipe, les candidats du mois, la fiche d'un employé. */
export class StaffPanels {
  constructor(private readonly game: Game) {}

  private run(command: Command, success: string): void {
    const result = this.game.execute(command);
    showToast(result.ok ? success : t(`error.${result.error}` as MessageKey));
  }

  private button(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const button = el('button', 'parchment-button small', label);
    button.type = 'button';
    button.disabled = disabled;
    button.addEventListener('click', onClick);
    return button;
  }

  /** Ce que fait l'employé en ce moment. */
  private task(employee: Employee): string {
    const state = this.game.state;
    if (employee.trainingUntil !== null)
      return t('staff.task.training', { date: formatGameDate(employee.trainingUntil) });
    if (employee.roomId !== null) {
      const room = state.building.rooms.find((r) => r.id === employee.roomId);
      return t('staff.task.machine', { room: t(`room.${room?.type}` as MessageKey) });
    }
    if (employee.working && employee.role === 'cellarMaster') return t('staff.task.cellar');
    return t('staff.task.rest');
  }

  private card(employee: Employee): HTMLElement {
    const cash = this.game.state.finance.cash;
    const salary = salaryOf(employee);
    const card = el('div', `staff-card role-${employee.role}`);
    const head = el('div', 'staff-head');
    head.append(el('h4', '', employee.name), el('span', 'staff-stars', stars(employee.level)));
    const morale = el('div', 'staff-morale');
    const bar = el('span', 'profile-bar');
    const fill = el(
      'span',
      `profile-fill morale-fill${employee.morale < STAFF.morale.lowThreshold ? ' is-low' : ''}`,
    );
    fill.style.width = `${Math.round(employee.morale)}%`;
    bar.append(fill);
    morale.append(
      el('span', '', t('staff.morale')),
      bar,
      el('span', '', moraleLabel(employee.morale)),
    );
    const next = STAFF.xpHoursPerLevel * employee.level;
    card.append(
      head,
      el(
        'p',
        'staff-role',
        `${roleName(employee.role)} · ${t('staff.salary', { amount: formatMoney(salary) })}`,
      ),
      el('p', 'staff-task', this.task(employee)),
      morale,
    );
    if (employee.level < STAFF.maxLevel)
      card.append(el('p', 'staff-xp', t('staff.xp', { xp: Math.floor(employee.xp), next })));

    const bonus = Math.round(salary * STAFF.morale.bonusSalaryShare);
    const training = salary * STAFF.training.salaryMonths;
    const severance = salary * STAFF.hiring.severanceMonths;
    const row = el('div', 'button-row');
    row.append(
      this.button(
        t('staff.bonus', { cost: formatMoney(bonus) }),
        () =>
          this.run(
            { type: 'giveBonus', employeeId: employee.id },
            t('staff.bonusDone', { name: employee.name }),
          ),
        bonus > cash || employee.morale >= 100,
      ),
      this.button(
        t('staff.train', { cost: formatMoney(training) }),
        () =>
          this.run(
            { type: 'train', employeeId: employee.id },
            t('staff.trainDone', { name: employee.name, days: STAFF.training.days }),
          ),
        training > cash || employee.level >= STAFF.maxLevel || employee.trainingUntil !== null,
      ),
      this.button(
        t('staff.fire', { cost: formatMoney(severance) }),
        () => {
          if (!window.confirm(t('staff.fireConfirm', { name: employee.name }))) return;
          this.run(
            { type: 'fire', employeeId: employee.id },
            t('staff.fired', { name: employee.name }),
          );
        },
        severance > cash,
      ),
    );
    card.append(row);
    return card;
  }

  private candidateCard(candidate: Candidate): HTMLElement {
    const salary = salaryOf(candidate);
    const cost = salary * STAFF.hiring.salaryMonths;
    const card = el('div', `staff-card candidate role-${candidate.role}`);
    const head = el('div', 'staff-head');
    head.append(el('h4', '', candidate.name), el('span', 'staff-stars', stars(candidate.level)));
    card.append(
      head,
      el(
        'p',
        'staff-role',
        `${roleName(candidate.role)} · ${t('staff.salary', { amount: formatMoney(salary) })}`,
      ),
      this.button(
        t('staff.hire', { cost: formatMoney(cost) }),
        () =>
          this.run(
            { type: 'hire', candidateId: candidate.id },
            t('staff.hired', { name: candidate.name, role: roleName(candidate.role) }),
          ),
        cost > this.game.state.finance.cash,
      ),
    );
    return card;
  }

  /** Onglet Équipe : les employés, puis les candidats du mois par rôle. */
  overview(): PanelContent {
    const state = this.game.state;
    const body = el('div', 'panel');
    const team = el('section', 'panel-section');
    team.append(
      el('h3', '', t('staff.team')),
      el('p', 'panel-status', t('staff.payroll', { amount: formatMoney(monthlyPayroll(state)) })),
    );
    if (state.staff.length === 0) team.append(el('p', 'panel-desc', t('staff.nobody')));
    for (const employee of state.staff) team.append(this.card(employee));
    body.append(team);

    const hiring = el('section', 'panel-section');
    hiring.append(
      el('h3', '', t('staff.candidates')),
      el('p', 'panel-desc', t('staff.candidatesDesc')),
    );
    for (const role of STAFF.hireableRoles) {
      const candidates = state.candidates.filter((c) => c.role === role);
      hiring.append(el('h4', 'staff-role-title', roleName(role)));
      hiring.append(el('p', 'panel-desc', t(`staff.roleDesc.${role}` as MessageKey)));
      if (candidates.length === 0) hiring.append(el('p', 'panel-desc', t('staff.noCandidate')));
      for (const candidate of candidates) hiring.append(this.candidateCard(candidate));
    }
    body.append(hiring);
    return { title: t('staff.title'), body };
  }

  /** Fiche d'un employé touché dans une scène. */
  forEmployee(employeeId: number): PanelContent | null {
    const employee = this.game.state.staff.find((e) => e.id === employeeId);
    if (!employee) return null;
    const body = el('div', 'panel');
    body.append(
      el('p', 'panel-desc', t(`staff.roleDesc.${employee.role}` as MessageKey)),
      this.card(employee),
    );
    return { title: employee.name, body };
  }
}
