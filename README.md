# Glenheir

Jeu mobile de gestion de distillerie de whisky en 2D vue de dessus, dans l'esprit de Theme Hospital. Tu hérites d'une distillerie écossaise à l'abandon et tu la reconstruis jusqu'à devenir la référence du pays.

- Specs du MVP : [docs/specs.md](docs/specs.md)
- Règles pour Claude Code : [CLAUDE.md](CLAUDE.md)

Stack : Vite + TypeScript + PixiJS, interface en HTML/CSS, tests Vitest, déploiement Cloudflare Pages.

## Développement

```sh
npm install
npm run dev        # serveur local, accessible depuis le réseau (--host)
npm test           # tests Vitest
npm run check      # lint + format + types + tests
npm run build      # build de production dans dist/
```

Pour tester sur iPhone en local : lancer `npm run dev` et ouvrir l'adresse réseau affichée depuis le téléphone (même Wi-Fi).

## Panneau de debug

Ajouter `?debug` à l'URL, ou toucher 5 fois rapidement la date dans la barre du haut. Il permet d'accélérer le temps (×10, ×100), d'avancer d'une heure, d'un jour ou d'une saison, d'exporter/importer la sauvegarde en texte et de recommencer une partie.

## Déploiement (Cloudflare Pages)

Le déploiement passe par l'intégration Git de Cloudflare Pages ; aucun secret n'est stocké dans le dépôt.

1. Tableau de bord Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, puis choisir le dépôt `glenheir`.
2. Réglages de build :
   - Framework preset : **None** (ou Vite)
   - Build command : `npm run build`
   - Build output directory : `dist`
   - Branche de production : `main`
3. La version de Node est fixée par `.node-version` (22).

Chaque branche poussée obtient une URL d'aperçu HTTPS (`<branche>.<projet>.pages.dev`), pratique pour tester sur iPhone avant de fusionner. Les en-têtes de cache sont dans `public/_headers`.

## Organisation du code

```text
src/
  sim/      logique pure (aucune dépendance à PixiJS ni au DOM)
  data/     balance.ts : tous les chiffres d'équilibrage
  app/      boucle de jeu, partie en cours
  save/     sauvegarde versionnée (IndexedDB, repli localStorage)
  render/   carte PixiJS, caméra, gestes tactiles
  ui/       barres et tiroirs HTML
  i18n/     textes fr/en
  debug/    panneau de test
```
