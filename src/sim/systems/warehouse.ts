import {
  BASE_PROFILE,
  CASKS,
  INHERITED_CASKS,
  MARKET,
  TERROIRS,
  WAREHOUSE,
} from '../../data/balance';
import { roundMoney } from '../journal';
import { applyModifier, PROFILE_AXES, type Profile } from '../profile';
import type { GameState } from '../state';
import type { SimEvent } from '../tick';
import { HOURS_PER_YEAR } from '../time';
import type { Warehouse } from './building';

export type CaskType = keyof typeof CASKS.types;

/** Un fût dans un chai : son emplacement, son esprit d'origine et son vieillissement. */
export interface Cask {
  id: number;
  warehouseId: number;
  /** Emplacement dans le chai : colonne = place / 3, hauteur = place % 3 (0 = en bas). */
  place: number;
  type: CaskType;
  /** 1 = premier remplissage, 2 = fût de réemploi (effets réduits de moitié). */
  fill: 1 | 2;
  filledHour: number;
  /** Âge de maturation (heures pondérées par la vitesse du fût et de la hauteur). */
  maturedHours: number;
  /** Alcool pur restant, après la part des anges. */
  lpa: number;
  initialLpa: number;
  /** Profil du new make au moment de la mise en fût. */
  spirit: Profile;
  /** Décalage caché de l'estimation de qualité, sans maître de chai. */
  hint: number;
  /** Fût laissé par le grand-oncle (rempli avant le début de la partie). */
  inherited?: true;
}

export const tierOf = (place: number): number => place % WAREHOUSE.tiers;
export const columnOf = (place: number): number => Math.floor(place / WAREHOUSE.tiers);

/** Contenance d'un fût en litres d'alcool pur. */
export function caskCapacityLpa(type: CaskType): number {
  return Math.round(CASKS.types[type].litres * CASKS.fillStrength * 10) / 10;
}

export function extensionsOf(warehouse: Warehouse): number {
  return Math.round((warehouse.places - WAREHOUSE.startPlaces) / WAREHOUSE.extensionPlaces);
}

/** Âge réel du fût, en années (pour l'âge légal et l'étiquette). */
export function ageYears(cask: Cask, hour: number): number {
  return (hour - cask.filledHour) / HOURS_PER_YEAR;
}

/** Avancement de la maturation, de 0 à 1 (courbe 1 − e^(−âge/τ)). */
export function maturation(cask: Cask): number {
  const years = cask.maturedHours / HOURS_PER_YEAR;
  return 1 - Math.exp(-years / CASKS.types[cask.type].tauYears);
}

/**
 * Profil actuel du whisky : le new make d'origine, enrichi par le bois au fil
 * de la maturation. La qualité plafonne ; le chêne neuf se dégrade s'il est trop vieux.
 */
export function caskProfile(cask: Cask): Profile {
  const type = CASKS.types[cask.type];
  const effect = maturation(cask) * (cask.fill === 2 ? CASKS.refillEffect : 1);
  const modifier: Partial<Profile> = {};
  for (const axis of PROFILE_AXES) {
    const gain = (type.profile as Partial<Profile>)[axis];
    if (gain) modifier[axis] = gain * effect;
  }
  let quality = (type.quality + CASKS.tiers[tierOf(cask.place)]!.quality) * effect;
  if (cask.type === 'newOak') {
    const years = cask.maturedHours / HOURS_PER_YEAR;
    const over = years - CASKS.newOakOverage.afterYears;
    if (over > 0) quality -= over * CASKS.newOakOverage.qualityPerYear;
  }
  modifier.quality = quality;
  return applyModifier(cask.spirit, modifier);
}

/** Fourchette de qualité affichée sans maître de chai (la vraie valeur y figure toujours). */
export function qualityEstimate(cask: Cask): { low: number; high: number } {
  const quality = caskProfile(cask).quality;
  const center = quality + cask.hint;
  return {
    low: Math.max(0, Math.round(center - CASKS.estimateSpread)),
    high: Math.min(100, Math.round(center + CASKS.estimateSpread)),
  };
}

/** Part des anges annuelle d'un fût : bien plus forte sous le toit percé d'un chai en ruine. */
export function angelsShareOf(state: GameState, cask: Cask): number {
  const warehouse = state.warehouses.find((w) => w.id === cask.warehouseId);
  return warehouse?.ruined ? WAREHOUSE.ruinedAngelsShare : TERROIRS[state.terroir].angelsShare;
}

/** Une heure au chai : maturation selon le fût et la hauteur, part des anges, anniversaires. */
export function runWarehouses(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const legalHours = CASKS.legalAgeYears * HOURS_PER_YEAR;
  for (const cask of state.casks) {
    cask.maturedHours += CASKS.types[cask.type].speed * CASKS.tiers[tierOf(cask.place)]!.speed;
    cask.lpa *= (1 - angelsShareOf(state, cask)) ** (1 / HOURS_PER_YEAR);
    if (state.time.hour - cask.filledHour === legalHours) {
      events.push({
        type: 'caskMatured',
        hour: state.time.hour,
        caskId: cask.id,
        years: CASKS.legalAgeYears,
      });
    }
  }
  return events;
}

/** Fait vieillir tous les fûts d'un coup (outil de test). */
export function ageAllCasks(state: GameState, hours: number): void {
  for (const cask of state.casks) {
    cask.maturedHours +=
      hours * CASKS.types[cask.type].speed * CASKS.tiers[tierOf(cask.place)]!.speed;
    cask.filledHour -= hours;
    cask.lpa *= (1 - angelsShareOf(state, cask)) ** (hours / HOURS_PER_YEAR);
  }
}

/**
 * Prix proposé par le courtier pour un fût entier : LPA restants × prix du LPA à
 * cet âge × facteur du fût. Il n'achète que du whisky (3 ans et plus).
 */
export function caskValue(cask: Cask, hour: number): number {
  const broker = MARKET.caskBroker;
  const perLpa =
    broker.pricePerLpaAt8Years * (1 + broker.growthPerYear) ** (ageYears(cask, hour) - 8);
  return roundMoney(cask.lpa * perLpa * CASKS.types[cask.type].priceFactor);
}

/**
 * Fûts du grand-oncle, rangés dans un coin du premier chai (les places déjà
 * prises sont sautées). Ils ont vieilli normalement avant le début de la partie.
 */
export function createInheritedCasks(state: GameState): Cask[] {
  const warehouse = state.warehouses[0];
  if (!warehouse) return [];
  const casks: Cask[] = [];
  for (const spec of INHERITED_CASKS) {
    if (state.casks.some((c) => c.warehouseId === warehouse.id && c.place === spec.place)) continue;
    const hours = spec.years * HOURS_PER_YEAR;
    const initialLpa = caskCapacityLpa(spec.type);
    casks.push({
      id: state.nextId++,
      warehouseId: warehouse.id,
      place: spec.place,
      type: spec.type,
      fill: 1,
      filledHour: state.time.hour - hours,
      maturedHours: hours * CASKS.types[spec.type].speed * CASKS.tiers[tierOf(spec.place)]!.speed,
      lpa: Math.round(initialLpa * (1 - CASKS.inheritedAngelsShare) ** spec.years * 10) / 10,
      initialLpa,
      spirit: { ...BASE_PROFILE },
      hint: spec.hint,
      inherited: true,
    });
  }
  return casks;
}
