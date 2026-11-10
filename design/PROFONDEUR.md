# HOT DROP : profondeur de build (proposition)

Document de design, pas une spec figée. Les chiffres sont des **points de départ** à régler avec `tests/balance.ts` et `tests/runsim.ts`.
Tout s'appuie sur ce qui existe : `computeLoadout` (stats.ts) pour les effets de placement, `simulateDuel` / `act()` (combat.ts) pour le temps réel du duel.

---

## 1. Diagnostic

### Ce qui fait la profondeur de Backpack Battles

| Levier BB | Ce que ça apporte | HOT DROP aujourd'hui |
|---|---|---|
| **Déclencheurs** (« au début », « toutes les 3 s », « quand tu bloques », « à 10 cumuls ») | Le combat a une **chronologie** : l'ordre et le moment comptent, pas seulement des stats | Presque rien : le 1er tir critique, la Marque, le Feu continu. Les synergies sont des bonus de stats fixes |
| **Ressources qui s'empilent** (Régénération, Poison, Mana, Vampirisme, Épines…) | Des objets qui **produisent** et d'autres qui **consomment** : des moteurs | Aucune ressource partagée entre objets |
| **Beaucoup d'objets** (~300) et beaucoup de types d'interaction | Chaque partie trouve un chemin différent | ~35 objets, ~11 types de synergie, tous « arme + accessoire » |
| **Classe + sous-classe** (objet emblème acheté en cours de partie) | Identité forte, décision structurante à mi-partie | Opérateur choisi au début, puis plus aucune bifurcation |
| **Sacs à effets** (sac de soins, sac à potions, sac du feu…) | La couche « sac » devient elle-même un choix de build | Sacoches = de la place en plus, rien d'autre |
| **Boutique** (verrouillage, réserve, revente, objets en solde) | Décisions économiques à chaque manche | Boutique simple (reroll), carte « Shop » parmi d'autres |

### Les 3 manques qui comptent le plus

1. **Pas de temps dans le duel** : sans déclencheurs ni statuts, un sac se résume à un DPS. → section 2 (statuts) + section 5 (déclencheurs).
2. **Pas de moteur propre à l'opérateur** : Feu continu et Marque sont des bonus, pas des ressources que des objets alimentent et dépensent. → section 4.
3. **Couche sacoche inerte** : on pose la sacoche la plus grande, point. → section 3.

