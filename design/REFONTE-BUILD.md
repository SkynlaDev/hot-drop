# HOT DROP : refonte « plaisir de build » (spec)

Remplace les parties de `PISTES-WARZONE.md` qu'elle contredit. Objectif : retrouver le plaisir de Backpack Battles
(construire un sac qui devient monstrueux, voir les liens d'un coup d'œil, viser un build différent à chaque partie)
en gardant ce qui distingue HOT DROP : la carte, les zones, les cercles de gaz, les cartes d'action, le Goulag.

## 0. Diagnostic (novembre 2026)

| Problème | Constat |
|---|---|
| Liens pauvres | 12 types de synergie, tous « accessoire collé à une arme ». 15 objets (protections, soins, explosifs) n'ont aucun lien. Le lien n'apparaît qu'une fois l'objet posé. |
| Peu de chemins | ~25 objets par opérateur, Sentinelle n'a que 4 armes de base. On prend ce qui tombe, on ne vise pas un build. |
| Boucle diluée | Munitions finies, duo/escouade, fouille intégrale : des couches qui font subir plutôt que construire. |
| Progression floue | Les recettes se voient mal ; la zone choisie ne change rien au butin. |

## 1. Ce qu'on retire (retour arrière assumé)

| Mécanique | Remplacée par |
|---|---|
| Munitions finies, crosse, « CHG ×N » | Les armes rechargent sans fin. Un chargeur adjacent de son calibre accélère la recharge (−25 %, max 3) ; sans chargeur, recharge ×2 (règle d'avant l'étape 5). On garde la mêlée, le saignement, le taser, le bandage. |
| Duo et escouade | Un combat = un duel. Le risque passe par la carte **Élite** (bot fort, meilleur butin). |
| Fouille intégrale | On fouille toujours le sac du vaincu, mais on n'y prend qu'**1 objet** (2 après une Élite), + crédits. Le thème de la zone orientera le contenu des sacs (étape 5). |
| Opérateurs exclusifs | **Pool commun** : tout le monde peut prendre toutes les armes. Chaque opérateur a quelques **objets de signature** (exclusifs) et son passif. Les familles et leurs paliers restent : se spécialiser reste récompensé. |

**Fait (étape 1)** :
- Munitions infinies, règle « sans chargeur, recharge ×2 » rétablie, crosse et crosse renforcée retirées. La mêlée frappe
  ×1,5 dans un sac sans arme à feu (build Lame).
- Cartes Solo et **Élite** (bot fort, 2 objets, 10 + 3r crédits, sacoche 40 %). Sauvegarde passée en `v8`.
- Pool commun ; signatures : chargeur tambour et refroidisseur (Viper), traçantes (Sentinelle), et ce qui s'assemble
  avec. Les bots gardent un pool « cœur » (`corePool`) pour rester cohérents.
- Recalibrage : chargeurs des armes remis à leur valeur d'avant l'étape 5 ; armes de précision (hors revolver et
  Colibri) +28 à +36 % de dégâts ; sac de départ de Sentinelle : poignée verticale au lieu du viseur holo ; bot du
  Goulag bien rangé. Durées médianes 12 à 19 s ; Viper contre Sentinelle 45 à 54 % à chaque cercle.

## 2. Les étoiles (le cœur de la refonte)

