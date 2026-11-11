# HOT DROP : virage Warzone (spec)

Décisions du game designer (2026-11-11), issues de l'exploration des pistes. Ce qui est **décidé** est à implémenter tel quel ;
les **chiffres** sont des points de départ à régler avec `tests/balance.ts` et `tests/runsim.ts`.
Textes joueur et commentaires de code en français, comme le reste du projet.

---

## 0. Constat d'équilibrage (Viper contre Sentinelle)

Sur HEAD (c76e9b3), le miroir des sacs de départ est à ~50 % et Viper bat les bots Sentinelle du cercle 1 à ~70 %.
Le « Viper perd toujours » venait des bots Sentinelle à revolver Peu commun d'avant cf574ad.
Le vrai trou restant : **les escouades du cercle 1** (2e duel gagné à 3 % avec Viper, 7 % avec Sentinelle, faute de PV).
→ corrigé par le soin entre les duels (§ 2). Ne pas toucher aux armes de départ.

---

## 1. Fin des raretés : le craft prend leur rôle

**Décidé** : les raretés disparaissent (Commun → Légendaire, couleurs, multiplicateurs, traits légendaires, objet légendaire
qui compte double pour les familles). La puissance vient du **craft**.

- Supprimer `logic/rarity.ts` et tous ses usages : `EFFECT_MULT`, `RECHARGE_MULT`, `MAG_MULT`, `EXTRA_CHARGES`, `PRICE_MULT`,
  `ROUND_ODDS`, `rollRarity`, champ `rarity` des objets (`ItemInst`), affichage de rareté (widgets, fiches, LoadoutScene).
- `minRarity` devient **`minRound`** : cercle à partir duquel l'objet peut apparaître (0 = dès le début).
  Correspondance : minRarity 0 et 1 → 0, 2 → 1 (Aigle, silencieux, perforantes, traçantes, Bélier dès le cercle 2).
- **Fusion de 2 objets identiques → supprimée.** Remplacée par des **recettes de doublon** : deux exemplaires identiques adjacents
  donnent un objet supérieur nommé. Tous les objets n'ont pas de recette de doublon ; sans recette, deux exemplaires coexistent.
- Trois niveaux d'objets :
  - **Base** : trouvé dans le loot, la boutique, les caisses.
  - **Assemblé** : recette de 2 ou 3 ingrédients (les 10 recettes actuelles + recettes de doublon).
  - **Supérieur** : recette qui consomme au moins un objet assemblé (ex. assemblé + ingrédient). À ajouter au fil du contenu.
- Prix fixe par objet ; un objet assemblé vaut la somme de ses ingrédients (revente 50 %).
- Bots : leur progression passe par la **part d'objets assemblés** (`CRAFTED_ODDS` par niveau, +25 % pour un bot fort)
  et la qualité du placement.
- Compensation de la perte du plancher de rareté de la famille Précision : Revolver Taureau 17 → 19 dégâts, DMR Faucon 25 → 26.

Recettes de doublon de départ (à compléter) :

| Ingrédients | Résultat | Idée |
|---|---|---|
| Couteau + Couteau | Machette (1×3) | voir § 4 |
| Pistolet Mamba + Pistolet Mamba | Mamba Akimbo | 2 impacts par tir, chargeur doublé |
| Revolver Taureau + Revolver Taureau | Taureau Jumeaux | 2 impacts par tir, chargeur doublé, +10 % de critique |
| Casque + Casque | Casque lourd | armure + réduction par balle |
| Grenade frag + Grenade frag | Grenade à sous-munitions | 1 case, 26 dégâts, 3 charges |
| Trousse IFAK + Trousse IFAK | Sac médical | 28 PV, 3 charges |

Ordre fixe des recettes dans `RECIPES` quand un objet entre dans plusieurs (ex. frag : thermite, IEM, sous-munitions) ;
l'indiquer sur la fiche de l'objet.

---

## 2. Escouades : duo et escouade, PV rendus entre les duels

