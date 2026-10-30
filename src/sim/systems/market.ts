import { MARKET } from '../../data/balance';
import { roundMoney } from '../journal';
import { toGameDate } from '../time';

/** Prix de la tonne d'orge au marché selon la saison (chère avant la moisson). */
export function barleyPrice(hour: number): number {
  return roundMoney(MARKET.barleyPricePerTonne * MARKET.barleySeason[toGameDate(hour).season]);
}

export function newMakeValue(lpa: number): number {
  return roundMoney(lpa * MARKET.newMakePricePerLpa);
}

/** Jauges de demande : gin chez les cavistes, whisky chez les cavistes et à l'export. */
export type DemandKey = keyof typeof MARKET.demand.capacity;

export const emptySaturation = (): Record<DemandKey, number> => ({
  ginRetail: 0,
  whiskyRetail: 0,
  whiskyExport: 0,
});

/** Facteur de prix d'une bouteille vendue quand la jauge en est à `saturation`. */
export function demandFactor(key: DemandKey, saturation: number): number {
  const { capacity, maxDiscount } = MARKET.demand;
  return Math.max(1 - maxDiscount, 1 - (maxDiscount * saturation) / capacity[key]);
}

/**
 * Recette brute de `bottles` bouteilles au prix plein `unit` : chaque bouteille
 * remplit un peu la jauge, la suivante se vend un peu moins cher.
 */
export function saleGross(
  saturation: Record<DemandKey, number>,
  key: DemandKey,
  unit: number,
  bottles: number,
): number {
  let total = 0;
  for (let i = 0; i < bottles; i++) total += unit * demandFactor(key, saturation[key] + i);
  return roundMoney(total);
}

/** La demande se reconstitue : chaque jour, les jauges se vident de 3 %. */
export function recoverDemand(saturation: Record<DemandKey, number>): void {
  for (const key of Object.keys(saturation) as DemandKey[])
    saturation[key] *= 1 - MARKET.demand.dailyRecovery;
}
