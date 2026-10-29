# Glenheir — Specs MVP

29 octobre 2026 · Guillaume

## Vision

Un jeu de gestion mobile en 2D vue de dessus : tu hérites d'une distillerie écossaise à l'abandon et tu la reconstruis jusqu'à produire le whisky le plus renommé et le plus vendu du pays. Esprit Theme Hospital (plan à aménager, personnages qui circulent), rythme mobile (sessions de 5 à 15 min, plusieurs fois par jour).

**Pitch :** « Ton grand-oncle t'a laissé une distillerie en ruine dans les Highlands. Les alambics sont froids, les chais vides. Dans douze ans, ton whisky sera dans tous les bars du monde. »

### Nom

**Glenheir** — *glen* (vallée écossaise, présent dans de nombreux noms de whisky) + *heir* (héritier) : le pitch en un mot. Sous-titre pour les stores : *Glenheir — Whisky Distillery Tycoon*. Dépôt GitHub : `glenheir`.

### Piliers de design

1. **Tes choix font le goût.** Grain, tourbe, coupes, fût et durée de vieillissement déterminent un profil aromatique, une note et un prix. Aucune décision n'est cosmétique.
2. **La patience est la mécanique centrale.** Le whisky met des années à mûrir : la tension vient de la trésorerie à tenir en attendant.
3. **Une distillerie vivante.** On entre dans la distillerie : employés et visiteurs s'y déplacent et travaillent, les machines tournent. Le jeu se joue dans les scènes (carte et vues intérieures), pas seulement dans des menus.
4. **Respect du temps du joueur.** Progression hors-ligne, aucune punition à l'absence, toujours une raison de revenir.
5. **Profondeur révélée progressivement.** Chaque système se débloque au fil du jeu ; l'écran du début est simple.

## Boucles de jeu et temps

Le jeu tourne en temps compressé, y compris app fermée : **1 saison de jeu = 24 h réelles**, donc 1 an = 4 jours et le premier whisky légal (3 ans) arrive vers le 12e jour réel.

### Modèle de temps

| Unité de jeu | Durée réelle |
| --- | --- |
| 1 heure | 40 s |
| 1 jour | 16 min |
| 1 saison (90 jours) | 24 h |
| 1 an | 4 jours |
| 3 ans (whisky légal) | 12 jours |

- **Calendrier :** 12 mois de 30 jours (1 an = 360 jours). Printemps = mars à mai, été = juin à août, automne = septembre à novembre, hiver = décembre à février. La partie commence le **1er mars de l'an 1 à 8 h** ; chaque année d'exploitation commence le 1er mars (« An 2 » au 1er mars suivant). Les échéances « mensuelles » tombent le 1er de chaque mois.
- **Hors-ligne :** au retour, la simulation rattrape le temps écoulé, plafonné à **8 h réelles** (le reste est perdu, sans pénalité). Un écran « Pendant ton absence » résume ventes, récoltes, fûts prêts et événements, dès que l'absence dépasse 1 jour de jeu (16 min réelles). Le même mécanisme s'applique quand l'app passe en arrière-plan.
- **Pas de punition :** rien ne se dégrade parce que le joueur est absent (pas de démission, pas de récolte pourrie). Les risques viennent des choix et du marché.
- **Pause :** le temps ne s'arrête pas, mais un mode « construction » fige la simulation tant que le joueur édite le plan ; à la sortie, la simulation rattrape le temps réel écoulé pendant l'édition (même plafond de 8 h).

### Session courte (≈ 5 min)