**Décidé** : on garde Solo < Duo < Escouade, dès le cercle 1. Entre deux duels d'une même carte, le joueur **récupère des PV**.

- Solo : 1 duel. **Duo** : 2 duels (nouveau). **Escouade** : 3 duels, 4 à partir du cercle 4.
- Soin entre deux duels : **50 % des PV manquants** (à calibrer : viser ~45 % de réussite d'un duo au cercle 1 avec le sac de départ).
- Crédits : Solo 6+2r par duel ; Duo 5+2r par duel + bonus de fin 6+2r ; Escouade 5+2r par duel + bonus de fin 10+3r.
- Sacoche en fin de chaîne : Duo 30 %, Escouade 60 %.
- Poids de tirage (`CARD_WEIGHTS`) :

| Zone | escouade | duo | solo | caisse | renforcée | shop |
|---|---|---|---|---|---|---|
| petite | 3 | 8 | 33 | 28 | 4 | 20 |
| moyenne | 12 | 16 | 28 | 14 | 6 | 20 |
| grande | 22 | 20 | 29 | 8 | 4 | 13 |

Code : `FightKind`, `CardType`, `squadDuels`, `CARD_WEIGHTS`, `drawCards` (utiliser `isFight`, pas `t === 'squad'`),
`CARD_INFO` (hud.ts), `RISK_PIPS` (ZoneScene, jusqu'à 4 duels), LoadoutScene (`p.type === 'squad'` → `total > 1`),
`resolveDuel` (`squadEnd`).

---

## 3. Munitions finies, par duel

**Décidé** : le stock est **par duel**. Une arme vide ne se recharge plus jusqu'au prochain combat ; ce sont les **états**
(saignement, poison), la **mêlée** et les **autres armes** (drone, explosifs) qui finissent le duel.
**Un duel peut durer longtemps**, ce n'est plus une affaire de 4 secondes.

- Une arme a toujours **son chargeur** (sa capacité), plein au début de chaque duel.
- Chaque objet **chargeur adjacent** à une arme de son calibre = **une recharge** de plus pour cette arme.
  Un chargeur non adjacent ne sert à rien. L'adjacence garde aussi son bonus (−25 % de temps de recharge, max 3) :
  placer ses chargeurs autour de l'arme reste le cœur du placement.
- Un chargeur adjacent à deux armes du même calibre : il sert à la première des deux qui recharge (une seule recharge au total).
- Armes assemblées à alimentation intégrée (`selfFed`) : 2 recharges intégrées. KR-4 Tactique (`feedsAny`) : tout chargeur adjacent l'alimente, quel que soit son calibre.
- `UNFED_RELOAD` disparaît : une arme sans chargeur tire son chargeur intégré, puis passe à la crosse.
- Arme à sec : grisée, icône de crosse. Elle frappe **à la crosse**, chaque arme à sec avec sa propre crosse,
  qu'il y ait ou non des armes de mêlée dans le sac.
- **Durée des duels** : cible médiane **15 à 25 s** (aujourd'hui 3 à 8 s). Levier : PV max relevés (`maxHpFor`) et/ou armure ;
  `MAX_TIME` passe de 40 à **90 s**. À calibrer par simulation.
- Rafale consomme 1,5 à 2× plus de balles : prévoir des chargeurs Rafale plus gros ou comptant double pour que Viper ne
  devienne pas le perdant structurel. Vérifier Viper/Sentinelle après calibrage.
- Interface du duel : compteur de balles par arme (« 7/15 ») + pastilles de recharges restantes par calibre.

---

## 4. Mêlée, saignement, taser

**Décidé** : les armes de mêlée **frappent en permanence** (cadence ×1,5 quand toutes les armes à feu sont à sec).

| Objet | Forme | Stats | Règle |
|---|---|---|---|
| Couteau | 1×2 | 4 dégâts / 1 s | — |
| Machette | 1×3 | 8 / 1,2 s | Couteau + Couteau |
| Masse | 1×3 | 12 / 1,8 s | perce 30 % de l'armure |
| Couteau de combat | 1×2 | 3 + 4 saignement / 1 s | — |
| Crosse (par défaut) | — | pistolet/SMG 4 / 1 s ; FA 6 / 1,2 s ; précision 7 / 1,4 s | à sec seulement, chaque arme à sec frappe, mêlée ou pas |
| Crosse renforcée | 1×1 | crosse de l'arme adjacente ×2 | — |
| Taser | 1×2 | 3 dégâts, étourdit **1,5 s** armes et mêlée | 1 charge, se déclenche quand l'adversaire recharge |
| Bandage | 1×1 | −10 saignement, +12 PV | 1 charge, à ≥ 8 saignement ou sous 50 % PV |

- **Saignement** : réserve de dégâts qui ignore l'armure, vidée à 35 %/s (au moins 2/s).
- Le taser et le flash décalent aussi les armes à sec et la mêlée.
- Les coups de crosse et de mêlée ne comptent pas dans `shots` (Feu continu, balles doublées).

---

## 5. Poison et masque à gaz

**Décidé** : le poison vient **des munitions et des armes**, le masque à gaz le contre. Pas de gaz du cercle pendant les duels.

- **Poison** : cumuls sur la cible ; chaque cumul inflige 1 dégât/s, ignore l'armure, ne décroît pas seul pendant le duel.
- **Munitions toxiques** (1 case, chargeur) : l'arme adjacente ajoute 1 cumul de poison par touche.
- **Arme empoisonnée** (ex. Couteau empoisonné = Couteau + Munitions toxiques) : 1 cumul par coup.
- **Grenade toxique** (1 case, tactique) : 4 cumuls d'un coup, 2 charges, délai 9 s.
- **Masque à gaz** (1×2, rempart) : absorbe **30 dégâts de poison**, puis inutilisable **jusqu'à la fin de la manche** (cercle).
  État conservé dans la run entre les duels et les actions d'une même manche.
- Le bandage ne soigne pas le poison (contre = masque).

---

## 6. Caisses à choix et cash

- Une caisse propose **X objets**, le joueur en prend N ; **une arme est toujours dans les propositions**.
- Les objets viennent du pool de l'opérateur, filtré par les déblocages (§ 9).

| Caisse | Proposés | Pris | Garantie | Cash | Sacoche |
|---|---|---|---|---|---|
| Ordinaire | 3 | 1 | 1 arme | 3+r | 30 % |
| **Renforcée** (nouvelle, dès le cercle 2, max 1/zone) | 4 | 2 | 1 arme + 1 ingrédient qui complète une recette déjà commencée dans le sac | 6+2r | 60 % |
| Épique (grandes zones, dès le cercle 2) | 5 | 2 | 1 arme + 1 objet assemblé | 10+3r | 50 % |

Même écran que le loot d'un ennemi (§ 7).

---

## 7. Loot intégral

**Décidé** : après un duel gagné, on peut prendre **tout** ce qu'on veut dans le sac de l'ennemi. Seule la place fait le tri.

- Toucher un objet le prend. Placement : **réserve** d'abord ; réserve pleine et sac non plein → placé **automatiquement dans le sac**
  (`findSpot`, première place libre) ; tout plein → écran **« Tout est plein »** : on choisit un objet (réserve ou sac)
  qui est **revendu** (50 %) pour faire la place ; refusé si l'objet ne rentre toujours pas.
- Bouton « Terminer » : ce qui reste est perdu. Plus de revente automatique.
- Les sacoches du bot iront dans la réserve de sacoches (3 max) quand les bots en auront (§ 10).
- Code : `lootItem`, `swapLoot`, `finishLoot` (run.ts) remplacent `takeLoot` ; `PendingLoot.items` = ce qui reste dans le sac du vaincu.
  Les caisses gardent `addDrops` jusqu'à l'étape 4.

---

## 8. Carte : déplacement au lieu du redéploiement

- **Premier drop** : parachute libre dans le cercle, comme aujourd'hui.
- Ensuite, on part de la dernière zone (`run.lastZoneId`), avec une **ligne en pointillé** jusqu'au point d'arrivée :
  - **Rester** dans la zone (si hors gaz) : gratuit, 2 cartes de moins (zone déjà fouillée, min 3).
  - **À pied ≤ 300** : gratuit.
  - **À pied 300 à 520** : embuscade, la 1re carte de la zone est un Solo forcé, joué en premier.
  - **> 520** : redéploiement payant (ballon), 15 + 5×r crédits, parachute.
  - Zone gazée : déplacement obligatoire, la zone sûre la plus proche reste toujours accessible.
- MapScene : marqueur permanent du joueur, cercles de portée (`dashedCircle`), ligne pointillée animée, déplacement du marqueur
  le long de la ligne (chute conservée pour le drop et le redéploiement).
- Plus tard : drone de reconnaissance (5 crédits, révèle les cartes d'une zone), contrats.

---

## 9. Déblocages (méta-progression)

- Clé `hotdrop.meta.v1` : `{ unlocked, runs, wins, bestRound }` dans `logic/meta.ts`.
- Pool de départ réduit ; un objet se débloque quand on le **ramasse** (loot, caisse), ou via des jalons (cercle 3, cercle 5, victoire).
- Pool effectif = `lootPool(op)` ∩ `run.unlocked` (copie figée au début de la run, pour garder les tirages déterministes).
  Au moins 1 arme garantie dans le pool.

---

## 10. Nouveaux objets et sacs à effet

Prérequis : `computeLoadout` reçoit les sacs posés.

| Nom | Forme | Famille | Règle |
|---|---|---|---|
| Porte-grenades (sac en L de 3) | `X.`/`XX` | — | explosif avec une case dessus : +1 charge |
| Sac renforcé | 2×2 | — | protection avec une case dessus : armure ×1,5 |
| Bandoulière | 1×3 | — | chargeur posé dessus : +1 recharge |
| Radar | 1×2 | tactique | toutes les 3 s, marque l'ennemi ; n'importe quelle arme consomme la marque (+50 % Sentinelle, +30 % Viper) |
| Brouilleur | 1×2 | tactique | coupe le radar adverse ; une Marque reçue s'efface après 1,5 s |
| Drone de combat | 2×2 | tactique | arme à batterie : 5 dégâts / 0,8 s, 3 batteries de 12 tirs, aucun chargeur ; continue sous taser/flash |
| Défibrillateur | 2×2 | rempart | à 0 PV, revient à 30 % PV ; une fois par action ; le Goulag seulement s'il a déjà servi |
| Bombe IEM | 1×2 | demolition | Frag + Taser : 12 dégâts, retarde armes 1,5 s et actifs 2,5 s, éteint Feu continu, Marque, drone 4 s |

Le palier 4 Tactique devient : radar et drone 25 % plus rapides. Le « Sac tactique » 2×3 existant garde son nom.

---

## 11. Mode zombie (à préparer, pas à concevoir)

`RunState.mode` + `ModeDef` qui regroupe les constantes de mode ; une **rencontre** contient une liste d'adversaires ;
le loot vient d'une **source** abstraite (sac d'un bot, table de drop).

---

## Ordre d'implémentation

1. Fin des raretés + recettes de doublon (§ 1).
2. Loot intégral + échange (§ 7).
3. Duo, escouade, PV rendus (§ 2).
4. Caisses à choix et cash (§ 6).
5. Munitions par duel, mêlée, saignement, taser, durée des duels (§ 3, § 4) : en bloc, avec recalibrage.
6. Poison et masque (§ 5).
7. Déplacement sur la carte (§ 8).
8. Sacs à effet, radar, brouilleur, drone, défibrillateur, IEM (§ 10).
9. Déblocages (§ 9).
