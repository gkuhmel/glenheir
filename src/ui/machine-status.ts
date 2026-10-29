import { PRODUCTION } from '../data/balance';
import { formatShortDuration, t } from '../i18n';
import type { GameState } from '../sim/state';
import { isDone, remainingHours, type Machine } from '../sim/systems/production';

export interface MachineStatus {
  text: string;
  /** La machine travaille (animations, fumée). */
  running: boolean;
}

/** État lisible d'une machine, pour les badges des scènes et les panneaux. */
export function machineStatus(state: GameState, machine: Machine): MachineStatus {
  const stopped = { text: t('machine.stopped'), running: false };
  switch (machine.kind) {
    case 'malting':
      if (machine.batch) {
        return {
          text: t('machine.malting.running', {
            time: formatShortDuration(remainingHours(machine.batch)),
          }),
          running: true,
        };
      }
      if (machine.orders === 0) return stopped;
      return { text: t('machine.waitBarley'), running: false };
    case 'mashing':
      if (machine.batch && isDone(machine.batch))
        return { text: t('machine.waitVessel'), running: false };
      if (machine.batch) {
        return {
          text: t('machine.mashing.running', {
            time: formatShortDuration(remainingHours(machine.batch)),
          }),
          running: true,
        };
      }
      if (machine.orders === 0) return stopped;
      return {
        text:
          state.stocks.malt.amount < PRODUCTION.mashing.minTonnes
            ? t('machine.waitMalt')
            : t('machine.waitVessel'),
        running: false,
      };
    case 'fermentation': {
      const busy = machine.vessels.filter((v) => v && !isDone(v)).length;
      const ready = machine.vessels.filter((v) => v && isDone(v)).length;
      if (busy + ready === 0) return { text: t('machine.vesselsEmpty'), running: false };
      return { text: t('machine.fermenting', { busy, ready }), running: busy > 0 };
    }
    case 'distillation':
      if (machine.stills === 'ruined') return { text: t('machine.stillsRuined'), running: false };
      if (machine.stills === 'none') return { text: t('machine.noStills'), running: false };
      if (machine.batch) {
        return {
          text: t('machine.distillation.running', {
            time: formatShortDuration(remainingHours(machine.batch)),
          }),
          running: true,
        };
      }
      if (machine.orders === 0) return stopped;
      return { text: t('machine.waitWash'), running: false };
  }
}
