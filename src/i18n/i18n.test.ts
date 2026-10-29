import { afterEach, describe, expect, it } from 'vitest';
import en from './en.json';
import fr from './fr.json';
import { formatMoney, setLocale, t } from './index';

describe('i18n', () => {
  afterEach(() => setLocale('fr'));

  it('a les mêmes clés en français et en anglais', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it('remplace les paramètres', () => {
    expect(t('date.detail', { year: 1, season: 'Printemps', hour: 8 })).toBe(
      'An 1 · Printemps · 8 h',
    );
  });

  it('formate les livres sterling à la française', () => {
    // Intl utilise une espace insécable fine comme séparateur de milliers.
    expect(formatMoney(50_000).replace(/\s/g, ' ')).toBe('£50 000');
  });

  it('change de langue', () => {
    setLocale('en');
    expect(t('season.winter')).toBe('Winter');
  });
});
