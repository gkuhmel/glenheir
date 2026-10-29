import { SAVE } from '../data/balance';

/**
 * Sauvegarde toutes les 30 s et dès que l'app passe en arrière-plan
 * (changement d'onglet, verrouillage de l'iPhone, fermeture).
 * Renvoie une fonction d'arrêt.
 */
export function startAutosave(save: () => void): () => void {
  const interval = window.setInterval(save, SAVE.autosaveIntervalMs);
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') save();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', save);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', save);
  };
}
