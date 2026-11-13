# HOT DROP sur desktop : principes d'adaptation

Maquette : `index.html` (à ouvrir via le serveur de dev, `npx vite`, puis `/design/desktop/index.html`) et ses
captures :

| Capture | Écran |
|---|---|
| `capture-1-sac-preparation.png` | Sac en préparation du duel : stats et réserve à gauche, sac au centre, arène et sac adverse à droite |
| `capture-2-sac-boutique.png` | Ravitaillement : la boutique en panneau à droite, à côté du sac (plus de fenêtre plein écran) |
| `capture-3-duel.png` | Duel en cours : arène en grand, les deux sacs dessous, rapport de duel en direct à droite |
| `capture-4-carte.png` | Carte du battle royale à gauche, zone choisie et ses cartes à droite |

Le mobile (portrait 720 × 1280) reste la cible principale : rien de ce qui suit ne doit le changer.

## 1. Une seule base de code, deux mises en page

- **Mêmes règles, mêmes scènes, même logique** : `src/logic/`, `src/data/`, les scènes Phaser et leurs mécaniques
  ne bougent pas. Le duel, les étoiles, les recettes, la boutique sont identiques.
- **Ce qui change, c'est la mise en page.** Aujourd'hui, `src/config.ts` fixe les zones de l'écran en dur pour
  720 × 1280 : `W`, `H`, `CELL`, `GRID_X`, `GRID_Y`, `COMBAT`, `ARENA`, `ENEMY`, `TRAY`, `SELL`, `RESERVE`,
  `BAG_RESERVE`, `BUTTON`. On en fait **deux jeux de valeurs** :
  - `LAYOUT_MOBILE` : exactement les valeurs actuelles (par défaut) ;
  - `LAYOUT_DESKTOP` : 1920 × 1080, cases de 100 px, sac au centre, colonnes à gauche et à droite.
- **Choix au démarrage** : paysage et fenêtre d'au moins ~1280 px de large → desktop ; sinon mobile. Le choix est
  fait une fois au lancement (et au redimensionnement si l'orientation change), puis le jeu redémarre la scène
  courante. Un réglage « Mise en page : auto / mobile / desktop » permet de forcer.
- **Les fenêtres plein écran deviennent des panneaux** sur desktop (boutique, caisse, fouille, fiche de l'adversaire,
  rapport) : même contenu, placé dans la colonne de droite au lieu d'une modale. Sur mobile, elles restent des
  modales.

## 2. Ce qui change à l'écran

| Élément | Mobile | Desktop |
|---|---|---|
| Sac | Cases de 72 px, en bas de l'écran | Cases de 100 px, au centre |
| Réserve | 12 places, 2 rangées sous le sac | 12 places, 3 rangées de 4 à gauche ; vente et sacoches dessous |
| Adversaire | Miniature, « Son sac » ouvre une fenêtre | Toujours affiché en grand à droite |
| Boutique, caisse, fouille | Fenêtre plein écran | Panneau à droite ; on glisse l'offre directement dans le sac |
| Duel | Arène 370 × 290 | Arène 1200 × 640, sacs visibles dessous, rapport en direct |
| Carte | Carte puis panneau en dessous | Carte carrée à gauche, zone et aperçu de ses cartes à droite |

## 3. Souris et clavier

| Action | Mobile | Desktop |
|---|---|---|
| Fiche d'un objet | Appui long | **Survol** (fiche à côté du curseur) |
| Sélection, fils de liens | 1er toucher | Clic |
| Tourner | 2e toucher sur l'objet sélectionné | **Clic droit**, ou **R** pendant un glisser |
| Déplacer | Glisser | Glisser (identique) |
| Combat / Terminer | Bouton | Bouton, ou **Espace** / **Entrée** |
| Vitesse, passer le duel | Boutons | **V**, **Espace** |
| Relancer la boutique | Bouton | **F** |
| Sac depuis la carte | Bouton | **B** |

La molette reste libre (piste : faire défiler la réserve si elle grandit un jour).

## 4. Zéro régression sur mobile

1. **Mobile par défaut** : la mise en page mobile garde exactement les valeurs actuelles de `config.ts` ; le desktop
   ne s'active que sur grand écran paysage.
2. **Captures de référence** : avant le chantier, captures Playwright à 720 × 1280 des écrans clés (menu, opérateurs,
   carte, zone, sac, duel, boutique, rapport, fin) ; après chaque étape, mêmes captures et comparaison pixel à pixel
   (tolérance faible pour les animations). Toute différence sur mobile bloque l'étape.
3. **Tests de logique inchangés** : la logique ne bouge pas, les 106 tests doivent rester verts.
4. **Une étape = une scène** : on adapte les scènes une par une (menu, carte, zone, sac, duel, fin), chaque étape
   poussée séparément, le mobile vérifié à chaque fois.

## 5. Estimation

| Étape | Effort |
|---|---|
| Mises en page dans `config.ts` (lecture des zones par fonction plutôt que constantes), choix auto + réglage | 1 jour |
| Captures de référence mobile et comparaison automatique | 0,5 jour |
| Sac et réserve, survol/clic droit/raccourcis | 1,5 jour |
| Panneaux à la place des modales (boutique, caisse, fouille, adversaire, rapport) | 2 jours |
| Duel en grand, rapport en direct | 1 jour |
| Carte et zone côte à côte, menu, fin de partie | 1 jour |
| Recette et ajustements | 1 jour |
| **Total** | **environ 8 jours** |

Le plus gros risque : les positions sont aujourd'hui écrites en dur dans les scènes (calculs à partir de `W`, de
`GRID_Y`, de nombres fixes). Il faudra les faire passer par la mise en page, ce qui est mécanique mais touche
beaucoup de lignes : d'où l'importance des captures de référence mobile.
