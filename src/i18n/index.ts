import en from './en.json';
import fr from './fr.json';

export type MessageKey = keyof typeof fr;
export type Locale = 'fr' | 'en';
type Params = Record<string, string | number>;

const catalogs: Record<Locale, Record<MessageKey, string>> = { fr, en };
const numberLocales: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB' };

let current: Locale = 'fr';

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

/** Traduit une clé et remplace les paramètres `{nom}`. */
export function t(key: MessageKey, params?: Params): string {
  const template = catalogs[current][key] ?? catalogs.fr[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(numberLocales[current], { maximumFractionDigits: 0 }).format(value);
}

export function formatMoney(amount: number): string {
  return t('money.gbp', { amount: formatNumber(amount) });
}

/** Durée de jeu lisible : « 3 jours et 4 heures ». */
export function formatDuration(totalHours: number, hoursPerDay = 24): string {
  const days = Math.floor(totalHours / hoursPerDay);
  const hours = totalHours % hoursPerDay;
  const dayText = t(days > 1 ? 'duration.days' : 'duration.day', { n: days });
  const hourText = t(hours > 1 ? 'duration.hours' : 'duration.hour', { n: hours });
  if (days === 0) return hourText;
  if (hours === 0) return dayText;
  return t('duration.and', { a: dayText, b: hourText });
}

/** Montant signé : « +£1 200 » ou « −£1 800 ». */
export function formatSignedMoney(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
  return sign + formatMoney(Math.abs(amount));
}

/** Durée courte pour les minuteurs : « 3 j 4 h » ou « 12 h ». */
export function formatShortDuration(totalHours: number, hoursPerDay = 24): string {
  const hours = Math.ceil(totalHours);
  const d = Math.floor(hours / hoursPerDay);
  const h = hours % hoursPerDay;
  if (d === 0) return t('duration.shortHours', { h });
  return h === 0 ? t('duration.shortDays', { d }) : t('duration.short', { d, h });
}
