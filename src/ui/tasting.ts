import { t, type MessageKey } from '../i18n';
import { PROFILE_AXES } from '../sim/profile';
import { createRng } from '../sim/rng';
import type { Bottling } from '../sim/systems/bottling';

type Axis = Exclude<(typeof PROFILE_AXES)[number], 'quality'>;

export interface TastingNote {
  nose: string;
  palate: string;
  finish: string;
}

const words = (key: string): string[] => t(key as MessageKey).split('|');

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Note de dégustation rédigée à partir du profil : les axes dominants donnent
 * les arômes du nez et de la bouche, le fût ajoute sa signature, la qualité
 * règle la longueur de la finale. Toujours la même pour une mise en bouteille.
 */
export function tastingNote(bottling: Bottling): TastingNote {
  const rng = createRng(bottling.noteSeed);
  const axes = (PROFILE_AXES.filter((a) => a !== 'quality') as Axis[])
    .map((axis) => ({ axis, value: bottling.profile[axis] }))
    .sort((a, b) => b.value - a.value);
  const used = new Set<string>();
  const pick = (key: string) => {
    const options = words(key).filter((w) => !used.has(w));
    const word = rng.pick(options.length > 0 ? options : words(key));
    used.add(word);
    return word;
  };
  const strong = axes.filter((a) => a.value >= 15);
  const [first, second, third] = strong.length > 0 ? strong : axes;

  const nose = [pick(`taste.${first!.axis}`)];
  if (first!.value >= 35) nose.push(pick(`taste.${first!.axis}`));
  if (second) nose.push(pick(`taste.${second.axis}`));
  nose.push(pick(`taste.cask.${rng.pick(bottling.caskTypes)}`));

  const palate = [pick(`taste.${(second ?? first)!.axis}`)];
  if (third) palate.push(pick(`taste.${third.axis}`));
  palate.push(pick(`taste.${first!.axis}`));
  const texture = pick(
    bottling.profile.sweet >= bottling.profile.spicy
      ? 'taste.texture.round'
      : 'taste.texture.lively',
  );

  const quality = bottling.profile.quality;
  const length = t(
    quality >= 65
      ? 'taste.length.long'
      : quality >= 45
        ? 'taste.length.medium'
        : 'taste.length.short',
  );
  const tail = (['woody', 'spicy', 'peaty'] as Axis[]).sort(
    (a, b) => bottling.profile[b] - bottling.profile[a],
  )[0]!;

  return {
    nose: t('taste.nose', { notes: capitalize(nose.join(', ')) }),
    palate: t('taste.palate', { texture, notes: palate.join(', ') }),
    finish: t('taste.finish', { length, note: pick(`taste.${tail}`) }),
  };
}

/** Nom de la mise en bouteille : « Glenheir 12 ans · Single Cask n° 41 ». */
export function bottlingName(bottling: Bottling): string {
  const kind =
    bottling.singleCaskId !== null
      ? t('bottling.singleCask', { id: bottling.singleCaskId })
      : t('bottling.vatted', { casks: bottling.casks });
  return t('bottling.name', { age: bottling.ageYears, kind });
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

/** Étiquette : nom, nombre de bouteilles mises en bouteille et qualité. */
export function bottlingLabel(bottling: Bottling): HTMLElement {
  const label = el('div', 'bottling-label');
  label.append(
    el('h4', '', bottlingName(bottling)),
    el(
      'p',
      'bottling-meta',
      t('bottling.meta', {
        bottles: bottling.bottled,
        quality: Math.round(bottling.profile.quality),
      }),
    ),
  );
  return label;
}

/** Note de dégustation : nez, bouche, finale. */
export function tastingBlock(bottling: Bottling): HTMLElement {
  const note = tastingNote(bottling);
  const block = el('blockquote', 'tasting-note');
  block.append(el('p', '', note.nose), el('p', '', note.palate), el('p', '', note.finish));
  return block;
}
