import { BASE_PROFILE } from '../data/balance';

/** Profil aromatique : 6 axes notés de 0 à 100, plus la qualité. */
export interface Profile {
  fruity: number;
  floral: number;
  peaty: number;
  spicy: number;
  woody: number;
  sweet: number;
  quality: number;
}

export type ProfileModifier = Partial<Profile>;

export const PROFILE_AXES = [
  'fruity',
  'floral',
  'peaty',
  'spicy',
  'woody',
  'sweet',
  'quality',
] as const;

const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;

export function baseProfile(): Profile {
  return { ...BASE_PROFILE };
}

/** Applique des bonus et malus, bornés entre 0 et 100. */
export function applyModifier(profile: Profile, modifier: ProfileModifier): Profile {
  const result = { ...profile };
  for (const axis of PROFILE_AXES) result[axis] = clamp(profile[axis] + (modifier[axis] ?? 0));
  return result;
}

/** Mélange deux lots : moyenne des profils pondérée par les quantités. */
export function blend(a: Profile, amountA: number, b: Profile, amountB: number): Profile {
  const total = amountA + amountB;
  if (total <= 0) return { ...b };
  const result = { ...a };
  for (const axis of PROFILE_AXES)
    result[axis] = clamp((a[axis] * amountA + b[axis] * amountB) / total);
  return result;
}

/** Une quantité de matière (orge, malt, new make) et son profil moyen. */
export interface Lot {
  amount: number;
  profile: Profile;
}

export function emptyLot(): Lot {
  return { amount: 0, profile: baseProfile() };
}

const roundAmount = (value: number) => Math.round(value * 1000) / 1000;

export function addToLot(lot: Lot, amount: number, profile: Profile): void {
  if (amount <= 0) return;
  lot.profile = blend(lot.profile, lot.amount, profile, amount);
  lot.amount = roundAmount(lot.amount + amount);
}

/** Prélève une quantité (au plus le stock) ; le profil du lot ne change pas. */
export function takeFromLot(lot: Lot, amount: number): { amount: number; profile: Profile } {
  const taken = roundAmount(Math.min(lot.amount, amount));
  lot.amount = roundAmount(lot.amount - taken);
  return { amount: taken, profile: { ...lot.profile } };
}