(La spécialisation au cercle 3 est le 4e levier ; elle ne vaut quelque chose qu'une fois 1 à 3 en place.)

---

## 2. Types de balles : la catégorie « Munition spéciale »

### Règles

| Règle | Détail |
|---|---|
| Forme | 1 case (`X`) : une boîte de cartouches. Les explosives font `XX`. |
| Lien | Une munition spéciale **adjacente** à une arme change ses balles. Elle **n'alimente pas** l'arme : il faut toujours un chargeur de son calibre. Le périmètre de l'arme devient la ressource rare (chargeur + munition + accessoires). |
| 1 munition = 1 arme | Si elle touche 2 armes, elle n'en sert qu'une : **tap sur la munition pour basculer le lien** (défaut : l'arme la plus grande). Pas de distribution à plusieurs armes (on ne refait pas la bande). |
| 1 type par arme | Une arme accepte **un seul** type de balle. Deux munitions différentes adjacentes : la plus rare gagne (égalité : la dernière posée), l'autre affiche un lien grisé « ⊘ ». **Deux munitions identiques** adjacentes : effet +50 % (max 2). |
| Calibre | Aucun : une munition spéciale va sur toute arme. (Les chargeurs gardent le calibre.) |
| Rareté | L'effet suit `EFFECT_MULT` comme les autres synergies. |
| Armes lentes | **Cumuls par touche selon la cadence** : intervalle < 1 s → 1 cumul ; 1 à 2 s → 2 ; ≥ 2 s → 3. Un fusil de précision incendiaire vaut un SMG incendiaire sur 4 s. Affiché sur la fiche : « ×3 cumuls (arme lente) ». |
| Escouade | Les statuts s'effacent entre deux duels d'une escouade (exception : talent Mitrailleur, §4). |

Les objets existants `perforantes` et `tracantes` **deviennent** des munitions spéciales (même effet, nouvelle règle 1 type par arme).

### Les statuts (ressources qui s'empilent sur l'adversaire)

Conçus pour peser en 3 à 5 s : pas de décroissance pendant le duel, seuils bas, effet immédiat.

| Statut | Effet | Plafond | Pourquoi ça compte en 4 s | Lecture sur téléphone |
|---|---|---|---|---|
| **Brûlure** | Toutes les 0,5 s : 0,5 dégât par cumul, **ignore l'armure** | 12 | SMG à 0,4 s : ~5 cumuls à 2 s → ~20 dégâts sur un duel de 4 s (~15 % des PV au cercle 2) | Flamme orange + chiffre sur la barre de PV adverse ; petits chiffres orange qui montent |
| **Saignement** | Chaque cumul : **+1 dégât sur chaque touche reçue** (toutes sources). Ne s'applique que si la balle touche les PV (pas l'armure) | 5 | Effet immédiat dès la 2e touche ; récompense le volume de touches (plombs, Rafale palier 4) | Goutte rouge + chiffre ; les impacts suivants affichent le bonus en rouge |
| **Choc** | À **5 cumuls : Décharge** → armes adverses retardées 0,4 s, objets actifs adverses retardés 0,5 s, **Feu continu adverse remis à 0**, Chaleur adverse −10. Puis retour à 0 | 5 (seuil) | Un revolver (2 cumuls/touche) décharge en 3 touches ; contre de Viper | Éclair bleu en 5 segments ; à la Décharge, flash bleu sur le sac adverse |
| **Marque** (existe) | Touche suivante d'une autre arme +50 % | 1 (3 en Pistolero) | Déjà en place | Cible rouge sur le portrait adverse (pips si cumulée) |

### Les munitions spéciales

| Munition | Pool | Prix / rareté min | Effet (Commun) | Statut |
|---|---|---|---|---|
| Munitions incendiaires | Viper | 5 / Peu commun | +1 Brûlure par touche | Brûlure |
| Munitions à pointe creuse | Viper | 5 / Peu commun | +1 Saignement par touche sur les PV ; −20 % de dégâts contre l'armure | Saignement |
| Munitions +P (surpression) | Viper | 4 / Commun | +15 % de dégâts ; +1 Chaleur par tir (§4) | Chaleur |
| Munitions électriques | Sentinelle | 5 / Peu commun | +1 Choc par touche | Choc |
| Munitions subsoniques | Sentinelle | 5 / Peu commun | −10 % de dégâts ; la **1re balle après chaque recharge** est critique | (Marque) |
| Munitions de match | Sentinelle | 6 / Rare | Critiques de cette arme ×2,5 au lieu de ×2 | — |
| Perforantes (existe) | Sentinelle | 6 / Rare | Perce 30 % de l'armure | — |
| Traçantes (existe) | Sentinelle | 5 / Rare | Marque consommée par cette arme : +30 % | Marque |
| Munitions explosives `XX` | Neutre | 8 / Épique | Toutes les 4 touches : explosion 8 dégâts qui ignorent l'armure + **détruit 10 d'armure** | — |

### Réactions (combos nommés)

Au plus 4 réactions, chacune avec un texte flottant (« COURT-CIRCUIT ! ») : c'est le moment « juice ».

| Réaction | Condition | Effet | Qui l'atteint |
|---|---|---|---|
| **Court-circuit** | Décharge de Choc sur une cible en Brûlure | Tick de Brûlure immédiat ×3 | Croisement Viper/Sentinelle : accessible quand Grenade IEM et Grenade incendiaire passent au neutre (Q8) |
| **Hémorragie** | Saignement sur une cible **sans armure** | Les cumuls comptent double | Pointe creuse + perforantes/explosives sur une 2e arme |
| **Exécution** | Marque consommée sur une cible avec ≥ 3 Saignement ou ≥ 6 Brûlure | Les dégâts de la touche +50 % de plus | Sentinelle avec un pistolet saigneur (Pistolero) |
| **Embrasement** | Explosion (munitions explosives, frag) sur une cible en Brûlure | +50 % de dégâts d'explosion, +3 Brûlure | Viper + explosifs neutres |

Interactions avec les passifs :
- **Feu continu** accélère les tirs → plus de touches → plus de Brûlure / Saignement. Le Choc adverse le remet à 0 : c'est son contre naturel.
- **Marque** : les Subsoniques garantissent un critique par chargeur, donc une Marque par chargeur ; les munitions de match grossissent le critique qui marque.

---

## 3. Sacoches à effets

### Règles

| Règle | Détail |
|---|---|
| « Posé sur » | Un objet est **sur** une sacoche si au moins une de ses cases la couvre. Badge : petite icône de la sacoche dans le coin de l'objet. |
| Cumul | Un objet à cheval sur 2 sacoches prend les 2 effets (c'est le puzzle). Un même effet ne se cumule pas avec lui-même. |
| Taille | Une sacoche à effet est **plus petite ou plus chère** qu'une sacoche nue de même surface : on troque de la place contre un effet. Les 4 sacoches nues restent. |
| Rareté | Pas de rareté. **Fusion** de 2 sacoches identiques → version « + » (effet ×1,5, même forme). |
| Pool | Comme les objets : neutre, Viper, Sentinelle, ou spécialisation. |
| Bots | À partir du cercle 3, une partie de la grille rectangulaire du bot est déclarée « sacoche virtuelle » (même effet, sans changer sa forme). |
| UI | Sur la grille, la sacoche est teintée par son effet ; un appui long sur elle surligne les objets concernés. |

### Catalogue

| Sacoche | Forme | Prix | Fréquence | Pool | Effet sur les objets posés dessus |
|---|---|---|---|---|---|
| Poche à munitions | `XX` | 6 | Courante | Viper | Armes : **toujours alimentées** (chargeur intégré) et chargeur +20 % |
| Housse isotherme | `XX/XX` | 9 | Peu courante | Viper | Armes : la recharge ne fait retomber le Feu continu **qu'à moitié** ; immunisées à la remise à 0 par le Choc |
| Sacoche de cuisse | `X/X` | 5 | Courante | Neutre | Objets actifs : **1er déclenchement 50 % plus tôt** |
| Trousse médicale | `XX/XX` | 8 | Peu courante | Neutre (Rempart) | Médical : soins +30 %, +1 charge ; retire tous les statuts au 1er soin |
| Porte-grenades | `XXX` | 7 | Peu courante | Neutre | Explosifs : +1 charge, 1er lancer à 1 s |
| Pochette blindée | `XX/XX` | 9 | Peu courante | Neutre (Rempart) | Protections : armure +25 % ; mais **toutes les cases de la sacoche** doivent être occupées par des protections, sinon rien (contrainte de remplissage) |
| Holster | `X/X` | 5 | Courante | Sentinelle | Pistolets/revolvers : **tirent en premier** (1er tir à 0,1 s) et 1er tir +25 % de critique |
| Fourreau long | `XXXXX` | 10 | Rare | Sentinelle | Armes longues : +15 % de dégâts ; leur 1re Marque consommée donne +2 Repérage (§4) |
| Boîte à munitions | `XX` | 6 | Peu courante | Neutre | Munitions spéciales : **+1 cumul** de statut par touche (ou +30 % pour un effet sans statut) |
| Musette d'équipe | `XX/X.` | 10 | Rare | Neutre | Chaque objet dessus compte **+1 pour les paliers de famille** (max +2 par sacoche) |
| Sac de contrebandier | `XX/XX` | 7 | Rare | Neutre | Économie : +1 crédit par duel gagné par objet posé dessus (max 4) ; ces objets ont −10 % d'effet |
| Sac de tir (spé Sniper) | `XXX/XXX` | 12 | Spé | Sniper | Armes longues : +1 cumul de statut par touche, 1er tir garanti touché (ignore le fumigène) |

Ce qui rend la couche « sacoche » décisionnelle :
- La **forme** de la sacoche dicte quels objets peuvent y tenir (Fourreau long 1×5 pour le Rhinocéros 6 cases de large, Holster vertical pour 2 pistolets côte à côte).
- Les sacoches **étendent** la grille hors du sac de base 5×4 : le Rhinocéros (§4) ne rentre **que** sur des sacoches.
- Effets en tension : Contrebandier (économie maintenant) vs Boîte à munitions (puissance), Pochette blindée (remplissage imposé).

---

## 4. Profondeur par opérateur

### Ressources

| Opérateur | Ressource | Gain | Plafond | Dépense / lecture | UI |
|---|---|---|---|---|---|
| Viper | **Chaleur** (sur soi, globale) | +1 par balle tirée par une arme Rafale ; munitions +P : +1 de plus | 30 (50 en Mitrailleur) | Des objets se déclenchent à des **paliers** (10/20/30) ou **dépensent** toute la Chaleur à la recharge. La recharge ne la remet **pas** à 0 (contrairement au Feu continu). Décharge de Choc adverse : −10 | Jauge orange verticale à côté du portrait, crans à 10/20/30, vapeur quand pleine |
| Sentinelle | **Repérage** (sur soi) | +1 par critique, +1 par Marque consommée | 10 | Paliers (3/6) et dépense totale (« Calculateur ») | 10 pips bleus sous le portrait |

Le passif reste tel quel (Feu continu / Marque) : la ressource est le **canal** par lequel les nouveaux objets lisent ce passif.

### Viper : nouveaux objets (pool de base)

| Objet | Forme | Catégorie | Prix / rareté min | Effet (Commun) |
|---|---|---|---|---|
| Munitions incendiaires | `X` | Munition spéciale | 5 / 1 | +1 Brûlure par touche |
| Munitions à pointe creuse | `X` | Munition spéciale | 5 / 1 | +1 Saignement par touche sur les PV, −20 % contre l'armure |
| Munitions +P | `X` | Munition spéciale | 4 / 0 | +15 % de dégâts, +1 Chaleur par tir |
| SMG Piranha | `XXX/X..` | Arme (SMG 9 mm) | 7 / 0 | 3,5 dégâts / 0,3 s, chargeur 25, recharge 2,4 s ; Feu continu monte 2× plus vite |
| Manchon thermique | `XX` | Accessoire | 5 / 1 | Arme adjacente : tant que Chaleur ≥ 15, chaque touche +1 Brûlure |
| Purge de culasse | `X/X` | Accessoire | 5 / 1 | **Quand l'arme adjacente recharge** : dépense toute la Chaleur, 1 armure réparée par point |
| Sangle 3 points | `XXX` | Accessoire | 4 / 0 | Arme adjacente : après une recharge, le Feu continu repart à +10 % au lieu de 0 |
| Grenade incendiaire | `X` | Explosif | 5 / 0 | 12 dégâts + 4 Brûlure, 2 charges, délai 7 s |
| Gilet de refroidissement | `XX/XX` | Protection | 6 / 1 | Armure 15 ; à 30 Chaleur (Surchauffe) : +20 % de cadence pour toutes les armes pendant 2 s, une fois |

### Viper : spécialisations (cercle 3)

| Spé | Passif | Objets exclusifs |
|---|---|---|
| **Mitrailleur** (volume, tenir la gâchette) | « Tir de saturation » : Chaleur max 50 ; à 50, toutes les armes percent 25 % d'armure. Les armes à chargeur ≥ 30 ne perdent que la moitié du Feu continu à la recharge. Chaleur conservée **à moitié** entre deux duels d'escouade | **LMG Bison** `XXXXX/.XX..` (mitrailleuse 5.56 : 7 dégâts / 0,45 s, chargeur 50, recharge 5 s) · **Boîte de 200 coups** `XX/XX` (alimente **une** arme adjacente, chargeur +50 %) · **Affût** `XX/XX` (arme adjacente à chargeur ≥ 30 : +20 % de dégâts) · **Canon de rechange** `XXX` (1re recharge de l'arme adjacente instantanée) |
| **Fusilier** (rafales précises, statuts doublés) | « Rafale contrôlée » : les fusils d'assaut tirent par rafales de 3 ; la 3e balle de chaque rafale fait +40 % et applique **2×** le statut de sa munition | **Fusil de combat Krait** `XXXX/..X.` (5.56 : 9 dégâts / 0,6 s, chargeur 18, recharge 2,3 s) · **Chargeurs jumelés** `X/X` (compte comme chargeur 5.56 ; 1re recharge instantanée) · **Viseur reflex** `X` (fusil d'assaut adjacent : +10 % de critique ; un critique applique +2 cumuls) · **Couteau de combat** `X/X` (**quand une arme recharge** : 8 dégâts qui ignorent l'armure) |

### Viper : recettes

| Ingrédients adjacents | Résultat | Effet |
|---|---|---|
| Munitions incendiaires + Munitions +P | **Munitions thermite** (`X`) | +2 Brûlure par touche, +1 Chaleur par tir |
| SMG Piranha + Munitions à pointe creuse | **Piranha Saigneur** (`XXX/XX.`) | Alimentation intégrée, Saignement natif (sans occuper de place pour la munition) |
| Fusil d'assaut KR-4 + Manchon thermique + Munitions incendiaires | **KR-4 Brasier** (`XXXX/.XX.`) | Alimentation intégrée, Brûlure native, +2 Chaleur par tir |
| LMG Bison + Boîte de 200 coups (Mitrailleur) | **Bison Mastodonte** (`XXXXX/.XXX.`) | Chargeur 100, Feu continu max +45 %, jamais remis à 0 |
| Grenade incendiaire + Fumigène | **Grenade au phosphore** (`X/X`) | Fumigène + 6 Brûlure à l'adversaire |

### Viper : builds de fin de partie

| Build | Cœur et placement | Pourquoi ça marche | Faible contre |
|---|---|---|---|
| **Brasier** (Mitrailleur) | Bison Mastodonte sur une Housse isotherme ; Munitions thermite + Affût collés au Bison ; Manchon thermique sur un SMG Piranha secondaire ; Gilet de refroidissement ; Boîte à munitions sous la thermite | Chaleur 50 → perce l'armure ; Brûlure ×3 cumuls/touche qui ignore l'armure : détruit les tanks | Alpha Sniper (mort avant la montée), Choc (remet tout à 0), Trousse médicale adverse (purge) |
| **Saigneur** (Fusilier) | Krait + Viseur reflex + pointe creuse ; Piranha Saigneur à côté ; Rafale palier 4 pour doubler les touches ; Couteau de combat entre les deux armes | Volume de touches × Saignement × 2 sur la 3e balle ; Hémorragie si l'adversaire n'a pas d'armure | Armure lourde (pointe creuse −20 %, réduction par balle), Fumigène (moins de touches) |
| **Purge** (sans spé ou Fusilier) | KR-4 + Sangle 3 points + Purge de culasse + Poche à munitions ; Plaque + Trousse médicale | Chaque recharge convertit la Chaleur en armure : tient longtemps, gagne les duels d'escouade | Explosives (détruisent l'armure), Brûlure adverse |

### Sentinelle : nouveaux objets (pool de base)

| Objet | Forme | Catégorie | Prix / rareté min | Effet (Commun) |
|---|---|---|---|---|
| Munitions électriques | `X` | Munition spéciale | 5 / 1 | +1 Choc par touche |
| Munitions subsoniques | `X` | Munition spéciale | 5 / 1 | −10 % de dégâts ; 1re balle après chaque recharge critique |
| Munitions de match | `X` | Munition spéciale | 6 / 2 | Critiques ×2,5 |
| Revolver Crotale | `XX/X.` | Arme (pistolet .44) | 6 / 0 | 12 dégâts / 1,0 s, barillet 6, recharge 2,2 s ; chaque critique +1 Repérage en plus |
| Chargeur rapide | `X` | Munition (.44) | 4 / 0 | Compte comme chargeur .44 ; revolver adjacent : recharge −50 % |
| Radio d'observateur | `XX` | Accessoire | 6 / 1 | **Toutes les 4 s** : marque l'adversaire s'il n'est pas marqué |
| Carnet de tir | `XX` | Accessoire | 5 / 1 | **Au début du combat** : +2 Repérage ; arme adjacente : à 6 Repérage, son prochain tir est critique (une fois) |
| Grenade IEM | `X` | Explosif | 6 / 1 | +4 Choc, annule le Feu continu adverse ; 2 charges, délai 8 s |
| Poncho ghillie | `XX/XX` | Protection | 6 / 1 | Armure 10 ; **la 1re touche reçue du combat** est esquivée |

### Sentinelle : spécialisations (cercle 3)

| Spé | Passif | Objets exclusifs |
|---|---|---|
| **Sniper** (un tir, une issue) | « Tir réglé » : un fusil de précision **peut consommer sa propre Marque** (build à une seule arme possible) ; chaque Marque consommée par un fusil de précision donne +2 Repérage | **Fusil anti-matériel Rhinocéros** `XXXXXX/..X...` (6 cases de large : ne tient que sur des sacoches ; 80 dégâts / 4 s, 3 coups, recharge 4 s, alimentation intégrée, perce 50 %) · **Lunette thermique** `XX` (arme longue adjacente : ignore le fumigène ; critique sur une cible en statut : +1 Repérage) · **Calculateur balistique** `XX/XX` (à 6 Repérage, dépense tout : prochain tir de l'arme adjacente ×2 et ignore l'armure) · **Sac de tir** (sacoche, §3) |
| **Pistolero** (marques en rafale) | « Main leste » : Marques **cumulables jusqu'à 3** ; chaque critique de pistolet pose 1 Marque ; une touche d'une autre arme consomme **toutes** les Marques (+50 % chacune) | **Derringer** `X` (pistolet : 14 dégâts / 0,5 s, 2 coups, recharge 2,5 s, n'importe quel chargeur l'alimente) · **Chien limé** `X` (revolver adjacent : après un critique, les 2 tirs suivants partent 2× plus vite) · **Jeton porte-bonheur** `X` (1er critique de chaque arme adjacente : 2 Marques) · **Holster double** (sacoche `XX/XX` : effet Holster pour 2 pistolets + ils tirent en alternance sans se gêner) |

### Sentinelle : recettes

| Ingrédients adjacents | Résultat | Effet |
|---|---|---|
| Munitions électriques + Munitions subsoniques | **Munitions IEM** (`X`) | +2 Choc par touche, 1re balle après recharge critique |
| Revolver Crotale + Chargeur rapide | **Crotale Éclair** (`XX/XX`) | Alimentation intégrée, recharge 1 s, +15 % de critique |
| Radio d'observateur + Carnet de tir | **Station d'observation** (`XX/XX`) | Marque toutes les 3 s ; +1 Repérage à chaque marque posée |
| Rhinocéros + Munitions de match (Sniper) | **Rhinocéros Ultime** (`XXXXXX/..XX..`) | Critiques ×3, 1er tir critique |

### Sentinelle : builds de fin de partie

| Build | Cœur et placement | Pourquoi ça marche | Faible contre |
|---|---|---|---|
| **Alpha** (Sniper) | Rhinocéros Ultime sur Fourreau long + Sac de tir ; Calculateur collé ; Lunette thermique ; Poncho ghillie | 1er tir critique ×3 ≈ 240 dégâts : tue au 1er tir à partir du cercle 3 si ça touche ; Lunette thermique annule le fumigène | Volume Saigneur (moins de PV que de temps), Flash (retarde le 1er tir), sans Lunette : fumigène |
| **Duelliste** (Pistolero) | 2 Crotale Éclair sur Holster double ; Jeton porte-bonheur entre les deux ; Munitions IEM sur l'un ; Chien limé | Critiques fréquents → 3 Marques → consommation à +150 % ; Choc casse les Viper | Armure lourde (réduction par balle), Saigneur (plus de touches) |
| **Observateur** (sans spé ou Sniper) | Faucon Traqueur + Station d'observation + Carnet de tir ; Taureau Magnum en 2e arme ; Munitions électriques sur le Magnum | Marques automatiques toutes les 3 s : chaque touche du Magnum est majorée ; ne dépend pas de la chance | Tank avec soins (manque de pic de dégâts), Brasier (Brûlure pendant les temps morts) |

---

## 5. Pool neutre et vocabulaire de déclencheurs

### Ajouts neutres (contres de statuts, pour que personne ne soit démuni)

| Objet | Forme | Catégorie | Prix | Effet |
|---|---|---|---|---|
| Combinaison ignifugée | `XX/XX` | Protection | 6 | Armure 15 ; Brûlure reçue −50 % |
| Garrot | `X` | Médical | 4 | Sous 50 % PV : retire tout le Saignement, +10 PV (1 charge) |
| Plaque isolante | `XX` | Protection | 5 | Armure 8 ; seuil de Décharge du Choc reçu 5 → 8 |
| Munitions explosives | `XX` | Munition spéciale | 8 | Voir §2 |
| Kit d'armurier | `X` | Accessoire | 5 | Arme adjacente : peut recevoir **2** munitions spéciales différentes (casse la règle 1 type, rare et cher) |

### Déclencheurs dont le moteur aurait besoin

Effort jugé sur l'architecture actuelle : `computeLoadout` (stats.ts) calcule des `WeaponRt` / `ActiveRt` figés, `simulateDuel` boucle à pas fixe `DT = 0,05` et appelle `act(me, foe, t)`.

| Déclencheur | Exemple | Effort | Où / comment |
|---|---|---|---|
| Au début du combat | Carnet de tir +2 Repérage | Faible | Dans `make()` de `simulateDuel` |
| Toutes les N balles | Explosives (N=4) | Faible | Calque de `pierceEvery` / `doubleEvery` via `shotNo` dans `act()` |
| Toutes les X secondes | Radio d'observateur | Faible | Comme un `ActiveRt` à charges infinies (boucle « Objets actifs » de `act()`) |
| Quand tu recharges | Purge, Couteau, Sangle | Faible | Branche `if (s.ammo <= 0)` de `act()` (là où `fireStart = -1`) |
| 1re balle après recharge | Subsoniques | Faible | Compteur par arme dans `ws` (comme `shots`) remis à 0 dans la même branche |
| Au 1er critique / sur critique | Jeton, Repérage | Faible | Variable `crit` dans la boucle `hits` ; `critStun` montre le patron |
| Quand tu marques / consommes la Marque | Repérage, Exécution | Faible | Variables `mark` / `marked` déjà calculées |
| Sous X % PV | Garrot | Faible | Existe (`threshold` des soins/adrénaline) : à généraliser |
| 1re touche reçue | Poncho ghillie | Faible | Drapeau dans `Fighter`, testé avant `applyDamage` |
| Statut appliqué / tick / seuil (Brûlure, Saignement, Choc) | §2 | **Moyen** | Ajouter `status` à `Fighter` ; tick dans `act()` à côté de `armorRegen` ; nouveaux `DuelEvent` (`status`, `discharge`) ; le rendu du duel doit les jouer |
| Palier de ressource (Chaleur, Repérage) | Manchon thermique, Gilet | **Moyen** | Compteur dans `Fighter`, effets portés par `WeaponRt` ; mettre à jour `estimateDps` (approximation) |
| Quand tu es touché / N touches reçues | (épines, futur Rempart) | **Moyen** | Les dégâts passent par 3 chemins (tir, frag, renvoi) : factoriser en une fonction `hit(me, foe, amount, source)` d'abord |
| Effets de sacoche | §3 | **Moyen** | `computeLoadout` ne reçoit pas les sacoches : ajouter `bags` en paramètre, tester `cellsOf(item) ∩ bagCells(bag)` ; bots : sacoches virtuelles dans `generateBot` |
| Entre deux duels d'escouade | Chaleur à moitié (Mitrailleur) | **Moyen** | `resolveDuel` / `opts.hpA` (run.ts) : passer un `carry` en plus des PV |
| Quand un objet adjacent se déclenche (chaînes à la BB) | « quand la grenade adjacente explose, +2 Choc » | **Élevé** | `computeLoadout` aplatit tout : il faudrait garder un graphe d'adjacence dans le loadout et un bus d'événements dans `act()`. À repousser |

Recommandation d'architecture (une fois, avant V1.1) : remplacer l'accumulation de champs ad hoc (`critStun`, `markBoost`, `heatBonus`…) par une liste `procs: { trigger, action, value }[]` sur `WeaponRt` / `PlayerLoadout`, et un `dispatch(trigger, ctx)` unique dans `act()`. Garder l'ordre des appels à `rng()` stable pour le déterminisme.

---

## 6. Matrice de contres

Archétypes : **A** Brasier (Viper Mitrailleur, Brûlure) · **B** Saigneur (Viper Fusilier, Saignement) · **C** Alpha (Sentinelle Sniper) · **D** Duelliste (Sentinelle Pistolero, Choc + Marques) · **E** Bunker (couche Rempart : armure lourde, soins, ignifugé) · **F** Contrôle (couche Tactique : fumigène, flash, IEM).
Lecture : la ligne contre la colonne. ++ fort avantage, + avantage, = équilibré, − désavantage.

| | A | B | C | D | E | F | Raison clé de la ligne |
|---|---|---|---|---|---|---|---|
| **A** Brasier | | = | − | − | ++ | + | Brûlure ignore armure et fumigène ; trop lent face au pic, et le Choc éteint la Chaleur |
| **B** Saigneur | = | | + | + | −− | − | Le volume tue les sacs à peu de PV/armure ; l'armure et le fumigène le coupent |
| **C** Alpha | + | − | | = | + | −− | Tue avant la montée en Brûlure, perce le Bunker ; un tir raté au fumigène = duel perdu |
| **D** Duelliste | + | − | = | | − | + | Le Choc casse Feu continu et retarde les actifs ; la réduction par balle mange ses touches |
| **E** Bunker | −− | ++ | − | + | | + | Absorbe les petites touches ; fond sous la Brûlure et la perforation |
| **F** Contrôle | − | + | ++ | − | − | | Prive de touches et de 1er tir ; ne peut rien contre la Brûlure ni le Choc |

Chaque archétype gagne 2 à 3 confrontations et en perd 2 à 3. Les couches E et F sont des **ajouts** aux builds d'opérateur (pool neutre), donc un vrai sac mélange par exemple A + E pour couvrir sa faiblesse : c'est le choix de build voulu.

---

## 7. Priorités

| Phase | Contenu | Nb d'entrées | Effort | Gain de profondeur |
|---|---|---|---|---|
| **V1.1 : Statuts et munitions** | Refonte `procs` ; statuts Brûlure / Saignement / Choc ; déclencheurs faibles (début, toutes les N balles, recharge, 1re balle après recharge, critique) ; 7 munitions spéciales (dont 2 converties) ; 3 contres neutres ; 6 sacoches à effet simples (Poche à munitions, Holster, Sacoche de cuisse, Trousse médicale, Porte-grenades, Boîte à munitions) | ~16 | Moyen | Très fort : le duel gagne une chronologie, la sacoche devient un choix |
| **V1.2 : Moteurs d'opérateur** | Chaleur et Repérage ; 6 objets de base par opérateur (Piranha, Manchon, Purge, Sangle, Grenade incendiaire, Gilet / Crotale, Chargeur rapide, Radio, Carnet, IEM, Ghillie) ; 3 recettes par opérateur ; Housse isotherme, Fourreau long, Musette d'équipe | ~21 | Moyen | Fort : moteurs « produire / dépenser » propres à chaque opérateur |
| **V1.3 : Spécialisations** | Choix au cercle 3 ; 2 spés × 2 opérateurs × 4 objets ; 2 recettes de spé ; 4 réactions nommées ; Sac de tir, Holster double, Contrebandier, Pochette blindée ; Kit d'armurier ; sacoches virtuelles des bots | ~22 | Moyen à élevé | Fort : bifurcation à mi-partie, runs qui divergent |

### Quoi tester

| Outil | Mesure | Cible |
|---|---|---|
| `tests/balance.ts` | Viper vs Sentinelle par cercle (existe) | 45–55 % |
| `tests/balance.ts` | Durée médiane d'un duel au cercle 2 (les statuts ne doivent pas rallonger) | 3–5 s |
| `tests/balance.ts` | Part des dégâts venant des statuts dans un duel | 15–35 % |
| `tests/balance.ts` | Matrice des 6 archétypes (bots gabarits fixes, 400 duels par case) | Contres voulus ≥ 60 %, aucun archétype > 58 % contre l'ensemble |
| `tests/balance.ts` | Garde-fou placement : sac mélangé (existe, ≥ 25 % de DPS perdu) étendu aux munitions et sacoches | Retirer les effets de sacoche : ≥ 10 % de perte |
| `tests/runsim.ts` | Taux de victoire de run par spé et par opérateur | Écart ≤ 5 points entre spés |
| `tests/runsim.ts` | Taux de choix de chaque spé par la politique simulée (doit choisir selon le sac, pas toujours la même) | Aucune spé < 30 % |
| `tests/runsim.ts` | Fréquence d'assemblage de chaque recette avant le cercle 5 | 10–40 % des runs, aucune à 0 |
| `tests/runsim.ts` | Revenus du Sac de contrebandier vs sacoche de puissance | Contrebandier gagnant seulement s'il est posé avant le cercle 3 |

À adapter dans le simulateur : `placeBot` / le rangement de `runsim.ts` doivent savoir poser une munition contre l'arme et un objet **sur** la bonne sacoche ; `accessoryFits` (bots.ts) doit refuser 2 munitions différentes sur la même arme.

---

## 8. Questions ouvertes

| # | Choix | Ma recommandation |
|---|---|---|
| 1 | Une munition qui touche 2 armes : **tap pour choisir** la cible ou règle automatique ? | Tap (le placement reste une décision lisible) ; défaut automatique = la plus grande arme |
| 2 | Spécialisation au cercle 3 : **écran de choix** (2 cartes, gratuit) ou **objet emblème** trouvé en boutique/caisse comme BB ? | Écran de choix au début du cercle 3 : clair sur téléphone et ce n'est pas du butin « 1 parmi 3 ». L'objet emblème est l'alternative si tu veux que la spé coûte des crédits |
| 3 | Les statuts et la Chaleur passent-ils d'un duel d'escouade à l'autre ? | Non par défaut (lisible) ; oui à moitié pour la Chaleur en Mitrailleur, c'est son identité |
| 4 | Sacoches : rareté comme les objets, ou **fusion en version +** ? | Fusion en « + » : moins de bruit, réutilise un geste connu |
| 5 | Les bots ont-ils des sacoches à effet ? | Oui dès le cercle 3, en sacoches virtuelles dans leur grille : sinon le joueur a un avantage gratuit et la matrice de contres est faussée |
| 6 | Nouveau calibre (.50) pour le Rhinocéros, ou alimentation intégrée ? | Alimentation intégrée : un calibre de plus pour une seule arme alourdit le pool |
| 7 | Paliers de famille : ajouter un **palier 6** quand le pool de l'opérateur dépasse ~25 objets ? | Oui en V1.2, avec un effet qui lit la ressource (ex. Rafale 6 : Chaleur max +10 ; Précision 6 : Repérage +1 par Marque posée) |
| 8 | Les réactions entre statuts d'opérateurs différents (Court-circuit = Brûlure + Choc) sont-elles atteignables ? | Oui, via le neutre : Grenade IEM et Grenade incendiaire passent au pool neutre en V1.3 (comme frag/flash), ce qui ouvre les réactions croisées sans mélanger les opérateurs |
