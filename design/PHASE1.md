# Phase 1 : boucle tendue (journal)

Objectif et critère de sortie : `VISION-F2P.md` §7. Mesures avec `tests/runsim.ts 40` (deux politiques simulées :
prudent et agressif ; un humain joue mieux que la politique agressive).

## Point de départ (12 novembre 2026)

| | Prudent | Agressif |
|---|---|---|
| Top 1 gagné | 40 % | 70 % |
| Duels finaux gagnés | 89 % | **100 %** |
| Duels gagnés au cercle 5 | 57 % | 92 % |

La difficulté est inversée : dure au début, facile à la fin. Le kit de départ seul perd dès le cercle 2 (6 %),
mais la menace des bots plafonne (DPS moyen 49 au cercle 3, 54 au cercle 5).

## Étape 1a : bots par archétype (fait)

- `src/data/archetypes.ts` : 7 archétypes (Feu continu, Akimbo, Marque, Tir lourd, Démolition, Rempart, Lame), chacun
  avec ses armes, ses objets assemblés visés et ses objets préférés. Feu continu est réservé à Viper, Marque à Sentinelle.
- `generateBot` : le bot tire son archétype puis 80 % de ses objets dans le plan (40 % au 1er cercle : on vient
  d'atterrir), le reste dans son pool « cœur ». Pool commun (`lootPool`) : un bot peut jouer toutes les armes.
  Les armes de l'archétype échappent au plafond de prix (hors 1er cercle). Marque : toujours deux armes. Rempart : pas
  d'accessoire d'arme, la place va à l'armure et aux soins. Lame : à partir du cercle 3, jamais au Top 1. Pas d'objet de
  signature au 1er cercle.
- Rangement des bots : les protections passent avant les accessoires (un sac plein abandonne un viseur, pas son armure).
- Affichage : l'archétype est écrit dans le panneau adverse, et sa phrase dans « Son sac ».

Mesures après 1a :

| | Prudent | Agressif |
|---|---|---|
| Top 1 gagné | 25 % | 43 % |
| Duels finaux gagnés | 59 % | 77 % |
| Duels gagnés au cercle 5 | 53 % | 95 % |

**Écarts d'équilibre révélés** (bots contre bots de même tour, pour la phase 2) : Démolition 60 à 66 % et Akimbo
60 à 65 % en fin de partie ; Rempart 31 à 38 %, Feu continu 35 à 42 %, Tir lourd 33 à 43 %. Ce sont surtout les objets
qui sont en cause (grenades assemblées qui ignorent l'armure, pistolets jumelés), pas les plans des bots.

## Étape 1b : largage de départ (fait)

- Le kit de départ n'a plus d'arme ni de chargeur : casque, couteau et l'accessoire de l'opérateur (refroidisseur ou
  poignée), rangés en bas du sac pour laisser les deux rangées du haut libres.
- `newRun` ouvre une caisse **Largage** (`landingOffers`) : 3 armes de classes différentes, prix ≤ 8, dont au moins une
  de la famille de l'opérateur, ordre mélangé. On en garde une ; elle va directement dans le sac avec son chargeur
  (`landingMag`), posé contre elle. Impossible de terminer sans avoir choisi.
- L'écran des opérateurs montre le kit sans arme (« arme au largage »).
- `tests/runsim.ts` essaie les 3 armes et garde la meilleure.

Mesures après 1b (40 runs) : prudent 38 % de Top 1 gagné (68 % des duels finaux), agressif 48 % (83 %). La politique
choisit la meilleure arme au largage, d'où une légère hausse : la courbe de difficulté (1d) reste à faire.

## Étape 1c : verrou de boutique (fait)

La boutique de fin de zone existait déjà : c'est le **ravitaillement** (une zone par cercle). Ajouté : le **verrou**.
Un cadenas sur chaque offre ; une seule offre verrouillée à la fois. Elle garde sa place aux relances, puis passe à la
boutique suivante (carte Boutique ou ravitaillement), jusqu'à ce qu'on l'achète ou la déverrouille (`toggleLock`,
`keepLockedOffer`). On peut ainsi viser une pièce chère sur deux boutiques.

## Étape 1d : courbe de difficulté (fait)

| Réglage (`src/logic/bots.ts`) | Avant | Après |
|---|---|---|
| Objets des bots par cercle (`BOT_ITEMS`) | 4, 6, 7, 8, 9 | 4, 6, 8, 10, 12 |
| Objets du Top 1 (`FINAL_ITEMS`) / niveau (`FINAL_LEVEL`) | 9 / 5 | 12 / 6 |
| Chance d'objets assemblés par niveau (`CRAFTED_ODDS`) | 0 → 0,8 | 0 → 0,85, plus tôt |
| Build Lame (`LAME_FROM`) | — | à partir du 4e cercle (trop fort au 3e) |
| Rangement des bots | — | lames juste après les armes (un Lame ne perd plus ses lames) |

Passe d'équilibrage d'objets (ce qui écrasait tout) :

| Objet | Avant | Après |
|---|---|---|
| Mamba Akimbo | 11 dégâts / 0,75 s | 9 / 0,8 s |
| Taureau Jumeaux | 21 dégâts | 18 |
| Pompe Dragon | 16 dégâts + 5 qui ignorent l'armure par plomb | 15 + 3 |
| Grenade à sous-munitions | 26 dégâts | 22 |
| Ours Déluge | 8,5 dégâts | 9,5 |
| KR-4 Tactique | 11 dégâts | 12,5 |
| Archétype Feu continu | 40 % de protections | 15 % (plus de puissance de feu) |
| Archétype Rempart | 50 % de protections | 35 % |

Essai écarté : faire suivre l'armure et les soins aux PV. Ça n'aidait pas Rempart et déréglait les autres archétypes.

**Mesures finales** (60 runs par politique) :

| | Avant la phase 1 | Après | Cible |
|---|---|---|---|
| Agressif : Top 1 gagné | 70 % | **32 %** (Viper 30 %, Sentinelle 33 %) | 30 à 35 % |
| Agressif : duels finaux gagnés | 100 % | 73 % | |
| Agressif : duels gagnés par cercle | 83 / 83 / 94 / 88 / 92 % | 79 / 81 / 59 / 73 / 74 % | ~70 % au cercle 5 |
| Prudent : Top 1 gagné | 40 % | ~15 % | |

Un humain qui range bien fait mieux que la politique agressive : le Top 1 devrait se situer plus haut pour toi.
C'est au playtest de le confirmer.

**Écarts restants pour la phase 2** : en fin de partie, Akimbo (65 à 74 %) et Démolition (66 à 71 %) dominent ;
Rempart (29 à 39 %) et Feu continu (31 à 43 %) souffrent. Cause principale : la **densité des objets**. Les petits
objets (grenades d'une case, pistolets jumelés en 2×2) permettent 13 à 14 objets par sac, les gros (armure lourde,
SMG lourds) 10 à 11. Piste : valeur par case, ou des effets qui récompensent les gros objets.

## Playtest 1 (concepteur, 12 novembre 2026)

Viper, Top 1 gagné sans Goulag avec 336 PV sur 1 050, duels serrés en route. Sac final de 18 objets : KR-4 Tactique +
KR-4 (tambour partagé, chargeur 5.56, silencieux, refroidisseur), armure lourde, casque lourd, 2 kits de trauma, sac
médical, 2 bandages, adrénaline, fumigène, taser, masse, machette. Boss : Akimbo (Taureau Jumeaux ×2).

Sac reconstitué contre 400 boss du Top 1 : **86 %** de victoires en Viper, **72 %** en Sentinelle (le Feu continu
vaut environ 14 points). Causes : 18 objets contre 12-13 pour le boss (grille du boss plafonnée à 8×6), mélange de deux
plans (Feu continu + Rempart) que les bots ne font pas, et un simulateur qui remplit mal son sac (12-13 objets).

Décision : on laisse en l'état ; d'autres testeurs et d'autres points de départ d'abord. Pistes si le Top 1 reste
trop facile : simulateur qui remplit son sac comme un humain, puis boss à sac plein (9×7, 15-16 objets, deux plans).

## Critère de sortie

Playtest de 5 personnes : Top 1 gagné 30 à 45 % des runs, au moins 3 archétypes différents parmi les sacs gagnants,
« j'ai envie de relancer ».
