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

## Étapes suivantes

1. **1b** Kit de départ « surplus » et caisse de largage 1 parmi 3.
2. **1c** Boutique à la fin de chaque zone, verrou d'une offre.
3. **1d** Courbe de difficulté : la menace monte jusqu'au Top 1 (cible : politique agressive autour de 30 à 35 % de
   Top 1 gagné, duels du cercle 5 autour de 70 %).
