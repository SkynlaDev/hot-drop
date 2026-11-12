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

## Étapes suivantes

1. **1d** Courbe de difficulté : la menace monte jusqu'au Top 1 (cible : politique agressive autour de 30 à 35 % de
   Top 1 gagné, duels du cercle 5 autour de 70 %).
