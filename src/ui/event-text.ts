import { t, type MessageKey } from '../i18n';
import type { SimEvent } from '../sim/tick';

/** Phrase à montrer au joueur pour un événement, ou null s'il n'est pas affiché. */
export function describeEvent(event: SimEvent): string | null {
  switch (event.type) {
    case 'seasonStarted':
      return t(`event.season.${event.season}` as MessageKey);
    case 'yearStarted':
      return t('event.yearStarted', { year: event.year });
    case 'loanRepaid':
      return t('event.loanRepaid');
    case 'bankruptcyWarning':
      return t('event.bankruptcyWarning', { months: event.monthsLeft });
    case 'bankrupt':
      return t('event.bankrupt');
    case 'fieldRipe':
      return t('event.fieldRipe');
    case 'caskMatured':
      return t('event.caskMatured');
    case 'bottled':
      return t('event.bottled', { bottles: event.bottles });
    case 'employeeQuit':
      return t('event.employeeQuit', {
        name: event.name,
        role: t(`staff.role.${event.role}` as MessageKey),
      });
    case 'levelUp':
      return t('event.levelUp', { name: event.name, level: event.level });
    case 'trainingDone':
      return t('event.trainingDone', { name: event.name, level: event.level });
    default:
      return null;
  }
}
