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

## Déploiement (Cloudflare Workers)

Le site est déployé comme Worker de fichiers statiques (configuration dans `wrangler.jsonc`, aucun code serveur). Le dépôt est connecté à Cloudflare via **Workers & Pages → Create → Import a repository** ; aucun secret n'est stocké dans le dépôt.

Réglages du projet (**Settings → Build**) :

- Build command : `npm run build`
- Deploy command : `npx wrangler deploy`
- Root directory : vide (ou `/`) — c'est le dossier du `package.json`, pas le dossier de sortie
- Branche de production : `main`

Le nom du Worker dans Cloudflare doit correspondre au champ `name` de `wrangler.jsonc` (`glenheir`). Le dossier servi est `dist/` ; les en-têtes de cache sont dans `public/_headers`. La version de Node est fixée par `.node-version` (22).

Pour obtenir une URL de test par branche, activer les builds des branches hors production (**Settings → Build → Branch control**) avec la commande `npx wrangler versions upload` : chaque branche poussée donne une URL d'aperçu.

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
