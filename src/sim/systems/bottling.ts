import { BOTTLING, CASKS, MARKET } from '../../data/balance';
import { blend, type Profile } from '../profile';
import type { GameState } from '../state';
import type { DemandKey } from './market';
import { ageYears, caskProfile, type Cask, type CaskType } from './warehouse';

/** Une mise en bouteille : un fût (single cask) ou un assemblage de fûts. */
export interface Bottling {
  id: number;
  /** Âge sur l'étiquette : celui du plus jeune fût, en années entières. */
  ageYears: number;
  /** Nombre de fûts assemblés ; le numéro du fût pour un single cask. */
  casks: number;
  singleCaskId: number | null;
  caskTypes: CaskType[];
  profile: Profile;
  /** Facteur de prix des fûts (sherry ×1,2), pondéré par le volume. */
  caskFactor: number;
  bottled: number;
  /** Bouteilles qui restent à vendre. */
  stock: number;
  bottledHour: number;
  /** Graine de la note de dégustation (le texte est rédigé par l'interface). */
  noteSeed: number;
}

export type WhiskyChannel = 'retail' | 'export';

/** Ce qu'on obtient en mettant ces fûts en bouteille (sans rien modifier). */
export function prepareBottling(
  state: GameState,
  casks: readonly Cask[],
): Omit<Bottling, 'id' | 'bottledHour' | 'noteSeed'> {
  const hour = state.time.hour;
  let profile = caskProfile(casks[0]!);
  let lpa = casks[0]!.lpa;
  let factor = CASKS.types[casks[0]!.type].priceFactor * lpa;
  for (const cask of casks.slice(1)) {
    profile = blend(profile, lpa, caskProfile(cask), cask.lpa);
    lpa += cask.lpa;
    factor += CASKS.types[cask.type].priceFactor * cask.lpa;
  }
  const bottles = Math.floor(lpa / BOTTLING.lpaPerBottle + 1e-9);
  return {
    ageYears: Math.floor(Math.min(...casks.map((c) => ageYears(c, hour))) + 1e-9),
    casks: casks.length,
    singleCaskId: casks.length === 1 ? casks[0]!.id : null,
    caskTypes: [...new Set(casks.map((c) => c.type))],
    profile,
    caskFactor: factor / lpa,
    bottled: bottles,
    stock: bottles,
  };
}

/** Prix de base selon l'âge, interpolé entre les paliers. */
export function agePrice(years: number): number {
  const steps = BOTTLING.agePrices;
  if (years <= steps[0]!.years) return steps[0]!.price;
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1]!;
    const b = steps[i]!;
    if (years <= b.years)
      return a.price + ((b.price - a.price) * (years - a.years)) / (b.years - a.years);
  }
  return steps.at(-1)!.price;
}

/**
 * Prix plein d'une bouteille sur un canal, avant l'effet de saturation :
 * âge × qualité × renommée × fût, et 70 % à l'export.
 */
export function whiskyUnitPrice(
  state: GameState,
  bottling: Pick<Bottling, 'ageYears' | 'profile' | 'caskFactor'>,
  channel: WhiskyChannel,
): number {
  const quality = BOTTLING.quality.base + BOTTLING.quality.perPoint * bottling.profile.quality;
  const renown = 1 + state.renown / BOTTLING.renownDivisor;
  const export_ = channel === 'export' ? MARKET.export.priceFactor : 1;
  return agePrice(bottling.ageYears) * quality * renown * bottling.caskFactor * export_;
}

export const demandKeyOf = (channel: WhiskyChannel): DemandKey =>
  channel === 'export' ? 'whiskyExport' : 'whiskyRetail';

/** Renommée gagnée en vendant ces bouteilles (seul un bon whisky fait parler de lui). */
export function renownGain(quality: number, bottles: number, channel: WhiskyChannel): number {
  const r = BOTTLING.renown;
  if (quality < r.minQuality) return 0;
  return bottles * (quality - r.pivot) * r.perPoint * (channel === 'export' ? r.exportShare : 1);
}