1. Lire le résumé d'absence.
2. Récolter, lancer un brassin ou une distillation, mettre en fût.
3. Vendre les produits prêts, répondre à 1 ou 2 événements (commande d'un caviste, critique de passage, panne).
4. Programmer les files d'attente pour les prochaines heures.

### Session longue (10-15 min)

1. Tout ce qui précède.
2. Agrandir la distillerie : acheter un emplacement, construire ou restaurer une salle, allonger le chai, optimiser le parcours de visite.
3. Recruter, former, réaffecter le personnel.
4. Concevoir une nouvelle cuvée (recette) ou une mise en bouteille.
5. Consulter le marché et les rivaux, s'inscrire au concours.

### Boucle longue (semaines)

Planter → distiller → vieillir → mettre en bouteille → vendre et gagner en renommée → réinvestir dans des terres, des alambics et un chai plus grands → produits plus vieux et plus chers. Le gin et le new make assurent la trésorerie pendant les premières années de jeu.

## Systèmes du MVP

Tous les chiffres sont des valeurs de départ, à centraliser dans un fichier d'équilibrage (`balance.ts`) pour être ajustés sans toucher au code. Monnaie : livre sterling (£).

### Profil aromatique (le cœur du jeu)

Chaque lot d'alcool porte un **profil** de 6 axes notés 0-100 : *fruité, floral, tourbé, épicé, boisé, doux/vanillé*, plus une **qualité** 0-100. Chaque étape de production modifie ce profil. À la mise en bouteille, le profil génère des notes de dégustation (phrases assemblées depuis des modèles) et fixe la note critique.

### Terroirs (choix au démarrage)

| Terroir | Atouts | Contraintes |
| --- | --- | --- |
| Speyside | Eau douce (+10 fruité), terres fertiles (rendement 100 %), visiteurs +20 % | Foncier cher (parcelle £8 000), concurrence forte |
| Islay | Tourbe locale gratuite, part des anges réduite (1,5 %/an), prix +10 % sur les tourbés | Rendement orge 80 %, visiteurs −20 %, transport +10 % sur l'export |

### La distillerie : bâtiment et vue intérieure

- **Sur la carte**, la distillerie est un bâtiment unique au milieu de la cour, dessiné en détail : murs de pierre, toits d'ardoise, four à malt coiffé d'une pagode, cheminée. Son extérieur reflète ce qui est construit à l'intérieur : chaque nouvel emplacement ajoute une aile ou un étage, la pagode fume quand la malterie tourne, la cheminée fume quand les alambics chauffent. En ruine au départ (toits percés, murs envahis de lierre), il se restaure salle par salle.
- **Taper la distillerie** ouvre sa **vue intérieure en coupe de profil**, comme une maquette ouverte : les salles sont côte à côte et sur plusieurs niveaux, on y voit les machines (malt étalé, cuve d'empâtage, cuves de fermentation, alambics de cuivre) et les personnages travailler. Pan horizontal et zoom au doigt ; un bouton « Carte » ramène à l'extérieur.
- **Grille de salles** : jusqu'à 8 emplacements de large sur 3 niveaux (cave, rez-de-chaussée, étage). Au départ, le rez-de-chaussée compte 5 salles en ruine : malterie, brasserie, cuves de fermentation, salle des alambics, accueil. Les autres emplacements s'achètent un par un (à gauche, à droite, un étage, une cave), puis on y construit la salle de son choix ; les escaliers se placent automatiquement.
- **Types de salles** : malterie, brasserie, cuves de fermentation, salle des alambics, atelier gin, accueil (guichet), salle de dégustation, boutique, café, toilettes, salle du personnel (repos, moral).
- **Fusion** : deux ou trois salles identiques voisines sur le même niveau fusionnent en une grande salle (capacités additionnées, +10 % d'efficacité par salle fusionnée, décor plus riche).
- **Gestion dans la scène** : taper une machine ouvre ses actions (lancer un maltage, un brassin, une distillation, régler les coupes) ; taper une salle en ruine propose sa restauration ; taper un emplacement vide propose d'y construire. Les onglets du bas restent des vues d'ensemble (toutes les files, tous les fûts, le marché, l'équipe).
- **Chais** : bâtiments séparés sur la carte, longs chais de pierre traditionnels (*dunnage*). Le premier est en ruine au départ. Sa vue intérieure en coupe montre les rangées de fûts sur 3 hauteurs (bas, milieu, haut) ; on y remplit un fût en tapant une place libre et on consulte un fût en le tapant. L'extension ajoute 20 places et allonge le bâtiment.
- **Personnages** : ouvriers, distillateur, maître de chai, guide et visiteurs sont visibles et animés dans les vues intérieures (marche, escaliers, porter un sac de malt, tourner une vanne, rouler un fût) et sur la carte (aller aux champs, visiteurs qui arrivent par le chemin). Les déplacements sont calculés par le rendu à partir de l'état de la simulation (qui travaille où), sans influencer les résultats.

### Terres et orge

- Parcelles de 1 ha ; 2 parcelles au départ, jusqu'à 8 achetables.
- Semis au printemps, récolte en fin d'été. Météo aléatoire : rendement ±20 %.
- 1 ha donne environ 6 t d'orge. On peut aussi acheter de l'orge au marché (plus cher, sans bonus de variété).

| Variété | Rendement | Effet sur le profil | Coût semence |
| --- | --- | --- | --- |
| Concerto | 100 % | Neutre | £300/ha |
| Golden Promise | 75 % | +10 doux, +5 qualité | £500/ha |
| Bere (ancienne) | 55 % | +10 épicé, +8 qualité, mention « rare » | £800/ha |

### Chaîne de production (4 salles)

| Étape | Salle | Entrée → sortie | Durée (jeu) | Choix du joueur |
| --- | --- | --- | --- | --- |
| Maltage | Malterie | 1 t orge → 0,8 t malt | 5 jours | Tourbage : aucun / léger (+25 tourbé) / fort (+55 tourbé) |
| Brassage | Brasserie | 1 t malt → 5 000 L de moût | 1 jour | — |
| Fermentation | Cuves (washbacks) | Moût → bière de distillation | 2 à 4 jours | Fermentation longue : +10 fruité, −5 % volume |
| Distillation | Salle des alambics | 5 000 L → ≈ 400 L d'alcool pur (LPA) | 1 jour | Forme d'alambic, largeur des coupes |

- **Alambics** (toujours par paire, wash + spirit) : petit (£25 000, 2 500 L/jour), moyen (£60 000, 5 000 L/jour). Col court : +corps, +épicé ; col long : +floral, +fruité.
- **Coupes** : un curseur règle la largeur du « cœur ». Étroit : +10 qualité, −25 % volume. Large : +25 % volume, −10 qualité, +lourd/épicé. La compétence du distillateur réduit la pénalité.
- **Énergie** : £120 par jour de distillation.

### Chai et vieillissement

| Fût | Contenance | Prix | Effet | Particularité |
| --- | --- | --- | --- | --- |
| Ex-bourbon | 200 L | £150 | +doux/vanillé, +fruité | Référence, équilibré |
| Sherry | 500 L | £900 | +épicé, +fruits secs, couleur sombre | Prix de vente +20 % |
| Chêne neuf | 200 L | £400 | +boisé fort, mûrit 1,5× plus vite | Au-delà de 8 ans : −qualité (surboisé) |

- Le chai a un nombre d'emplacements (40 au départ, extensible). Position basse = mûrit plus lentement mais +qualité ; position haute = l'inverse.
- **Part des anges** : 2 %/an du volume (1,5 % à Islay).
- La qualité monte selon une courbe propre à chaque fût, avec un plafond. Le maître de chai révèle la qualité réelle d'un fût (sinon, estimation floue ±15).
- Un fût de 2e remplissage donne des effets réduits de moitié.

### Produits

| Produit | Disponible | Prix de base | Rôle |
| --- | --- | --- | --- |
| Gin | Dès l'alambic restauré + atelier botaniques | £28/bouteille | Trésorerie des débuts, faible renommée |
| New make (vrac) | Dès la 1re distillation | £4/LPA, vendu aux assembleurs | Trésorerie, aucune renommée |
| Single malt 3 ans | Après 3 ans de fût | £35/bouteille | Premier vrai produit |
| Single malt 8 / 12 / 18 ans | Avec l'âge | £55 / £80 / £180 | Renommée et marges |

Le prix final = prix de base × facteur qualité × facteur renommée × facteur fût. Une bouteille = 0,7 L à 40 %, soit 0,28 LPA.

### Personnel (4 rôles)

| Rôle | Effet | Salaire mensuel (niv. 1 → 5) |
| --- | --- | --- |
| Ouvrier | Fait tourner les machines ; sans ouvrier, une machine est à l'arrêt | £1 800 → £2 600 |
| Distillateur | Réduit la pénalité des coupes, +qualité | £2 500 → £5 000 |
| Maître de chai | Révèle la qualité des fûts, réduit les pertes, débloque l'assemblage de fûts | £3 000 → £6 500 |
| Guide | Fait les visites ; sa compétence augmente la satisfaction | £1 600 → £2 400 |

- Compétence 1 à 5, monte avec l'expérience ou une formation (coût + absence quelques jours).
- Moral simple : baisse si surcharge ou salaire sous le marché ; un employé démotivé produit moins, peut partir.
- Les employés se déplacent physiquement dans le plan entre les postes.

### Visiteurs

- Débloqués après la restauration de l'accueil (guichet), salle de la distillerie.
- Parcours : accueil → salle des alambics → chai → dégustation → boutique. Les visiteurs le suivent à travers les salles de la distillerie (puis jusqu'au chai) ; trop de salles traversées, d'escaliers ou de foule fait baisser la satisfaction : la disposition des salles compte.
- Besoins type Theme Hospital : toilettes, bancs, café (salles à construire). Leur absence fait râler (bulles visibles).
- Billet £15 ; la boutique vend les produits avec +30 % de marge.
- Affluence = base × renommée × saison (été ×2, hiver ×0,5) × terroir.
- Chaque visiteur laisse un avis 1 à 5 étoiles qui alimente la renommée.

### Marché et rivaux

| Canal | Débloqué | Prix | Volume |
| --- | --- | --- | --- |
| Boutique de la distillerie | Bâtiment d'accueil | 100 % + marge boutique | Limité aux visiteurs |
| Cavistes UK | Dès le départ | 100 % | Moyen, plafonné par mois |
| Export | Renommée ≥ 30 | 70 % | Élevé |
| Assembleurs (vrac) | Dès le départ | Prix fixe au LPA | Illimité |

- La demande par canal baisse si on inonde le marché (élasticité simple), puis se reconstitue.
- **2 rivaux IA** qui évoluent selon des courbes scriptées avec un peu d'aléatoire : *Glen Rothmore* (Speyside, gros volume, prix bas) et *Ardnacraig* (Islay, petit volume, premium). Ils lancent des produits, gagnent des médailles, prennent des parts de marché.

### Renommée

- Jauge 0 à 100, alimentée par les avis des visiteurs, les notes des critiques sur chaque mise en bouteille et les médailles.
- **Concours annuel** (automne) : on inscrit une mise en bouteille ; le jury note qualité, âge et équilibre du profil. Médailles bronze / argent / or / « Meilleur whisky d'Écosse ».
- Des critiques de passage notent aléatoirement un produit en vente.

### Économie de départ

- Trésorerie : **£50 000**. Prêt bancaire possible jusqu'à £100 000 d'encours à 6 %/an : chaque emprunt (minimum £1 000, plusieurs possibles) se rembourse par mensualités constantes sur 5 ans, le 1er de chaque mois ; remboursement anticipé possible sans pénalité (la mensualité est recalculée).
- Coûts fixes : salaires (versés le 1er de chaque mois pour le mois écoulé), entretien des bâtiments (1 %/mois de leur valeur), énergie.
- Faillite : trésorerie négative au 1er du mois 3 mois de suite → fin de partie (avec un avertissement dès le 1er mois négatif).

### Coûts de restauration

La restauration des ruines coûte environ £50 000 avant le premier fût rempli : la trésorerie de départ ne suffit pas, le prêt devient un vrai choix dès les premières heures.

| Salle ou bâtiment | Coût | Débloque |
| --- | --- | --- |
| Malterie (salle en ruine) | £8 000 | Maltage |
| Brasserie (salle en ruine) | £10 000 | Brassage |
| Cuves de fermentation ×2 (salle en ruine) | £6 000 | Fermentation |
| Salle des alambics (salle en ruine) | £12 000 | Salle de distillation |
| Vieille paire d'alambics | £8 000 | Petit alambic restauré (évite l'achat à £25 000) |
| Chai (bâtiment en ruine, 40 places) | £6 000 | Vieillissement |
| Accueil (salle en ruine) | £20 000 | Visites, guichet et boutique |
| Café (salle à construire) | £6 000 | Besoin visiteurs, revenu d'appoint |
| Toilettes (salle à construire) | £1 500 | Besoin visiteurs |

Une salle construite à neuf dans un emplacement vide (par exemple une deuxième malterie) coûte 1,5 fois son prix de restauration.

### Autres coûts

| Poste | Coût | Quand |
| --- | --- | --- |
| Orge achetée au marché | £250/t | À l'achat, prix variable selon la saison |
| Mise en bouteille | £3/bouteille (verre, étiquette, bouchon) | À la mise en bouteille |
| Botaniques gin | £1,50/bouteille | À la production |
| Extension du chai | £5 000 par lot de 20 places | À la construction |
| Nouvel emplacement de salle (distillerie) | £4 000, +25 % par emplacement déjà acheté | À l'achat |
| Recrutement | 1 mois de salaire | À l'embauche |
| Formation | 2 mois de salaire, employé absent 10 jours | À la formation |

### Droits d'accise

- Taxe prélevée sur chaque bouteille vendue au Royaume-Uni (boutique et cavistes) : **£9 par bouteille de 70 cl à 40 %** (valeur simplifiée, inspirée du barème britannique, à ajuster).
- **L'export en est exonéré** : cela rend l'export attractif malgré son prix à 70 % et crée un vrai arbitrage entre canaux.
- Le new make vendu en vrac aux assembleurs n'est pas taxé (il quitte la distillerie sous douane).

### Flux de trésorerie (récapitulatif)

| Flux | Sens | Fréquence |
| --- | --- | --- |
| Ventes (boutique, cavistes, export, vrac) | Entrée | À chaque vente |
| Billets de visite, café | Entrée | Chaque jour de jeu |
| Prix de concours | Entrée | Annuel |
| Salaires | Sortie | Mensuel |
| Entretien des bâtiments (1 %/mois de leur valeur) | Sortie | Mensuel |
| Remboursement du prêt | Sortie | Mensuel |
| Énergie | Sortie | Par jour de distillation |
| Droits d'accise | Sortie | À chaque vente UK |
| Semences, orge, fûts, bouteilles, botaniques | Sortie | À l'achat |
| Bâtiments, machines, parcelles | Sortie (investissement) | À l'achat |

### Cibles d'équilibrage

- **Mois 1 à 6** : déficit assumé, financé par la trésorerie de départ et le prêt.
- **Mois 8 à 10** : point bas de trésorerie, moment de tension voulu.
- **Fin d'année 1** : résultat mensuel proche de zéro grâce au gin, au new make et aux visites.
- **Années 3 à 4** : les premiers single malts rendent la distillerie nettement rentable.
- Ces cibles sont vérifiées par un test d'équilibrage automatisé (simulation d'une partie type sur 5 ans avec une stratégie scriptée).

## Progression et victoire

La partie se gagne en devenant **n°1 sur deux axes à la fois** : renommée et part de marché, face aux deux rivaux. Les jalons débloquent les systèmes un par un et servent de tutoriel.

### Jalons de déblocage

| # | Jalon | Condition | Débloque |
| --- | --- | --- | --- |
| 1 | La ruine | Début de partie | 2 parcelles, distillerie et chai en ruine, 1 ouvrier |
| 2 | Premier brassin | Malterie et brasserie restaurées | Cuves de fermentation, recrutement |
| 3 | L'alambic chante | Première distillation | Vente de new make, atelier gin |
| 4 | Le chai | 10 fûts remplis | Maître de chai, choix des types de fûts |
| 5 | Portes ouvertes | £30 000 de chiffre d'affaires cumulé | Restauration de l'accueil, visiteurs, guide, boutique |
| 6 | Premier whisky | Un fût atteint 3 ans | Mise en bouteille, cavistes, notes de dégustation |
| 7 | Sur la scène | Renommée ≥ 20 | Concours annuel, critiques de passage |
| 8 | Le monde entier | Renommée ≥ 30 | Export, alambics moyens, parcelles supplémentaires |
| 9 | Âge de raison | Un fût atteint 12 ans | Éditions limitées, single cask |

### Conditions de victoire

- **Victoire « Légende »** : renommée la plus haute des trois distilleries **et** part de marché la plus haute, maintenues pendant 1 an de jeu.
- **Jalon de prestige** (pas une fin) : médaille d'or « Meilleur whisky d'Écosse » au concours.
- Après la victoire, la partie continue en mode libre.
- **Défaite** : faillite (3 mois de trésorerie négative).

### Durée visée

Une partie complète doit tenir en **15 à 20 ans de jeu**, soit 2 à 3 mois réels à raison de quelques sessions par jour. Le premier single malt arrive vers le 12e jour réel ; avant cela, le gin, le new make et les visites doivent suffire à occuper et à faire vivre la distillerie.

## Direction artistique et UX mobile

Tout est dessiné en code (formes vectorielles, dégradés, lumières) dans l'esprit d'Ar Men : aucun asset illustré externe n'est nécessaire pour le MVP.

### Style

- **Deux échelles** : la **carte** en vue de dessus sur une grille de tuiles carrées (32 px logiques), avec des bâtiments vus du dessus (toits d'ardoise) ; les **vues intérieures** (distillerie, chais) en coupe de profil, comme une maquette ouverte, nettement plus détaillées.
- **Palette** : pierre grise et chaude, cuivre des alambics, vert des champs, ambre du whisky, bois sombre des fûts, ciel et brume écossais. Une palette par saison (vert vif en été, brun et gris en hiver).
- **Lumière et ambiance** : reflets animés sur le cuivre, vapeur qui monte des alambics en marche, lumière chaude et tamisée dans le chai, pluie et brume selon la météo, cycle jour/nuit léger.
- **Personnages** : sur la carte, silhouettes vues de dessus (tête + épaules) ; dans les vues intérieures, personnages de profil animés (marche, escaliers, gestes de travail). Tenue selon le rôle (bleu de travail pour l'ouvrier, tablier de cuir pour le distillateur, gilet de tweed pour le maître de chai, kilt pour le guide). Bulles d'humeur au-dessus des visiteurs.
- **Interface** : ambiance celtique — bois sombre veiné, filets et icônes en laiton, bandeaux d'entrelacs, tiroirs en parchemin, titres en écriture onciale (Uncial Antiqua), texte en Alegreya Sans.
- **Ruine → restauration** : chaque salle et chaque bâtiment a un état « ruine » (murs fissurés, lierre, toiles d'araignée, machines rouillées) et un état restauré, à l'intérieur comme à l'extérieur ; la transition est un moment de récompense visuelle.

### UX mobile (portrait)

- **Carte** : pan à un doigt, zoom au pincement ; taper la distillerie ou un chai fait entrer dans sa vue intérieure (transition zoomée), taper un champ ou un personnage ouvre sa fiche.
- **Vues intérieures** : pan horizontal et zoom ; taper une machine, une salle, un emplacement ou un fût donne ses actions directement dans la scène ; bouton « Carte » pour ressortir.
- **Barre du haut** : trésorerie, renommée, date de jeu et saison.
- **Barre du bas** (5 onglets) : Distillerie (carte), Production, Chai, Marché, Équipe.
- **Panneaux en tiroir** qui montent du bas, utilisables au pouce, la carte reste visible au-dessus.
- **Mode construction** : dans la vue intérieure, les emplacements achetables et libres apparaissent en pointillés, on choisit la salle et on valide ; sur la carte, grille visible et fantôme pour les parcelles et les chais.
- **Files et minuteurs** visibles directement dans les scènes (icône + temps restant au-dessus de chaque machine) ; sur la carte, un résumé au-dessus de chaque bâtiment.
- **Notifications** dans le jeu uniquement pour le MVP (pas de push).
- Cibles tactiles de 44 px minimum ; tout le texte en français, structure prête pour l'anglais.

### Tableau de bord économique

Accessible en touchant la trésorerie dans la barre du haut, et depuis l'onglet Marché. Il répond en un coup d'œil à « est-ce que je gagne de l'argent, et où ? ».

- **En-tête** : trésorerie actuelle, résultat du mois en cours, prêt restant dû, valeur estimée du stock en fût.
- **Graphique sur 12 mois** : revenus et dépenses mensuels en barres, trésorerie en courbe.
- **Répartition des revenus** par canal : boutique, cavistes, export, vrac, visites, café, concours.
- **Répartition des dépenses** par poste : salaires, entretien, énergie, accise, matières (orge, fûts, bouteilles), prêt, investissements.
- **Marge par produit** : prix de vente moyen, coût de revient, accise, marge nette (gin, new make, chaque âge de single malt).
- **Prévision à 3 mois** : sorties certaines (salaires, prêt, entretien) et entrées probables, avec une **alerte** si la trésorerie risque de passer en négatif.
- **Stock** : fûts par âge et valeur estimée à maturité, bouteilles prêtes à vendre.
- Chaque ligne du tableau de bord ouvre le détail des transactions correspondantes (journal filtrable).

La simulation enregistre donc **chaque transaction** (date, montant, catégorie, produit, canal) dans un journal ; le tableau de bord n'est qu'une vue agrégée de ce journal. Le journal garde le détail des 24 derniers mois ; au-delà, les transactions sont regroupées par mois et par catégorie.

## Architecture technique

Principe directeur : **la simulation est totalement séparée de l'affichage**. Elle avance par pas fixes (1 heure de jeu), sans dépendre du rendu, ce qui rend le rattrapage hors-ligne trivial et le jeu testable.

### Stack

- **Vite + TypeScript**, déploiement Cloudflare Pages, installable en PWA (jouable plein écran sur iPhone).
- **PixiJS** pour la carte (tuiles, bâtiments, personnages, effets de vapeur et de lumière).
- **Interface (panneaux, onglets, fiches) en HTML/CSS** par-dessus le canvas, plus simple à rendre lisible et accessible. Pas de framework lourd ; Preact accepté si les panneaux se complexifient.
- **Vitest** pour tester la simulation.

### Structure du code

```text
src/
  sim/            # logique pure, aucune dépendance à PixiJS ni au DOM
    state.ts      # type GameState (source de vérité unique)
    tick.ts       # avance l'état d'une heure de jeu
    systems/      # building (grille de salles), fields, malting, mashing,
                  # fermentation, distillation,
                  # warehouse, staff, visitors, market, rivals, renown, finance
    profile.ts    # profil aromatique et calcul de qualité
    tasting.ts    # génération des notes de dégustation
    events.ts     # événements aléatoires
    rng.ts        # aléatoire à graine (reproductible)
  data/
    balance.ts    # tous les chiffres d'équilibrage
    content.ts    # orges, fûts, alambics, bâtiments, jalons
  render/         # PixiJS
    map/          # carte : terrain, bâtiments vus du dessus
    interior/     # vues en coupe : distillerie, chais, machines
    characters/   # personnages animés (carte et intérieurs)
  ui/             # panneaux HTML : barres, tiroirs, fiches
  save/           # sauvegarde, versions et migrations
  i18n/           # fr.json, en.json
  debug/          # panneau de test
  main.ts
```

### Règles pour la simulation

- `GameState` est un objet sérialisable en JSON (pas de classes, pas de fonctions) : c'est lui qu'on sauvegarde.
- `tick(state, rng)` applique chaque système dans un ordre fixe et renvoie les événements produits (pour l'interface et le résumé d'absence).
- Les actions du joueur passent par des **commandes** (`plantField`, `startDistillation`, `fillCask`…) qui valident puis modifient l'état. L'interface n'écrit jamais directement dans l'état.
- **Rattrapage hors-ligne** : au lancement, calculer les heures de jeu écoulées (plafonnées à 8 h réelles = 720 heures de jeu) et exécuter autant de `tick` d'affilée, puis afficher le résumé.
- Aléatoire uniquement via `rng.ts` à graine, pour pouvoir rejouer une partie et écrire des tests.

### Sauvegarde

- Sauvegarde automatique dans IndexedDB (repli localStorage) toutes les 30 s et à la mise en arrière-plan (`visibilitychange`).
- Champ `version` dans la sauvegarde et fonctions de migration pour ne jamais casser une partie existante.
- Export/import de la sauvegarde en texte (utile pour tester et pour le transfert d'appareil).

### Panneau de test (debug)

Accessible par un geste caché ou `?debug` dans l'URL : accélérer le temps (×10, ×100), ajouter de l'argent, faire vieillir tous les fûts d'un an, déclencher un événement, afficher l'état brut.

## Plan de développement pour Claude Code

Dix étapes, chacune jouable et testée sur iPhone avant de passer à la suivante. La simulation est écrite et testée avant son affichage à chaque étape.

1. **Fondations** — projet Vite + TS, PixiJS, carte en grille avec pan/zoom tactile, barres du haut et du bas, horloge de jeu, sauvegarde/chargement, panneau debug, déploiement Cloudflare Pages. *(fait)*
2. **Simulation de base** — `GameState`, `tick`, commandes, RNG à graine, rattrapage hors-ligne et écran « Pendant ton absence », finances (trésorerie, salaires, prêt, accise) et journal des transactions. *(fait)*
3. **La distillerie et sa vue intérieure** — bâtiment détaillé sur la carte (ruine → restauré, extérieur qui grandit avec les salles), chai en ruine sur la carte, vue intérieure en coupe, grille de salles (restauration des ruines, achat d'emplacements, construction, fusion), navigation carte ↔ intérieur, premiers personnages animés (l'ouvrier de départ qui circule et travaille).
   - *Fini quand* : on tape la distillerie, on entre dans la coupe, on restaure une salle avec sa transition, on achète un emplacement et l'extérieur grandit, et l'ouvrier se déplace d'une salle à l'autre.
4. **Terres et production** — parcelles, saisons, météo, variétés d'orge ; maltage, brassage, fermentation, distillation pilotés en tapant les machines dans la vue intérieure (animations : malt retourné, vapeur, cuivre qui chauffe) ; profil aromatique ; vente de new make.
   - *Fini quand* : on peut semer, récolter, distiller et vendre du new make depuis les scènes.
5. **Chai et vieillissement** — vue intérieure du chai, fûts et places sur 3 hauteurs, remplir un fût en tapant une place, part des anges, courbes de maturation ; atelier gin.
   - *Fini quand* : un fût vieilli 3 ans (accéléré en debug) affiche une qualité et un profil cohérents.
6. **Personnel** — recrutement, 4 rôles, compétences, moral ; chaque employé se rend à son poste et y travaille de façon visible (aux champs, aux machines, au chai).
   - *Fini quand* : une machine sans ouvrier s'arrête et on voit chaque employé aller travailler.
7. **Mise en bouteille et marché** — produits, prix, canaux, élasticité de la demande, notes de dégustation générées, tableau de bord économique.
   - *Fini quand* : vendre beaucoup d'un coup fait baisser le prix, et chaque bouteille a sa note de dégustation.
8. **Visiteurs** — accueil et guichet, parcours à travers les salles et jusqu'au chai, besoins (café, toilettes), boutique, avis.
   - *Fini quand* : les visiteurs suivent le parcours dans les salles, râlent s'il manque des toilettes, et leurs avis bougent la renommée.
9. **Renommée, rivaux, progression** — jauge de renommée, concours annuel, critiques, 2 rivaux IA, jalons de déblocage, victoire et faillite.
   - *Fini quand* : une partie peut être gagnée ou perdue en mode debug accéléré.
10. **Finition** — ambiance (vapeur, reflets, météo, jour/nuit), saisons visuelles, tutoriel guidé par les jalons, équilibrage, traduction anglaise, PWA.
    - *Fini quand* : un joueur extérieur prend en main la partie sans explication.

Conseil de travail : à chaque étape, demander d'abord à Claude Code un plan, puis l'implémentation, puis les tests. Garder ce document dans le dépôt (`docs/specs.md`) et le mettre à jour quand une règle change.

## Hors périmètre et questions ouvertes

### Gardé pour après le MVP

- Irlande (triple distillation, pot still) et Japon (fûts mizunara, riz, climat).
- Autres grains (seigle, maïs, blé), alambics à colonne, whisky de grain et blends.
- Assemblages avancés, finitions en double fût, vente de fûts en primeur.
- Débauchage d'employés entre rivaux, tendances de marché par pays.
- Notifications push, publication App Store, monétisation.

### Questions ouvertes

- [x] Choisir le nom du jeu : Glenheir (reste à vérifier App Store, domaine, GitHub).
- [ ] Le rythme « 1 saison = 24 h réelles » est-il le bon, ou faut-il plus rapide (premier whisky en une semaine) ?
- [ ] La faillite est-elle une vraie fin de partie, ou un rachat avec malus (plus doux pour du mobile) ?
- [x] Un seul emplacement de sauvegarde, ou plusieurs parties en parallèle ? → Un seul emplacement pour le MVP, stockage prévu pour en accueillir plusieurs.
- [ ] Faut-il un personnage narrateur (le notaire, un vieux distillateur) pour porter le tutoriel et l'histoire ?