Chaque objet peut avoir des **étoiles** : des cases précises autour de sa forme (elles tournent avec l'objet) qui
attendent un type d'objet. Une étoile est **remplie** quand un objet du bon type occupe sa case.

- **Tous les objets** en ont, pas seulement les accessoires : protections, soins, explosifs, mêlée.
- **Effet** écrit sur la fiche : « ★ Explosif : +1 charge à cet explosif ». L'effet s'applique soit à l'objet porteur
  (« ★ Protection : +5 d'armure »), soit à l'objet posé sur l'étoile (« ★ Arme 9 mm : −25 % de recharge à cette arme »).
- Un même voisin qui couvre plusieurs étoiles du même objet ne compte qu'une fois.
- **Quoi** : un tag (`arme`, `arme_longue`, `melee`, `explosif`, `medical`, `protection`, `munition`, `accessoire`),
  éventuellement un calibre.

**Fait (étape 2, moteur)** : `src/logic/stars.ts` (`starSpecs`, `starCells` avec rotation, `bagStars`, `starsLitBy`),
`ItemDef.stars` (cases `at`, `want`, effet `self`/`target` : armure, dégâts, cadence, charges, soin, saignement, `max`).
`computeLoadout` applique les effets et renvoie `stars` ; la fiche affiche « ★ Ce qu'elle attend : ce qu'elle apporte ».
Les accessoires gardent exactement leur règle d'adjacence : l'équilibre ne bouge pas.

### Lecture d'un coup d'œil

- **Objet tenu** (glissé ou sélectionné) : ses étoiles s'affichent sur la grille, grises si vides, dorées si remplies
  à cet endroit. Les objets déjà posés dont une étoile **serait remplie** par l'objet tenu pulsent en vert.
- **Objet posé** : pastille « ★ 2/4 » (étoiles remplies / total) ; les étoiles remplies dessinent un trait doré vers le voisin.
- **Fiche** : la liste des étoiles avec leur effet, cochées ou non.
- **Boutique et butin** : un objet qui remplirait une étoile du sac porte « ★ », un objet qui complète une recette porte « ⚗ ».

### Conversion des synergies actuelles

Les synergies existantes deviennent des étoiles posées sur tous les côtés de l'accessoire, qui attendent une arme
(du bon calibre pour les chargeurs, longue pour la lunette et le bipied, etc.). Mêmes effets, nouvelle lecture.

## 3. Builds visés (archétypes)

Chaque archétype a des **objets clés** reconnaissables et des étoiles qui se renforcent entre elles.

| Archétype | Opérateur | Objets clés | Moteur |
|---|---|---|---|
| Feu continu | Viper | SMG, fusils d'assaut, chargeur tambour, refroidisseur | gros chargeurs, cadence qui monte |
| Akimbo | Viper | Mamba Akimbo, Furet Akimbo | recettes de doublon, double impact |
| Marque | Sentinelle | deux armes, traçantes | une arme marque, l'autre achève |
| Tir lourd | Sentinelle | Aigle, lunette, bipied, silencieux | 1er tir critique, critiques énormes |
| Démolition | tous | grenades, gilet de grenadier, pompe | charges en plus, explosions qui percent |
| Rempart | tous | plaques, casques, soins | armure qui se régénère, soins renforcés |
| Lame | tous | couteaux, machette, masse, bandage | saignement qui ignore l'armure |

## 4. La carte au service du build

- Chaque zone a un **thème** affiché sur la carte : Armurerie (armes), Hôpital (soins et protections),
  Chantier (explosifs), Commissariat (accessoires et chargeurs), Marché noir (boutique). Le butin des combats et des
  caisses de la zone vient pour moitié de son thème. **Choisir sa zone, c'est choisir où va son build.**
- **Ravitaillement** entre deux cercles : une boutique garantie (5 offres, relance, verrou d'une offre, revente à 50 %).
  C'est le moment « Backpack Battles » de chaque cercle.
- Cartes d'action : Combat (solo), **Élite** (bot fort, butin 1 parmi 4), Caisse, Boutique.

## 5. Ordre d'implémentation (un commit poussé par étape, tests au vert)

1. **Retours arrière** : munitions infinies, combats solo + Élite, butin 1 parmi 3, pool commun + signatures.
2. **Étoiles, moteur** : modèle de données, `computeLoadout`, conversion des synergies, tests.
3. **Étoiles, interface** : objet tenu, pastilles, fiche, marques ★ et ⚗ en boutique et au butin.
4. **Étoiles partout** : protections, soins, explosifs, mêlée ; objets clés des archétypes.
5. **Zones à thème** et **ravitaillement** entre les cercles.
6. **Recalibrage** (`tests/balance.ts`, `tests/durations.ts`, `tests/runsim.ts`).
7. **Son** et **pixel art unifié** (icônes au format des formes, cf. `design/pixellab-test/armes`).
