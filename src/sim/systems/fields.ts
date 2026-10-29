import { BARLEY_VARIETIES, FIELDS, TERROIRS } from '../../data/balance';
import { addToLot, applyModifier, baseProfile } from '../profile';
import type { Rng } from '../rng';
import type { GameState } from '../state';
import type { SimEvent } from '../tick';
import { nextDateHour, toGameDate } from '../time';

export type BarleyVariety = keyof typeof BARLEY_VARIETIES;

export interface Crop {
  variety: BarleyVariety;
  sownHour: number;
  /** Heure à laquelle l'orge est mûre (15 août). */
  ripeHour: number;
}

/** Une parcelle de 1 ha. */
export interface Field {
  id: number;
  crop: Crop | null;
  /** Dernière récolte, pour l'affichage (chaume jusqu'au prochain semis). */
  lastHarvest: { hour: number; tonnes: number } | null;
}

export function createStartingFields(firstId: number): Field[] {
  return Array.from({ length: FIELDS.startPlots }, (_, i) => ({
    id: firstId + i,
    crop: null,
    lastHarvest: null,
  }));
}

export function canSowAt(hour: number): boolean {
  return (FIELDS.sowMonths as readonly number[]).includes(toGameDate(hour).month);
}

export function seedCost(variety: BarleyVariety): number {
  return BARLEY_VARIETIES[variety].seedCostPerHectare * FIELDS.hectaresPerPlot;
}

export function sow(state: GameState, field: Field, variety: BarleyVariety): void {
  const hour = state.time.hour;
  field.crop = {
    variety,
    sownHour: hour,
    ripeHour: nextDateHour(hour, FIELDS.ripe.month, FIELDS.ripe.day),
  };
  field.lastHarvest = null;
}

export const isRipe = (crop: Crop, hour: number): boolean => hour >= crop.ripeHour;

/** Avancement de la pousse, de 0 (semis) à 1 (mûre). */
export function growth(crop: Crop, hour: number): number {
  return Math.max(0, Math.min(1, (hour - crop.sownHour) / (crop.ripeHour - crop.sownHour)));
}

/** Récolte : 6 t/ha × variété × terroir × météo de l'année (±20 %). */
export function harvest(state: GameState, field: Field, rng: Rng): number {
  const crop = field.crop;
  if (!crop) return 0;
  const variety = BARLEY_VARIETIES[crop.variety];
  const weather = 1 + rng.range(-FIELDS.weatherSpread, FIELDS.weatherSpread);
  const tonnes =
    Math.round(
      FIELDS.hectaresPerPlot *
        FIELDS.tonnesPerHectare *
        variety.yield *
        TERROIRS[state.terroir].barleyYield *
        weather *
        100,
    ) / 100;
  addToLot(state.stocks.barley, tonnes, applyModifier(baseProfile(), variety.profile));
  field.crop = null;
  field.lastHarvest = { hour: state.time.hour, tonnes };
  return tonnes;
}

/** Chaque jour : l'orge mûrit ; au 1er septembre, ce qui n'a pas été récolté l'est d'office. */
export function runFields(state: GameState, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  const hour = state.time.hour;
  const date = toGameDate(hour);
  const autoHarvest =
    date.month === FIELDS.autoHarvest.month && date.day === FIELDS.autoHarvest.day;
  for (const field of state.fields) {
    if (!field.crop) continue;
    if (hour === field.crop.ripeHour) events.push({ type: 'fieldRipe', hour, fieldId: field.id });
    if (autoHarvest && isRipe(field.crop, hour)) {
      const tonnes = harvest(state, field, rng);
      events.push({ type: 'harvested', hour, fieldId: field.id, tonnes });
    }
  }
  return events;
}
