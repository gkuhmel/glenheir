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
