# HOT DROP : combat v2 (spec)

Statuts, Endurance, composants et recettes de rang 2. Phase 2 de `VISION-F2P.md`. Les chiffres sont des points de
départ, à régler avec `tests/runsim.ts` et la matrice des archétypes.

**Décisions prises par défaut** (le concepteur n'a pas tranché ; chacune se change sans tout refaire) :

| # | Question | Choix par défaut |
|---|---|---|
| 1 | Quels statuts ? | Brûlure + Choc, plus le Saignement existant. Pas de Corrosion. |
| 2 | Munitions spéciales ? | **Chargeurs spéciaux** : ils alimentent l'arme adjacente (quel que soit son calibre) et posent le statut. |
| 3 | Composants ? | Briquet et Batterie, plus la **Ration** pour l'Endurance. Pierre à aiguiser et Ruban plus tard. |
| 4 | Saignement ? | Gardé tel quel (réserve qui s'écoule) : il marche, on n'y touche pas. |
| 5 | Noms des objets de rang 2 ? | Ceux de ce document. |

---

## 1. Endurance (le régulateur du sac)

| Règle | Valeur |
|---|---|
| Réserve | 10 points au départ du duel, régénération 1 par seconde |
| Coût d'un tir | débit de la classe × intervalle de base de l'arme : pistolet 0,55/s, SMG 0,6/s, fusil d'assaut 0,6/s, pompe 0,7/s, précision 0,7/s |
| Effet | Un tir coûte l'Endurance au moment où il part. S'il n'y en a pas assez, l'arme attend (0,1 s) : « essoufflé ». |
| Gratuit | Mêlée, objets actifs (grenades, soins, taser) |
| Lecture | Deux armes tiennent tout le duel ; trois s'essoufflent en fin de duel ; quatre tirent nettement moins. Les cadences qui montent (Feu continu, poignée) coûtent plus. |

Objets : **Ration** (composant, 1 case) +0,25 de régénération ; **Seringue d'adrénaline** : pendant l'adrénaline, les
tirs ne coûtent rien ; **Armure lourde** : tirs +10 % ; la décharge de **Choc** retire 3 d'Endurance.

## 2. Statuts

| Statut | Effet | Plafond | Contre |
|---|---|---|---|
| 🔥 **Brûlure** | Toutes les 0,5 s : 0,5 dégât par cumul, **qui ignore l'armure**. Un cumul s'éteint toutes les 3 s. | 12 | Combinaison ignifugée (−50 %), soins |
| ⚡ **Choc** | À 5 cumuls : **décharge**. Armes adverses retardées de 0,6 s, Feu continu adverse remis à zéro, −3 d'Endurance, puis 0 cumul. | seuil 5 | Plaque isolante (seuil 8) |
| 🩸 **Saignement** | Inchangé | — | Bandage, armure |

**Armes lentes** : cumuls posés par touche selon l'intervalle de l'arme : moins de 1 s → 1 ; de 1 à 2 s → 2 ;
2 s et plus → 3. Les plombs (pompe) posent leurs cumuls à chaque plomb.

## 3. Composants et recettes de rang 1

| Composant (1 case, 2-3 crédits) | Seul | Thème |
|---|---|---|
| **Briquet** | Étoile : explosif adjacent +20 % de dégâts | Chantier |
| **Batterie** | Étoile : arme adjacente +5 % de cadence | Commissariat |
| **Ration** | +0,25 d'Endurance par seconde | Hôpital |

| Recette | Résultat | Effet |
|---|---|---|
| Chargeur (9 mm, 5.56, 7.62, .44 ou 12G) + Briquet | **Chargeur incendiaire** | Alimente l'arme adjacente quel que soit son calibre ; chaque touche pose 1 Brûlure (règle des armes lentes) |
| Chargeur + Batterie | **Chargeur électrique** | Pareil, avec du Choc |
| Frag + Briquet | **Grenade incendiaire** | 14 dégâts + 4 Brûlure, 2 charges |
| Flash + Batterie | **Grenade IEM** | Étourdit + 4 Choc + éteint le Feu continu adverse |
| Taser + Batterie | **Taser lourd** | Le taser pose 5 Choc d'un coup (décharge immédiate) |

Contres (objets de base) : **Combinaison ignifugée** (protection, armure 14, Brûlure reçue −50 %), **Plaque isolante**
(protection, armure 10, seuil du Choc 5 → 8).

## 4. Recettes de rang 2 (les objets de fou)

Ingrédients : objets assemblés. Gros, rares, visibles de loin grâce aux fils bleus de la sélection.

| Recette | Objet | Effet |
|---|---|---|
| Pompe Dragon + Grenade incendiaire | **Souffle du Dragon** | Fusil à pompe : chaque plomb pose 2 Brûlure |
| Taser lourd + Chargeur électrique | **Bobine Tesla** | Arme électrique sans munitions : chaque décharge de Choc inflige en plus 30 dégâts |
| Casque lourd + Armure lourde | **Blindage Juggernaut** | Énorme armure, réduction par balle, immunisé à la décharge du Choc |
| Kit de trauma + Sac médical | **Poste de secours** | Gros soins, retire tous les statuts au 1er soin |
| Machette + Couteau de combat | **Lame rouge** | Mêlée, Saignement ×3 |
| Aigle Longue-vue + Perforantes | **Rhinocéros** | Un tir énorme qui perce toute l'armure |
| KR-4 Tactique + Chargeur tambour | **KR-4 Mitrailleur** | Chargeur 60, le Feu continu ne retombe pas à la recharge |
| Thermite + Sous-munitions | **Bombe au phosphore** | Explosion + 8 Brûlure |

## 5. Ordre d'implémentation (un commit poussé par étape)

1. **Moteur** : Endurance, Brûlure, Choc dans `combat.ts` ; affichage dans l'arène (icônes de statut, jauge
   d'Endurance, « essoufflé », décharge) ; rapport de duel (dégâts de statut attribués).
2. **Composants, recettes de rang 1, contres** (données, étoiles, bots, wiki).
3. **Recettes de rang 2**.
4. **Bots et calibrage** (archétypes, `runsim`, matrice), journal dans ce document.
5. **Sprites PixelLab** des nouveaux objets (style des armes, palette « Crépuscule »).

---

## Journal

**Étape 1 (moteur, fait)** : Endurance (réserve 10, +1/s, coût par tir = débit de la classe × intervalle de base ;
la cadence gagnée par le Feu continu ne coûte rien en plus, sinon Viper tombait à 41 % au Top 1), Brûlure et Choc
dans `combat.ts` (nouveaux événements `burn`, `discharge`, `tired`), rapport de duel (dégâts de Brûlure attribués,
décharges, essoufflements), arène (jauge d'Endurance dorée, pastilles flamme et éclair, « DÉCHARGE », « ESSOUFFLÉ »).
Aucun objet ne pose encore de statut (étape 2). Mesure (`runsim 40`) : agressif 38 % de Top 1 (inchangé), prudent
3 % (contre ~15 %) : à calibrer à l'étape 4.

**Étape 2 (composants, rang 1, contres : fait)** : Briquet, Batterie, Ration (nouvelle catégorie « Composant », 8 %
du butin, thèmes Chantier / Commissariat / Hôpital) ; Chargeur incendiaire et Chargeur électrique (5 recettes
chacun, un par calibre), Grenade incendiaire, Grenade IEM, Taser lourd ; Combinaison ignifugée et Plaque isolante
(à partir du 2e cercle). Fiches d'objets à jour (statuts, Endurance par tir). Ces objets sont **réservés au joueur**
jusqu'au calibrage des bots (`BOT_EXCLUDED` dans `bots.ts`, étape 4) : avec eux, la Brûlure faisait tomber Rempart
à 17 % au Top 1. Icônes provisoires en attendant les sprites (étape 5).

**Étape 3 (rang 2 : fait)** : Souffle du Dragon, Bobine Tesla (chaque décharge déclenchée : +30 dégâts qui ignorent
l'armure), Blindage Juggernaut (armure 140, −4 par balle, immunisé à la décharge, tirs +15 % d'Endurance), Poste de
secours (gros soins, retire les statuts au 1er soin), Lame rouge, Rhinocéros (130 dégâts, perce toute l'armure),
KR-4 Mitrailleur (chargeur 60, Feu continu gardé à la recharge), Bombe au phosphore. Vérifié en jeu : pastilles de
statut, décharges, rapport (« 5 décharges », « dont 120 de brûlure », « essoufflée 1 fois »). Réservés au joueur
jusqu'à l'étape 4.
