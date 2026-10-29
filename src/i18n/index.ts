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
