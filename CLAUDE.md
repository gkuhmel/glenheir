# Glenheir — jeu mobile de gestion de distillerie de whisky

Specs complètes : docs/specs.md (à lire avant toute tâche).

## Règles
- Vite + TypeScript + PixiJS, UI en HTML/CSS par-dessus le canvas.
- src/sim/ = logique pure, aucune dépendance à PixiJS ni au DOM.
- Tous les chiffres d'équilibrage dans src/data/balance.ts, jamais en dur.
- Aléatoire uniquement via src/sim/rng.ts (à graine).
- Chaque système de simulation a ses tests Vitest.
- Textes de l'interface en français, via i18n.
- On avance étape par étape selon le plan de docs/specs.md ;
  ne pas commencer l'étape suivante sans validation.
- Mettre à jour docs/specs.md si une règle de jeu change.
- Git : travailler directement sur `main` et pousser sur `main` sans
  demander (pas de branche, pas de PR).
