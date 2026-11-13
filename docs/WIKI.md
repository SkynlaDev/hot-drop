# Hot Drop — Wiki

> Généré par `npm run wiki` depuis les données du jeu : ne pas modifier à la main.

## Sommaire

1. [Le principe](#le-principe)
2. [Déroulé d’une partie](#déroulé-dune-partie)
3. [Le sac](#le-sac)
4. [Le combat](#le-combat)
5. [Les liens : étoiles et accessoires](#les-liens--étoiles-et-accessoires)
6. [Familles](#familles)
7. [Opérateurs](#opérateurs)
8. [Recettes](#recettes)
9. [Butin, caisses et boutique](#butin-caisses-et-boutique)
10. [Sacoches](#sacoches)
11. [Objets](#objets)

## Le principe

Un battle royale en solo, joué comme un *backpack battler* : on se largue sur une carte, on ramasse des objets, on les range dans un sac en grille, et les duels se jouent seuls à partir de ce que contient le sac.

Tout se décide **hors combat** : quoi prendre, quoi revendre, et surtout **où ranger chaque objet**, car les objets qui se touchent se renforcent (étoiles, accessoires, chargeurs, recettes).

Objectif : survivre aux 5 cercles puis gagner le duel final, le **Top 1**.

## Déroulé d’une partie

### La carte et le cercle

- La carte compte 9 zones de trois tailles (petite, moyenne, grande). Elle est grande au départ et le cercle de gaz se resserre à chaque manche : les zones gazées ne sont plus jouables.
- Une partie dure 5 manches (cercles). À chaque manche on choisit une zone dans le cercle et on s’y largue.
- Dans une zone, on tire des cartes (petite 4, moyenne 6, grande 8) et on en joue **3** : chaque carte jouée est une action.
- Après la dernière action, le cercle se resserre : **ravitaillement** (une boutique garantie), puis retour sur la carte pour la manche suivante.
- Après la 5ᵉ manche : ravitaillement, puis le duel final **Top 1** contre le bot le plus fort de la partie.

### Les cartes

| Carte | Effet |
|---|---|
| Duel | Un duel contre un bot. Victoire : crédits, puis on prend 1 objet dans son sac. |
| Élite | Un duel contre un bot fort. Victoire : plus de crédits, 2 objets à prendre dans son sac, 40 % de chance d’une sacoche. |
| Caisse | Quelques objets proposés, on en garde un, plus des crédits. |
| Caisse renforcée | Plus d’objets et de crédits, dont un ingrédient qui complète une recette commencée (à partir du cercle 2). |
| Caisse épique | Contient un objet assemblé. Seulement dans les grandes zones (50 % de chance par zone, à partir du cercle 2). |
| Boutique | Acheter, revendre, relancer les offres. |

Fréquence des cartes selon la taille de la zone (poids relatifs) :

| Zone | Duel | Élite | Caisse | Caisse renforcée | Boutique |
|---|---|---|---|---|---|
| petite | 38 | 6 | 30 | 6 | 20 |
| moyenne | 36 | 16 | 20 | 8 | 20 |
| grande | 34 | 28 | 12 | 6 | 13 |

Une zone contient toujours au moins un combat, au plus une boutique et une caisse renforcée. Plus la zone est grande, plus les bots sont dangereux… et plus le butin est riche.

### Thèmes de zone

Chaque zone a un thème : 50 % du butin (boutique, caisses, objets des bots) en vient.

| Thème | Oriente vers |
|---|---|
| Armurerie | Armes à feu et armes de mêlée |
| Hôpital | Soins et protections |
| Chantier | Explosifs et famille Démolition |
| Commissariat | Accessoires et munitions |
| Marché noir | Pas d’orientation, mais deux fois plus de boutiques |

### Duels, crédits et Goulag

- Chaque duel commence PV pleins. PV max à la manche *n* (1ʳᵉ = 0) : 300 + 150 × *n* (300, 450, 600, 750, 900, 1050 PV au Top 1). Les bots ont les mêmes PV.
- Crédits d’un duel gagné : 6 + 2 × manche ; Élite : 10 + 3 × manche.
- **Goulag** : la première défaite de la partie envoie au Goulag, un duel équitable PV pleins. Gagné, on revient en jeu ; perdu, c’est la fin. Une seule fois par partie.
- Une défaite sans Goulag disponible, ou au Top 1, termine la partie.

## Le sac

- La grille fait 9 × 8 cases. Le sac de base occupe le centre (5 × 4 cases) ; les **sacoches** posées autour ajoutent des cases utilisables.
- Chaque objet a une forme ; on peut le tourner par quarts de tour. Ses étoiles tournent avec lui.
- Réserve : 12 objets et 3 sacoches non posés. Seuls les objets posés dans le sac comptent en combat.
- Revente : 50 % du prix (au moins 1 crédit).
- Crédits de départ : 10.

## Le combat

Le duel se joue seul, sac contre sac, et dure en général 12 à 20 secondes.

- **Armes à feu** : tirent en continu. Précision de base 85 %. Critique de base 5 %, dégâts ×2.
- **Chargeurs** : les munitions sont infinies, mais une arme rechargée sans chargeur de son calibre posé contre elle recharge **2 fois plus lentement** (badge « RECH ×2 »). Chaque chargeur adjacent du bon calibre accélère encore la recharge.
- **Armure** : absorbe les dégâts avant les PV, sauf la part qui la perce.
- **Mêlée** : frappe pendant tout le duel, à côté des armes à feu. Dans un sac **sans aucune arme à feu**, elle frappe 1,5 fois plus vite (build Lame).
- **Saignement** : dégâts qui ignorent l'armure, versés peu à peu (35 % de la réserve par seconde).
- **Objets actifs** (grenades, fumigène, soins, taser, bandage…) : se déclenchent seuls, avec des charges et un délai.
- **Temps limite** : 90 s. Au-delà, gagne celui qui a la plus grande part de ses PV max.
- **Rapport de duel** : après chaque duel, chaque objet du sac affiche ce qu'il a apporté (dégâts en orange, soins en vert, armure absorbée en bleu-gris, le plus utile entouré d'or). Le bouton « Rapport » détaille les deux sacs : touches, critiques, saignement, déclenchements, et les objets liés à chacun.

## Les liens : étoiles et accessoires

Les objets se renforcent quand ils se touchent dans le sac (bords partagés). Tout lien se voit dans le sac :

- **Étoiles** : certains objets ont des étoiles sur des cases précises autour d’eux. Une étoile s’allume quand un objet du bon type occupe une de ses cases. Quand on tient un objet, les cases où il se lierait s’affichent en étoiles creuses, et les objets qu’il attend sont entourés en vert. Chaque objet posé affiche « ★ n », son nombre d’étoiles allumées.
- **Accessoires et chargeurs** : ils ont une étoile tout autour d’eux qui attend une arme compatible (calibre pour les chargeurs, arme longue pour la lunette et le bipied, arme courte pour le viseur holo).
- En boutique, en caisse et au butin : « ★ » signale un objet qui se lierait au sac, « ⚗ » un objet qui complète une recette.
- *Max* : au plus ce nombre d’objets comptent pour une même étoile.

### Toutes les étoiles

| Objet | Attend | Effet |
|---|---|---|
| <img src="../public/art/items/pompe.png" height="24"> Pompe Sanglier | Explosif (tout autour) | +15 % de dégâts (max 2) |
| <img src="../public/art/items/chg_9mm.png" height="24"> Chargeur 9 mm | Arme 9mm (tout autour) | −25 % de recharge (max 3) |
| <img src="../public/art/items/chg_556.png" height="24"> Chargeur 5.56 | Arme 5.56 (tout autour) | −25 % de recharge (max 3) |
| <img src="../public/art/items/chg_762.png" height="24"> Chargeur 7.62 | Arme 7.62 (tout autour) | −25 % de recharge (max 3) |
| <img src="../public/art/items/lunette.png" height="24"> Lunette ×4 | Arme longue (tout autour) | +25 % de critique |
| <img src="../public/art/items/silencieux.png" height="24"> Silencieux | Arme (tout autour) | son 1er tir est critique |
| <img src="../public/art/items/plaque.png" height="24"> Plaque céramique | Protection (cases précises) | +8 d'armure (max 2) |
| <img src="../public/art/items/casque.png" height="24"> Casque balistique | Protection (cases précises) | +6 d'armure (max 1) |
| <img src="../public/art/items/frag.png" height="24"> Grenade frag | Explosif (tout autour) | +20 % de dégâts (max 2) |
| <img src="../public/art/items/fumigene.png" height="24"> Fumigène | Explosif (tout autour) | +1 charge (max 1) |
| <img src="../public/art/items/ifak.png" height="24"> Trousse IFAK | Protection (cases précises) | soins +20 % (max 1) |
| <img src="../public/art/items/perforantes.png" height="24"> Munitions perforantes | Arme (tout autour) | perce 30 % de l'armure |
| <img src="../public/art/items/flash.png" height="24"> Grenade flash | Explosif (tout autour) | +1 charge (max 1) |
| <img src="../public/art/items/seringue.png" height="24"> Seringue d'adrénaline | Arme (tout autour) | +10 % de cadence à cet objet (max 1) |
| <img src="../public/art/items/pompe_belier.png" height="24"> Pompe auto Bélier | Explosif (tout autour) | +15 % de dégâts (max 2) |
| <img src="../public/art/items/chg_12g.png" height="24"> Cartouches 12G | Arme 12G (tout autour) | −25 % de recharge (max 3) |
| <img src="../public/art/items/chg_44.png" height="24"> Balles .44 | Arme .44 (tout autour) | −25 % de recharge (max 3) |
| <img src="../public/art/items/poignee.png" height="24"> Poignée verticale | Arme (tout autour) | +25 % de cadence |
| <img src="../public/art/items/chg_etendu.png" height="24"> Chargeur étendu | Arme (tout autour) | chargeur +50 % |
| <img src="../public/art/items/viseur_holo.png" height="24"> Viseur holo | Arme courte (tout autour) | +25 % de critique |
| <img src="../public/art/items/bipied.png" height="24"> Bipied | Arme longue (tout autour) | +25 % de dégâts |
| <img src="../public/art/items/chg_tambour.png" height="24"> Chargeur tambour | Arme (tout autour) | chargeur +100 %, recharge +40 % (nourrit le Feu continu) |
| <img src="../public/art/items/refroidisseur.png" height="24"> Refroidisseur de canon | Arme (tout autour) | son Feu continu monte 100 % plus vite (passif de Viper) |
| <img src="../public/art/items/tracantes.png" height="24"> Munitions traçantes | Arme (tout autour) | quand elle consomme la Marque, +30 % de dégâts en plus (passif de Sentinelle) |
| <img src="../public/art/items/pompe_dragon.png" height="24"> Pompe Dragon | Explosif (tout autour) | +15 % de dégâts (max 2) |
| <img src="../public/art/items/thermite.png" height="24"> Grenade thermite | Arme (tout autour) | +10 % de dégâts à cet objet (max 1) |
| <img src="../public/art/items/armure_lourde.png" height="24"> Armure lourde | Soin (tout autour) | soins +25 % à cet objet (max 2) |
| <img src="../public/art/items/kit_trauma.png" height="24"> Kit de trauma | Protection (tout autour) | soins +30 % (max 1) |
| <img src="../public/art/items/couteau.png" height="24"> Couteau | Arme de mêlée (cases précises) | +2 de saignement par coup (max 1) |
| <img src="../public/art/items/couteau_combat.png" height="24"> Couteau de combat | Arme de mêlée (cases précises) | +2 de saignement par coup (max 1) |
| <img src="../public/art/items/masse.png" height="24"> Masse | Protection (tout autour) | +25 % de dégâts (max 1) |
| <img src="../public/art/items/taser.png" height="24"> Taser | Arme de mêlée (tout autour) | +1 charge (max 1) |
| <img src="../public/art/items/bandage.png" height="24"> Bandage | Protection (tout autour) | soins +50 % (max 1) |
| <img src="../public/art/items/machette.png" height="24"> Machette | Arme de mêlée (cases précises) | +25 % de dégâts (max 1) |
| <img src="../public/art/items/casque_lourd.png" height="24"> Casque lourd | Protection (cases précises) | +10 d'armure (max 1) |
| <img src="../public/art/items/sous_munitions.png" height="24"> Grenade à sous-munitions | Explosif (tout autour) | +1 charge (max 1) |
| <img src="../public/art/items/sac_medical.png" height="24"> Sac médical | Soin (tout autour) | +1 charge à cet objet (max 2) |
| <img src="../public/art/items/briquet.png" height="24"> Briquet | Explosif (tout autour) | +20 % de dégâts à cet objet (max 1) |
| <img src="../public/art/items/batterie.png" height="24"> Batterie | Arme (tout autour) | +5 % de cadence à cet objet (max 1) |
| <img src="../public/art/items/chg_incendiaire.png" height="24"> Chargeur incendiaire | Arme (tout autour) | l'alimente (tout calibre), −25 % de recharge, chaque touche pose de la Brûlure |
| <img src="../public/art/items/chg_electrique.png" height="24"> Chargeur électrique | Arme (tout autour) | l'alimente (tout calibre), −25 % de recharge, chaque touche pose du Choc |
| <img src="../public/art/items/grenade_incendiaire.png" height="24"> Grenade incendiaire | Explosif (tout autour) | +1 charge (max 1) |
| <img src="../public/art/items/grenade_iem.png" height="24"> Grenade IEM | Explosif (tout autour) | +1 charge (max 1) |
| <img src="../public/art/items/taser_lourd.png" height="24"> Taser lourd | Arme de mêlée (tout autour) | +1 charge (max 1) |
| <img src="../public/art/items/combinaison.png" height="24"> Combinaison ignifugée | Protection (cases précises) | +5 d'armure (max 1) |
| <img src="../public/art/items/plaque_isolante.png" height="24"> Plaque isolante | Protection (cases précises) | +4 d'armure (max 1) |
| <img src="../public/art/items/souffle_dragon.png" height="24"> Souffle du Dragon | Explosif (tout autour) | +15 % de dégâts (max 2) |
| <img src="../public/art/items/juggernaut.png" height="24"> Blindage Juggernaut | Soin (tout autour) | soins +30 % à cet objet (max 2) |
| <img src="../public/art/items/poste_secours.png" height="24"> Poste de secours | Protection (tout autour) | soins +30 % (max 1) |
| <img src="../public/art/items/lame_rouge.png" height="24"> Lame rouge | Arme de mêlée (cases précises) | +25 % de dégâts (max 1) |
| <img src="../public/art/items/bombe_phosphore.png" height="24"> Bombe au phosphore | Explosif (tout autour) | +1 charge (max 1) |

## Familles

Chaque objet appartient à une famille. Avoir 2 puis 4 objets d’une famille posés dans le sac donne des bonus.

| Famille | 2 objets | 4 objets |
|---|---|---|
| Rafale | +15 % de cadence des armes Rafale | 1 balle sur 3 touche deux fois |
| Précision | +10 % de critique pour toutes les armes | Critiques ×2,25 au lieu de ×2 |
| Démolition | +1 charge pour chaque explosif | Explosions et fusils à pompe ignorent l'armure |
| Rempart | +30 % d'armure | L'armure se régénère de 3 par seconde |
| Tactique | Le fumigène dure 50 % plus longtemps | Prévu avec la radio et le drone |

## Opérateurs

On choisit un opérateur au début de la partie. Le pool d’objets est commun : chacun peut tout prendre, sauf les **objets de signature** de l’autre opérateur (et ce qui s’assemble avec eux).

### Viper

*Fusils d’assaut et SMG : noie l’ennemi sous les balles, sans lâcher la gâchette.*

- **Passif** : Feu continu : chaque arme gagne +6 % de cadence par seconde de tir sans recharger (max +35 %).
- **Famille** : Rafale.
- **Objets de signature** : Chargeur tambour, Refroidisseur de canon.
- **Sac de départ** : Casque balistique, Pistolet Mamba, Chargeur 9 mm, Refroidisseur de canon, Couteau.

### Sentinelle

*Fusils de précision et revolvers : une arme marque, l’autre achève.*

- **Passif** : Marque : un critique marque l’ennemi, la touche suivante d’une autre arme fait +40 %.
- **Famille** : Précision.
- **Objets de signature** : Munitions traçantes.
- **Sac de départ** : Casque balistique, Revolver Taureau, Balles .44, Poignée verticale, Couteau.

Détails des passifs : Feu continu +6 % de cadence par seconde de tir sans recharger, plafonné à +35 % ; Marque +40 % de dégâts sur la touche suivante d’une autre arme.

## Recettes

Quand tous les ingrédients d’une recette sont **posés dans le sac et se touchent** (en un seul bloc), ils s’assemblent automatiquement hors combat en un objet plus fort. Les objets assemblés ne se trouvent jamais au butin ni en boutique (sauf caisse épique).

| Ingrédients | Résultat |
|---|---|
| <img src="../public/art/items/fusil_assaut.png" height="24"> Fusil d'assaut KR-4 + <img src="../public/art/items/poignee.png" height="24"> Poignée verticale + <img src="../public/art/items/chg_etendu.png" height="24"> Chargeur étendu | <img src="../public/art/items/kr4_tactique.png" height="24"> **KR-4 Tactique** |
| <img src="../public/art/items/smg.png" height="24"> SMG Furet + <img src="../public/art/items/smg_guepe.png" height="24"> Pistolet-mitrailleur Guêpe | <img src="../public/art/items/furet_akimbo.png" height="24"> **Furet Akimbo** |
| <img src="../public/art/items/precision.png" height="24"> Fusil de précision Aigle + <img src="../public/art/items/lunette.png" height="24"> Lunette ×4 + <img src="../public/art/items/bipied.png" height="24"> Bipied | <img src="../public/art/items/aigle_longuevue.png" height="24"> **Aigle Longue-vue** |
| <img src="../public/art/items/revolver.png" height="24"> Revolver Taureau + <img src="../public/art/items/chg_44.png" height="24"> Balles .44 + <img src="../public/art/items/silencieux.png" height="24"> Silencieux | <img src="../public/art/items/taureau_magnum.png" height="24"> **Taureau Magnum** |
| <img src="../public/art/items/smg_ours.png" height="24"> SMG lourd Ours + <img src="../public/art/items/chg_tambour.png" height="24"> Chargeur tambour | <img src="../public/art/items/ours_deluge.png" height="24"> **Ours Déluge** |
| <img src="../public/art/items/dmr_faucon.png" height="24"> DMR Faucon + <img src="../public/art/items/tracantes.png" height="24"> Munitions traçantes | <img src="../public/art/items/faucon_traqueur.png" height="24"> **Faucon Traqueur** |
| <img src="../public/art/items/pompe.png" height="24"> Pompe Sanglier + <img src="../public/art/items/chg_12g.png" height="24"> Cartouches 12G | <img src="../public/art/items/pompe_dragon.png" height="24"> **Pompe Dragon** |
| <img src="../public/art/items/frag.png" height="24"> Grenade frag + <img src="../public/art/items/fumigene.png" height="24"> Fumigène | <img src="../public/art/items/thermite.png" height="24"> **Grenade thermite** |
| <img src="../public/art/items/plaque.png" height="24"> Plaque céramique + <img src="../public/art/items/casque.png" height="24"> Casque balistique | <img src="../public/art/items/armure_lourde.png" height="24"> **Armure lourde** |
| <img src="../public/art/items/ifak.png" height="24"> Trousse IFAK + <img src="../public/art/items/seringue.png" height="24"> Seringue d'adrénaline | <img src="../public/art/items/kit_trauma.png" height="24"> **Kit de trauma** |
| <img src="../public/art/items/chg_9mm.png" height="24"> Chargeur 9 mm + <img src="../public/art/items/briquet.png" height="24"> Briquet | <img src="../public/art/items/chg_incendiaire.png" height="24"> **Chargeur incendiaire** |
| <img src="../public/art/items/chg_9mm.png" height="24"> Chargeur 9 mm + <img src="../public/art/items/batterie.png" height="24"> Batterie | <img src="../public/art/items/chg_electrique.png" height="24"> **Chargeur électrique** |
| <img src="../public/art/items/chg_556.png" height="24"> Chargeur 5.56 + <img src="../public/art/items/briquet.png" height="24"> Briquet | <img src="../public/art/items/chg_incendiaire.png" height="24"> **Chargeur incendiaire** |
| <img src="../public/art/items/chg_556.png" height="24"> Chargeur 5.56 + <img src="../public/art/items/batterie.png" height="24"> Batterie | <img src="../public/art/items/chg_electrique.png" height="24"> **Chargeur électrique** |
| <img src="../public/art/items/chg_762.png" height="24"> Chargeur 7.62 + <img src="../public/art/items/briquet.png" height="24"> Briquet | <img src="../public/art/items/chg_incendiaire.png" height="24"> **Chargeur incendiaire** |
| <img src="../public/art/items/chg_762.png" height="24"> Chargeur 7.62 + <img src="../public/art/items/batterie.png" height="24"> Batterie | <img src="../public/art/items/chg_electrique.png" height="24"> **Chargeur électrique** |
| <img src="../public/art/items/chg_44.png" height="24"> Balles .44 + <img src="../public/art/items/briquet.png" height="24"> Briquet | <img src="../public/art/items/chg_incendiaire.png" height="24"> **Chargeur incendiaire** |
| <img src="../public/art/items/chg_44.png" height="24"> Balles .44 + <img src="../public/art/items/batterie.png" height="24"> Batterie | <img src="../public/art/items/chg_electrique.png" height="24"> **Chargeur électrique** |
| <img src="../public/art/items/chg_12g.png" height="24"> Cartouches 12G + <img src="../public/art/items/briquet.png" height="24"> Briquet | <img src="../public/art/items/chg_incendiaire.png" height="24"> **Chargeur incendiaire** |
| <img src="../public/art/items/chg_12g.png" height="24"> Cartouches 12G + <img src="../public/art/items/batterie.png" height="24"> Batterie | <img src="../public/art/items/chg_electrique.png" height="24"> **Chargeur électrique** |
| <img src="../public/art/items/frag.png" height="24"> Grenade frag + <img src="../public/art/items/briquet.png" height="24"> Briquet | <img src="../public/art/items/grenade_incendiaire.png" height="24"> **Grenade incendiaire** |
| <img src="../public/art/items/flash.png" height="24"> Grenade flash + <img src="../public/art/items/batterie.png" height="24"> Batterie | <img src="../public/art/items/grenade_iem.png" height="24"> **Grenade IEM** |
| <img src="../public/art/items/taser.png" height="24"> Taser + <img src="../public/art/items/batterie.png" height="24"> Batterie | <img src="../public/art/items/taser_lourd.png" height="24"> **Taser lourd** |
| <img src="../public/art/items/pompe_dragon.png" height="24"> Pompe Dragon + <img src="../public/art/items/grenade_incendiaire.png" height="24"> Grenade incendiaire | <img src="../public/art/items/souffle_dragon.png" height="24"> **Souffle du Dragon** |
| <img src="../public/art/items/taser_lourd.png" height="24"> Taser lourd + <img src="../public/art/items/chg_electrique.png" height="24"> Chargeur électrique | <img src="../public/art/items/bobine_tesla.png" height="24"> **Bobine Tesla** |
| <img src="../public/art/items/casque_lourd.png" height="24"> Casque lourd + <img src="../public/art/items/armure_lourde.png" height="24"> Armure lourde | <img src="../public/art/items/juggernaut.png" height="24"> **Blindage Juggernaut** |
| <img src="../public/art/items/kit_trauma.png" height="24"> Kit de trauma + <img src="../public/art/items/sac_medical.png" height="24"> Sac médical | <img src="../public/art/items/poste_secours.png" height="24"> **Poste de secours** |
| <img src="../public/art/items/machette.png" height="24"> Machette + <img src="../public/art/items/couteau_combat.png" height="24"> Couteau de combat | <img src="../public/art/items/lame_rouge.png" height="24"> **Lame rouge** |
| <img src="../public/art/items/aigle_longuevue.png" height="24"> Aigle Longue-vue + <img src="../public/art/items/perforantes.png" height="24"> Munitions perforantes | <img src="../public/art/items/rhinoceros.png" height="24"> **Fusil anti-matériel Rhinocéros** |
| <img src="../public/art/items/kr4_tactique.png" height="24"> KR-4 Tactique + <img src="../public/art/items/chg_tambour.png" height="24"> Chargeur tambour | <img src="../public/art/items/kr4_mitrailleur.png" height="24"> **KR-4 Mitrailleur** |
| <img src="../public/art/items/thermite.png" height="24"> Grenade thermite + <img src="../public/art/items/sous_munitions.png" height="24"> Grenade à sous-munitions | <img src="../public/art/items/bombe_phosphore.png" height="24"> **Bombe au phosphore** |
| <img src="../public/art/items/pistolet.png" height="24"> Pistolet Mamba + <img src="../public/art/items/pistolet.png" height="24"> Pistolet Mamba | <img src="../public/art/items/mamba_akimbo.png" height="24"> **Mamba Akimbo** |
| <img src="../public/art/items/revolver.png" height="24"> Revolver Taureau + <img src="../public/art/items/revolver.png" height="24"> Revolver Taureau | <img src="../public/art/items/taureau_jumeaux.png" height="24"> **Taureau Jumeaux** |
| <img src="../public/art/items/casque.png" height="24"> Casque balistique + <img src="../public/art/items/casque.png" height="24"> Casque balistique | <img src="../public/art/items/casque_lourd.png" height="24"> **Casque lourd** |
| <img src="../public/art/items/frag.png" height="24"> Grenade frag + <img src="../public/art/items/frag.png" height="24"> Grenade frag | <img src="../public/art/items/sous_munitions.png" height="24"> **Grenade à sous-munitions** |
| <img src="../public/art/items/ifak.png" height="24"> Trousse IFAK + <img src="../public/art/items/ifak.png" height="24"> Trousse IFAK | <img src="../public/art/items/sac_medical.png" height="24"> **Sac médical** |
| <img src="../public/art/items/couteau.png" height="24"> Couteau + <img src="../public/art/items/couteau.png" height="24"> Couteau | <img src="../public/art/items/machette.png" height="24"> **Machette** |

## Butin, caisses et boutique

| Caisse | Objets proposés | À garder | Crédits (manche *n*) | Chance de sacoche |
|---|---|---|---|---|
| Caisse | 3 | 1 | 3 + 1 × *n* | 30 % |
| Caisse renforcée | 4 | 2 | 6 + 2 × *n* | 60 % |
| Caisse épique | 5 | 2 | 10 + 3 × *n* | 50 % |
| undefined | 3 | 1 | 0 + 0 × *n* | 0 % |

Une caisse propose toujours au moins une arme.

- **Boutique** : 5 offres, 40 % de chance que l’une soit une sacoche. Relance : 2 crédits.
- **Répartition du butin** par catégorie : Arme 20 %, Munition 22 %, Accessoire 20 %, Protection 12 %, Explosif 10 %, Médical 8 %, Composant 8 %.
- Certains objets n’apparaissent qu’à partir d’un certain cercle (colonne « Dès » des tableaux d’objets).

## Sacoches

Posées sur la grille à côté du sac de base, elles ajoutent des cases. Les grandes deviennent plus fréquentes en fin de partie.

| Sacoche | Forme | Prix |
|---|---|---|
| Pochette | `■■` | 4 |
| Sacoche | `■■ / ■■` | 8 |
| Ceinture | `■■■■` | 8 |
| Sac tactique | `■■ / ■■ / ■■` | 13 |

## Objets

Formes : ■ = case occupée, · = case vide, lignes séparées par « / » (avant rotation).

### Armes à feu

#### Pistolet Mamba

<img src="../public/art/items/pistolet.png" height="48">

**Base · Pistolet · 9mm** · Forme `■■ / ■·` (3 cases) · Prix 4 · dès le cercle 1

- Dégâts 11 toutes les 0,9 s
- Chargeur 8 balles · recharge 2 s
- Alimentation : un chargeur 9mm adjacent, sinon recharge ×2
- Endurance : 0,6 par tir
- Recette : Mamba + Mamba → Mamba Akimbo (ingrédients adjacents : assemblage automatique)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 3 cases · revente 2 cr

#### SMG Furet

<img src="../public/art/items/smg.png" height="48">

**Base · SMG · 9mm** · Forme `■■■ / ·■·` (4 cases) · Prix 6 · dès le cercle 1

- Dégâts 4,5 toutes les 0,4 s
- Chargeur 15 balles · recharge 2,5 s
- Alimentation : un chargeur 9mm adjacent, sinon recharge ×2
- Endurance : 0,2 par tir
- Recette : Furet + Guêpe → Furet Akimbo (ingrédients adjacents : assemblage automatique)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 4 cases · revente 3 cr

#### Fusil d'assaut KR-4

<img src="../public/art/items/fusil_assaut.png" height="48">

**Base · Fusil d'assaut · 5.56** · Forme `■■■■ / ·■··` (5 cases) · Prix 8 · dès le cercle 1

- Dégâts 10 toutes les 0,7 s
- Chargeur 15 balles · recharge 2,5 s
- Alimentation : un chargeur 5.56 adjacent, sinon recharge ×2
- Endurance : 0,4 par tir
- Recette : KR-4 + Poignée + Étendu → KR-4 Tactique (ingrédients adjacents : assemblage automatique)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 5 cases · revente 4 cr

#### Pompe Sanglier

<img src="../public/art/items/pompe.png" height="48">

**Base · Fusil à pompe · 12G** · Forme `■■■■ / ■···` (5 cases) · Prix 8 · dès le cercle 1

- Dégâts 18,5 toutes les 1,5 s
- Chargeur 4 balles · recharge 3 s
- Alimentation : un chargeur 12G adjacent, sinon recharge ×2
- Plombs : chaque tir touche 2 fois
- Endurance : 1,2 par tir
- ★ Explosif adjacent : +15 % de dégâts
- Recette : Sanglier + Cart. 12G → Pompe Dragon (ingrédients adjacents : assemblage automatique)
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 5 cases · revente 4 cr

#### Fusil de précision Aigle

<img src="../public/art/items/precision.png" height="48">

**Base · Fusil de précision · 7.62** · Forme `■■■■■ / ··■··` (6 cases) · Prix 14 · dès le cercle 2

- Dégâts 51,5 toutes les 3 s
- Chargeur 4 balles · recharge 3,5 s
- Alimentation : un chargeur 7.62 adjacent, sinon recharge ×2
- Endurance : 2,1 par tir
- Recette : Aigle + Lunette + Bipied → Aigle Longue-vue (ingrédients adjacents : assemblage automatique)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 6 cases · revente 7 cr

#### Bullpup Vesta

<img src="../public/art/items/ar_vesta.png" height="48">

**Base · Fusil d'assaut · 5.56** · Forme `■■■ / ·■·` (4 cases) · Prix 8 · dès le cercle 1

- Dégâts 7,5 toutes les 0,6 s
- Chargeur 15 balles · recharge 2,2 s
- Alimentation : un chargeur 5.56 adjacent, sinon recharge ×2
- Endurance : 0,3 par tir
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 4 cases · revente 4 cr

#### Fusil de combat Hadès

<img src="../public/art/items/ar_hades.png" height="48">

**Base · Fusil d'assaut · 5.56** · Forme `■■■■ / ·■■·` (6 cases) · Prix 10 · dès le cercle 1

- Dégâts 18 toutes les 1,1 s
- Chargeur 10 balles · recharge 3 s
- Alimentation : un chargeur 5.56 adjacent, sinon recharge ×2
- Endurance : 0,6 par tir
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 6 cases · revente 5 cr

#### Carabine Lynx

<img src="../public/art/items/ar_lynx.png" height="48">

**Base · Fusil d'assaut · 5.56** · Forme `■■■ / ■·■` (5 cases) · Prix 7 · dès le cercle 1

- Dégâts 6 toutes les 0,5 s
- Chargeur 12 balles · recharge 1,8 s
- Alimentation : un chargeur 5.56 adjacent, sinon recharge ×2
- Endurance : 0,3 par tir
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 5 cases · revente 3 cr

#### Pistolet-mitrailleur Guêpe

<img src="../public/art/items/smg_guepe.png" height="48">

**Base · SMG · 9mm** · Forme `■■ / ·■` (3 cases) · Prix 5 · dès le cercle 1

- Dégâts 3 toutes les 0,3 s
- Chargeur 12 balles · recharge 1,8 s
- Alimentation : un chargeur 9mm adjacent, sinon recharge ×2
- Endurance : 0,2 par tir
- Recette : Furet + Guêpe → Furet Akimbo (ingrédients adjacents : assemblage automatique)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 3 cases · revente 2 cr

#### SMG lourd Ours

<img src="../public/art/items/smg_ours.png" height="48">

**Base · SMG · 9mm** · Forme `■■■ / ■■·` (5 cases) · Prix 8 · dès le cercle 1

- Dégâts 6 toutes les 0,5 s
- Chargeur 18 balles · recharge 2,6 s
- Alimentation : un chargeur 9mm adjacent, sinon recharge ×2
- Endurance : 0,3 par tir
- Recette : Ours + Tambour → Ours Déluge (ingrédients adjacents : assemblage automatique)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 5 cases · revente 4 cr

#### Revolver Taureau

<img src="../public/art/items/revolver.png" height="48">

**Base · Pistolet · .44** · Forme `■■■ / ■··` (4 cases) · Prix 7 · dès le cercle 1

- Dégâts 19 toutes les 1,4 s
- Chargeur 4 balles · recharge 2,4 s
- Alimentation : un chargeur .44 adjacent, sinon recharge ×2
- Endurance : 0,9 par tir
- Recette : Taureau + Balles .44 + Silenc. → Taureau Magnum (ingrédients adjacents : assemblage automatique)
- Recette : Taureau + Taureau → Taureau Jumeaux (ingrédients adjacents : assemblage automatique)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 4 cases · revente 3 cr

#### Pompe auto Bélier

<img src="../public/art/items/pompe_belier.png" height="48">

**Base · Fusil à pompe · 12G** · Forme `■■■■ / ■■··` (6 cases) · Prix 12 · dès le cercle 2

- Dégâts 13 toutes les 1 s
- Chargeur 4 balles · recharge 3,2 s
- Alimentation : un chargeur 12G adjacent, sinon recharge ×2
- Plombs : chaque tir touche 2 fois
- Endurance : 0,8 par tir
- ★ Explosif adjacent : +15 % de dégâts
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 6 cases · revente 6 cr

#### DMR Faucon

<img src="../public/art/items/dmr_faucon.png" height="48">

**Base · Fusil de précision · 7.62** · Forme `■■■■ / ··■·` (5 cases) · Prix 10 · dès le cercle 1

- Dégâts 35,5 toutes les 1,6 s
- Chargeur 5 balles · recharge 3 s
- Alimentation : un chargeur 7.62 adjacent, sinon recharge ×2
- Endurance : 1,1 par tir
- Recette : Faucon + Traçantes → Faucon Traqueur (ingrédients adjacents : assemblage automatique)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 5 cases · revente 5 cr

#### Pistolet de poche Colibri

<img src="../public/art/items/colibri.png" height="48">

**Base · Pistolet · .44** · Forme `■■` (2 cases) · Prix 5 · dès le cercle 1

- Dégâts 8,5 toutes les 0,8 s
- Chargeur 6 balles · recharge 1,8 s
- Alimentation : un chargeur .44 adjacent, sinon recharge ×2
- +20 % de critique
- Endurance : 0,5 par tir
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 2 cases · revente 2 cr

### Armes à feu assemblées

#### KR-4 Tactique

<img src="../public/art/items/kr4_tactique.png" height="48">

**Assemblé · Fusil d'assaut · 5.56** · Forme `■■■■ / ·■■·` (6 cases) · Assemblé

- Dégâts 12,5 toutes les 0,6 s
- Chargeur 22 balles · recharge 2,2 s
- Alimentation : n'importe quel chargeur adjacent, sinon recharge ×2
- Endurance : 0,3 par tir
- Objet assemblé (recette)
- Recette : KR-4 T. + Tambour → KR-4 Mitrailleur (ingrédients adjacents : assemblage automatique)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 6 cases · revente 9 cr

#### Furet Akimbo

<img src="../public/art/items/furet_akimbo.png" height="48">

**Assemblé · SMG · 9mm** · Forme `■■■ / ■■■` (6 cases) · Assemblé

- Dégâts 4,5 toutes les 0,4 s
- Chargeur 24 balles · recharge 2,6 s
- Alimentation : un chargeur 9mm adjacent, sinon recharge ×2
- Plombs : chaque tir touche 2 fois
- Endurance : 0,3 par tir (deux armes à la fois)
- Objet assemblé (recette)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 6 cases · revente 8 cr

#### Aigle Longue-vue

<img src="../public/art/items/aigle_longuevue.png" height="48">

**Assemblé · Fusil de précision · 7.62** · Forme `■■■■■ / ··■··` (6 cases) · Assemblé

- Dégâts 51,5 toutes les 2,8 s
- Chargeur 5 balles · recharge 3,2 s
- Alimentation : un chargeur 7.62 adjacent, sinon recharge ×2
- Son 1er tir est toujours critique
- Ignore 50 % de l'armure
- Endurance : 1,9 par tir
- Objet assemblé (recette)
- Recette : Longue-vue + Perfo. → Fusil anti-matériel Rhinocéros (ingrédients adjacents : assemblage automatique)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 6 cases · revente 13 cr

#### Taureau Magnum

<img src="../public/art/items/taureau_magnum.png" height="48">

**Assemblé · Pistolet · .44** · Forme `■■■ / ■··` (4 cases) · Assemblé

- Dégâts 32 toutes les 1,3 s
- Chargeur 6 balles · recharge 2,2 s
- Alimentation intégrée : jamais besoin de chargeur
- Ses critiques retardent les tirs adverses de 0,5 s
- Endurance : 0,8 par tir
- Objet assemblé (recette)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 4 cases · revente 8 cr

#### Ours Déluge

<img src="../public/art/items/ours_deluge.png" height="48">

**Assemblé · SMG · 9mm** · Forme `■■■■ / ·■■·` (6 cases) · Assemblé

- Dégâts 9,5 toutes les 0,4 s
- Chargeur 40 balles · recharge 3,4 s
- Alimentation intégrée : jamais besoin de chargeur
- Viper : Feu continu jusqu'à +55 % au lieu de +35 %
- Endurance : 0,2 par tir
- Objet assemblé (recette)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 6 cases · revente 9 cr

#### Faucon Traqueur

<img src="../public/art/items/faucon_traqueur.png" height="48">

**Assemblé · Fusil de précision · 7.62** · Forme `■■■■ / ·■■·` (6 cases) · Assemblé

- Dégâts 28 toutes les 1,5 s
- Chargeur 6 balles · recharge 2,8 s
- Alimentation intégrée : jamais besoin de chargeur
- +10 % de critique
- Sentinelle : quand elle consomme la Marque, +30 % de dégâts en plus
- Endurance : 1 par tir
- Objet assemblé (recette)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 6 cases · revente 9 cr

#### Pompe Dragon

<img src="../public/art/items/pompe_dragon.png" height="48">

**Assemblé · Fusil à pompe · 12G** · Forme `■■■■ / ■···` (5 cases) · Assemblé

- Dégâts 15 toutes les 1,4 s
- Chargeur 5 balles · recharge 2,8 s
- Alimentation intégrée : jamais besoin de chargeur
- Incendiaire : +3 dégâts qui ignorent l'armure
- Plombs : chaque tir touche 2 fois
- Endurance : 1,1 par tir
- ★ Explosif adjacent : +15 % de dégâts
- Objet assemblé (recette)
- Recette : Dragon + Incend. → Souffle du Dragon (ingrédients adjacents : assemblage automatique)
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 5 cases · revente 8 cr

#### Mamba Akimbo

<img src="../public/art/items/mamba_akimbo.png" height="48">

**Assemblé · Pistolet · 9mm** · Forme `■■ / ■■` (4 cases) · Assemblé

- Dégâts 9 toutes les 0,8 s
- Chargeur 16 balles · recharge 2,2 s
- Alimentation : un chargeur 9mm adjacent, sinon recharge ×2
- Plombs : chaque tir touche 2 fois
- Endurance : 0,6 par tir (deux armes à la fois)
- Objet assemblé (recette)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 4 cases · revente 5 cr

#### Taureau Jumeaux

<img src="../public/art/items/taureau_jumeaux.png" height="48">

**Assemblé · Pistolet · .44** · Forme `■■■ / ■■·` (5 cases) · Assemblé

- Dégâts 18 toutes les 1,3 s
- Chargeur 8 balles · recharge 2,6 s
- Alimentation : un chargeur .44 adjacent, sinon recharge ×2
- Plombs : chaque tir touche 2 fois
- +10 % de critique
- Endurance : 1 par tir (deux armes à la fois)
- Objet assemblé (recette)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 5 cases · revente 7 cr

#### Souffle du Dragon

<img src="../public/art/items/souffle_dragon.png" height="48">

**Assemblé · Fusil à pompe · 12G** · Forme `■■■■■ / ■■···` (7 cases) · Assemblé

- Dégâts 17 toutes les 1,4 s
- Chargeur 6 balles · recharge 2,6 s
- Alimentation intégrée : jamais besoin de chargeur
- Plombs : chaque tir touche 2 fois
- Chaque touche pose 2 Brûlure
- Endurance : 1,1 par tir
- ★ Explosif adjacent : +15 % de dégâts
- Objet assemblé (recette)
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 7 cases · revente 15 cr

#### Bobine Tesla

<img src="../public/art/items/bobine_tesla.png" height="48">

**Assemblé · Arme électrique** · Forme `■■■ / ■■■` (6 cases) · Assemblé

- Dégâts 6 toutes les 0,6 s
- Chargeur 30 balles · recharge 2 s
- Alimentation intégrée : jamais besoin de chargeur
- Chaque touche pose 1 Choc
- Endurance : 0,4 par tir
- Chaque décharge de Choc que tu déclenches : +30 dégâts qui ignorent l'armure
- Objet assemblé (recette)
- Famille Tactique : 2 → le fumigène dure 50 % plus longtemps · 4 → prévu avec la radio et le drone
- 6 cases · revente 14 cr

#### Fusil anti-matériel Rhinocéros

<img src="../public/art/items/rhinoceros.png" height="48">

**Assemblé · Fusil de précision · 7.62** · Forme `■■■■■■ / ··■···` (7 cases) · Assemblé

- Dégâts 130 toutes les 3,6 s
- Chargeur 3 balles · recharge 4 s
- Alimentation intégrée : jamais besoin de chargeur
- Son 1er tir est toujours critique
- Ignore 100 % de l'armure
- Endurance : 2,5 par tir
- Objet assemblé (recette)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 7 cases · revente 18 cr

#### KR-4 Mitrailleur

<img src="../public/art/items/kr4_mitrailleur.png" height="48">

**Assemblé · Fusil d'assaut · 5.56** · Forme `■■■■■ / ·■■■·` (8 cases) · Assemblé

- Dégâts 12 toutes les 0,5 s
- Chargeur 60 balles · recharge 4 s
- Alimentation intégrée : jamais besoin de chargeur
- Viper : Feu continu jusqu'à +55 % au lieu de +35 %
- Viper : le Feu continu ne retombe pas à la recharge
- Endurance : 0,3 par tir
- Objet assemblé (recette)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 8 cases · revente 16 cr

### Armes de mêlée

#### Couteau

<img src="../public/art/items/couteau.png" height="48">

**Base · Couteau** · Forme `■■` (2 cases) · Prix 3 · dès le cercle 1

- Mêlée : 4 dégâts toutes les 1 s, pendant tout le duel
- Frappe 1.5 fois plus vite dans un sac sans arme à feu
- Endurance : 0,3 par coup
- ★ Arme de mêlée adjacent (cases marquées) : +2 de saignement par coup
- Recette : Couteau + Couteau → Machette (ingrédients adjacents : assemblage automatique)
- Famille Tactique : 2 → le fumigène dure 50 % plus longtemps · 4 → prévu avec la radio et le drone
- 2 cases · revente 1 cr

#### Couteau de combat

<img src="../public/art/items/couteau_combat.png" height="48">

**Base · Couteau** · Forme `■■` (2 cases) · Prix 5 · dès le cercle 1

- Mêlée : 3 dégâts toutes les 1 s, pendant tout le duel
- Saignement +4 par coup (ignore l'armure)
- Frappe 1.5 fois plus vite dans un sac sans arme à feu
- Endurance : 0,3 par coup
- ★ Arme de mêlée adjacent (cases marquées) : +2 de saignement par coup
- Recette : Machette + Couteau C. → Lame rouge (ingrédients adjacents : assemblage automatique)
- Famille Tactique : 2 → le fumigène dure 50 % plus longtemps · 4 → prévu avec la radio et le drone
- 2 cases · revente 2 cr

#### Masse

<img src="../public/art/items/masse.png" height="48">

**Base · Masse** · Forme `■■■` (3 cases) · Prix 7 · dès le cercle 2

- Mêlée : 12 dégâts toutes les 1,8 s, pendant tout le duel
- Ignore 30 % de l'armure
- Frappe 1.5 fois plus vite dans un sac sans arme à feu
- Endurance : 0,5 par coup
- ★ Protection adjacent : +25 % de dégâts
- Famille Tactique : 2 → le fumigène dure 50 % plus longtemps · 4 → prévu avec la radio et le drone
- 3 cases · revente 3 cr

#### Machette

<img src="../public/art/items/machette.png" height="48">

**Assemblé · Machette** · Forme `■■■` (3 cases) · Assemblé

- Mêlée : 8 dégâts toutes les 1,2 s, pendant tout le duel
- Frappe 1.5 fois plus vite dans un sac sans arme à feu
- Endurance : 0,3 par coup
- ★ Arme de mêlée adjacent (cases marquées) : +25 % de dégâts
- Objet assemblé (recette)
- Recette : Machette + Couteau C. → Lame rouge (ingrédients adjacents : assemblage automatique)
- Famille Tactique : 2 → le fumigène dure 50 % plus longtemps · 4 → prévu avec la radio et le drone
- 3 cases · revente 3 cr

#### Lame rouge

<img src="../public/art/items/lame_rouge.png" height="48">

**Assemblé · Machette** · Forme `■■■■` (4 cases) · Assemblé

- Mêlée : 11 dégâts toutes les 0,9 s, pendant tout le duel
- Saignement +12 par coup (ignore l'armure)
- Frappe 1.5 fois plus vite dans un sac sans arme à feu
- Endurance : 0,2 par coup
- ★ Arme de mêlée adjacent (cases marquées) : +25 % de dégâts
- Objet assemblé (recette)
- Famille Tactique : 2 → le fumigène dure 50 % plus longtemps · 4 → prévu avec la radio et le drone
- 4 cases · revente 8 cr

### Munitions

#### Chargeur 9 mm

<img src="../public/art/items/chg_9mm.png" height="48">

**Base · Munition · 9mm** · Forme `■` (1 case) · Prix 2 · dès le cercle 1

- ★ Arme 9mm adjacent : −25 % de recharge (max 3)
- Recette : Chg 9mm + Briquet → Chargeur incendiaire (ingrédients adjacents : assemblage automatique)
- Recette : Chg 9mm + Batterie → Chargeur électrique (ingrédients adjacents : assemblage automatique)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 1 case · revente 1 cr

#### Chargeur 5.56

<img src="../public/art/items/chg_556.png" height="48">

**Base · Munition · 5.56** · Forme `■` (1 case) · Prix 2 · dès le cercle 1

- ★ Arme 5.56 adjacent : −25 % de recharge (max 3)
- Recette : Chg 5.56 + Briquet → Chargeur incendiaire (ingrédients adjacents : assemblage automatique)
- Recette : Chg 5.56 + Batterie → Chargeur électrique (ingrédients adjacents : assemblage automatique)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 1 case · revente 1 cr

#### Chargeur 7.62

<img src="../public/art/items/chg_762.png" height="48">

**Base · Munition · 7.62** · Forme `■` (1 case) · Prix 3 · dès le cercle 1

- ★ Arme 7.62 adjacent : −25 % de recharge (max 3)
- Recette : Chg 7.62 + Briquet → Chargeur incendiaire (ingrédients adjacents : assemblage automatique)
- Recette : Chg 7.62 + Batterie → Chargeur électrique (ingrédients adjacents : assemblage automatique)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 1 case · revente 1 cr

#### Munitions perforantes

<img src="../public/art/items/perforantes.png" height="48">

**Base · Munition** · Forme `■` (1 case) · Prix 6 · dès le cercle 2

- ★ Arme adjacent : perce 30 % de l'armure
- Recette : Longue-vue + Perfo. → Fusil anti-matériel Rhinocéros (ingrédients adjacents : assemblage automatique)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 1 case · revente 3 cr

#### Cartouches 12G

<img src="../public/art/items/chg_12g.png" height="48">

**Base · Munition · 12G** · Forme `■` (1 case) · Prix 3 · dès le cercle 1

- ★ Arme 12G adjacent : −25 % de recharge (max 3)
- Recette : Sanglier + Cart. 12G → Pompe Dragon (ingrédients adjacents : assemblage automatique)
- Recette : Cart. 12G + Briquet → Chargeur incendiaire (ingrédients adjacents : assemblage automatique)
- Recette : Cart. 12G + Batterie → Chargeur électrique (ingrédients adjacents : assemblage automatique)
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 1 case · revente 1 cr

#### Balles .44

<img src="../public/art/items/chg_44.png" height="48">

**Base · Munition · .44** · Forme `■` (1 case) · Prix 3 · dès le cercle 1

- ★ Arme .44 adjacent : −25 % de recharge (max 3)
- Recette : Taureau + Balles .44 + Silenc. → Taureau Magnum (ingrédients adjacents : assemblage automatique)
- Recette : Balles .44 + Briquet → Chargeur incendiaire (ingrédients adjacents : assemblage automatique)
- Recette : Balles .44 + Batterie → Chargeur électrique (ingrédients adjacents : assemblage automatique)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 1 case · revente 1 cr

#### Munitions traçantes

<img src="../public/art/items/tracantes.png" height="48">

**Base · Munition** · Forme `■` (1 case) · Prix 5 · dès le cercle 2 · Signature Sentinelle

- ★ Arme adjacent : quand elle consomme la Marque, +30 % de dégâts en plus (passif de Sentinelle)
- Recette : Faucon + Traçantes → Faucon Traqueur (ingrédients adjacents : assemblage automatique)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 1 case · revente 2 cr

#### Chargeur incendiaire

<img src="../public/art/items/chg_incendiaire.png" height="48">

**Assemblé · Munition** · Forme `■` (1 case) · Assemblé

- ★ Arme adjacent : l'alimente (tout calibre), −25 % de recharge, chaque touche pose de la Brûlure
- Objet assemblé (recette)
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 1 case · revente 3 cr

#### Chargeur électrique

<img src="../public/art/items/chg_electrique.png" height="48">

**Assemblé · Munition** · Forme `■` (1 case) · Assemblé

- ★ Arme adjacent : l'alimente (tout calibre), −25 % de recharge, chaque touche pose du Choc
- Objet assemblé (recette)
- Recette : Taser L. + Chg élec → Bobine Tesla (ingrédients adjacents : assemblage automatique)
- Famille Tactique : 2 → le fumigène dure 50 % plus longtemps · 4 → prévu avec la radio et le drone
- 1 case · revente 3 cr

### Accessoires

#### Lunette ×4

<img src="../public/art/items/lunette.png" height="48">

**Base · Accessoire** · Forme `■■` (2 cases) · Prix 5 · dès le cercle 1

- ★ Arme longue adjacent : +25 % de critique
- Recette : Aigle + Lunette + Bipied → Aigle Longue-vue (ingrédients adjacents : assemblage automatique)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 2 cases · revente 2 cr

#### Silencieux

<img src="../public/art/items/silencieux.png" height="48">

**Base · Accessoire** · Forme `■■` (2 cases) · Prix 7 · dès le cercle 2

- ★ Arme adjacent : son 1er tir est critique
- Recette : Taureau + Balles .44 + Silenc. → Taureau Magnum (ingrédients adjacents : assemblage automatique)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 2 cases · revente 3 cr

#### Poignée verticale

<img src="../public/art/items/poignee.png" height="48">

**Base · Accessoire** · Forme `■ / ■` (2 cases) · Prix 4 · dès le cercle 1

- ★ Arme adjacent : +25 % de cadence
- Recette : KR-4 + Poignée + Étendu → KR-4 Tactique (ingrédients adjacents : assemblage automatique)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 2 cases · revente 2 cr

#### Chargeur étendu

<img src="../public/art/items/chg_etendu.png" height="48">

**Base · Accessoire** · Forme `■ / ■` (2 cases) · Prix 5 · dès le cercle 1

- ★ Arme adjacent : chargeur +50 %
- Recette : KR-4 + Poignée + Étendu → KR-4 Tactique (ingrédients adjacents : assemblage automatique)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 2 cases · revente 2 cr

#### Viseur holo

<img src="../public/art/items/viseur_holo.png" height="48">

**Base · Accessoire** · Forme `■` (1 case) · Prix 4 · dès le cercle 1

- ★ Arme courte adjacent : +25 % de critique
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 1 case · revente 2 cr

#### Bipied

<img src="../public/art/items/bipied.png" height="48">

**Base · Accessoire** · Forme `■■` (2 cases) · Prix 5 · dès le cercle 1

- ★ Arme longue adjacent : +25 % de dégâts
- Recette : Aigle + Lunette + Bipied → Aigle Longue-vue (ingrédients adjacents : assemblage automatique)
- Famille Précision : 2 → +10 % de critique pour toutes les armes · 4 → critiques ×2,25 au lieu de ×2
- 2 cases · revente 2 cr

#### Chargeur tambour

<img src="../public/art/items/chg_tambour.png" height="48">

**Base · Accessoire** · Forme `■■ / ■■` (4 cases) · Prix 5 · dès le cercle 1 · Signature Viper

- ★ Arme adjacent : chargeur +100 %, recharge +40 % (nourrit le Feu continu)
- Recette : Ours + Tambour → Ours Déluge (ingrédients adjacents : assemblage automatique)
- Recette : KR-4 T. + Tambour → KR-4 Mitrailleur (ingrédients adjacents : assemblage automatique)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 4 cases · revente 2 cr

#### Refroidisseur de canon

<img src="../public/art/items/refroidisseur.png" height="48">

**Base · Accessoire** · Forme `■■■` (3 cases) · Prix 5 · dès le cercle 1 · Signature Viper

- ★ Arme adjacent : son Feu continu monte 100 % plus vite (passif de Viper)
- Famille Rafale : 2 → +15 % de cadence des armes rafale · 4 → 1 balle sur 3 touche deux fois
- 3 cases · revente 2 cr

#### Taser

<img src="../public/art/items/taser.png" height="48">

**Base · Accessoire** · Forme `■■` (2 cases) · Prix 5 · dès le cercle 1

- 3 dégâts, immobilise l'adversaire 1,5 s (quand il recharge, sinon à 6 s)
- 1 charge par combat · délai 0 s
- ★ Arme de mêlée adjacent : +1 charge
- Recette : Taser + Batterie → Taser lourd (ingrédients adjacents : assemblage automatique)
- Famille Tactique : 2 → le fumigène dure 50 % plus longtemps · 4 → prévu avec la radio et le drone
- 2 cases · revente 2 cr

#### Taser lourd

<img src="../public/art/items/taser_lourd.png" height="48">

**Assemblé · Accessoire** · Forme `■■` (2 cases) · Assemblé

- 6 dégâts, immobilise l'adversaire 1,5 s (quand il recharge, sinon à 6 s)
- Pose 5 Choc : décharge immédiate
- 2 charges par combat · délai 6 s
- ★ Arme de mêlée adjacent : +1 charge
- Objet assemblé (recette)
- Recette : Taser L. + Chg élec → Bobine Tesla (ingrédients adjacents : assemblage automatique)
- Famille Tactique : 2 → le fumigène dure 50 % plus longtemps · 4 → prévu avec la radio et le drone
- 2 cases · revente 4 cr

### Protections

#### Plaque céramique

<img src="../public/art/items/plaque.png" height="48">

**Base · Protection** · Forme `■■ / ■■ / ■■` (6 cases) · Prix 7 · dès le cercle 1

- Armure +40
- ★ Protection adjacent (cases marquées) : +8 d'armure
- Recette : Plaque + Casque → Armure lourde (ingrédients adjacents : assemblage automatique)
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 6 cases · revente 3 cr

#### Casque balistique

<img src="../public/art/items/casque.png" height="48">

**Base · Protection** · Forme `■■ / ■■` (4 cases) · Prix 4 · dès le cercle 1

- Armure +15
- ★ Protection adjacent (cases marquées) : +6 d'armure
- Recette : Plaque + Casque → Armure lourde (ingrédients adjacents : assemblage automatique)
- Recette : Casque + Casque → Casque lourd (ingrédients adjacents : assemblage automatique)
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 4 cases · revente 2 cr

#### Armure lourde

<img src="../public/art/items/armure_lourde.png" height="48">

**Assemblé · Protection** · Forme `■■ / ■■ / ■■` (6 cases) · Assemblé

- Armure +75
- Chaque balle reçue perd 2 dégâts
- ★ Soin adjacent : soins +25 % à cet objet
- Objet assemblé (recette)
- Recette : Casque L. + Armure L. → Blindage Juggernaut (ingrédients adjacents : assemblage automatique)
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 6 cases · revente 10 cr

#### Casque lourd

<img src="../public/art/items/casque_lourd.png" height="48">

**Assemblé · Protection** · Forme `■■ / ■■` (4 cases) · Assemblé

- Armure +32
- Chaque balle reçue perd 1 dégâts
- ★ Protection adjacent (cases marquées) : +10 d'armure
- Objet assemblé (recette)
- Recette : Casque L. + Armure L. → Blindage Juggernaut (ingrédients adjacents : assemblage automatique)
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 4 cases · revente 4 cr

#### Combinaison ignifugée

<img src="../public/art/items/combinaison.png" height="48">

**Base · Protection** · Forme `■■ / ■■` (4 cases) · Prix 6 · dès le cercle 2

- Armure +14
- Brûlure reçue −50 %
- ★ Protection adjacent (cases marquées) : +5 d'armure
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 4 cases · revente 3 cr

#### Plaque isolante

<img src="../public/art/items/plaque_isolante.png" height="48">

**Base · Protection** · Forme `■■` (2 cases) · Prix 5 · dès le cercle 2

- Armure +10
- Décharge du Choc à 8 cumuls au lieu de 5
- ★ Protection adjacent (cases marquées) : +4 d'armure
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 2 cases · revente 2 cr

#### Blindage Juggernaut

<img src="../public/art/items/juggernaut.png" height="48">

**Assemblé · Protection** · Forme `■■■ / ■■■ / ■■■` (9 cases) · Assemblé

- Armure +140
- Chaque balle reçue perd 4 dégâts
- Immunisé à la décharge du Choc
- Tirs : Endurance +15 %
- ★ Soin adjacent : soins +30 % à cet objet
- Objet assemblé (recette)
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 9 cases · revente 17 cr

### Explosifs

#### Grenade frag

<img src="../public/art/items/frag.png" height="48">

**Base · Explosif** · Forme `■` (1 case) · Prix 4 · dès le cercle 1

- 20 dégâts à l'adversaire
- 2 charges par combat · délai 7 s
- Endurance : 0.5 par lancer
- ★ Explosif adjacent : +20 % de dégâts
- Recette : Frag + Fumi → Grenade thermite (ingrédients adjacents : assemblage automatique)
- Recette : Frag + Briquet → Grenade incendiaire (ingrédients adjacents : assemblage automatique)
- Recette : Frag + Frag → Grenade à sous-munitions (ingrédients adjacents : assemblage automatique)
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 1 case · revente 2 cr

#### Fumigène

<img src="../public/art/items/fumigene.png" height="48">

**Base · Explosif** · Forme `■ / ■` (2 cases) · Prix 3 · dès le cercle 1

- Précision adverse −50 % pendant 3 s
- 2 charges par combat · délai 8 s
- Endurance : 0.5 par lancer
- ★ Explosif adjacent : +1 charge
- Recette : Frag + Fumi → Grenade thermite (ingrédients adjacents : assemblage automatique)
- Famille Tactique : 2 → le fumigène dure 50 % plus longtemps · 4 → prévu avec la radio et le drone
- 2 cases · revente 1 cr

#### Grenade flash

<img src="../public/art/items/flash.png" height="48">

**Base · Explosif** · Forme `■` (1 case) · Prix 5 · dès le cercle 1

- Étourdit les armes adverses 1,5 s
- 2 charges par combat · délai 8 s
- Endurance : 0.5 par lancer
- ★ Explosif adjacent : +1 charge
- Recette : Flash + Batterie → Grenade IEM (ingrédients adjacents : assemblage automatique)
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 1 case · revente 2 cr

#### Grenade thermite

<img src="../public/art/items/thermite.png" height="48">

**Assemblé · Explosif** · Forme `■ / ■` (2 cases) · Assemblé

- 30 dégâts à l'adversaire, ignore l'armure
- 2 charges par combat · délai 7 s
- Endurance : 0.5 par lancer
- ★ Arme adjacent : +10 % de dégâts à cet objet
- Objet assemblé (recette)
- Recette : Thermite + Sous-mun. → Bombe au phosphore (ingrédients adjacents : assemblage automatique)
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 2 cases · revente 6 cr

#### Grenade à sous-munitions

<img src="../public/art/items/sous_munitions.png" height="48">

**Assemblé · Explosif** · Forme `■` (1 case) · Assemblé

- 22 dégâts à l'adversaire
- 3 charges par combat · délai 6 s
- Endurance : 0.5 par lancer
- ★ Explosif adjacent : +1 charge
- Objet assemblé (recette)
- Recette : Thermite + Sous-mun. → Bombe au phosphore (ingrédients adjacents : assemblage automatique)
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 1 case · revente 4 cr

#### Grenade incendiaire

<img src="../public/art/items/grenade_incendiaire.png" height="48">

**Assemblé · Explosif** · Forme `■` (1 case) · Assemblé

- 14 dégâts à l'adversaire
- Pose 4 Brûlure
- 2 charges par combat · délai 7 s
- Endurance : 0.5 par lancer
- ★ Explosif adjacent : +1 charge
- Objet assemblé (recette)
- Recette : Dragon + Incend. → Souffle du Dragon (ingrédients adjacents : assemblage automatique)
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 1 case · revente 3 cr

#### Grenade IEM

<img src="../public/art/items/grenade_iem.png" height="48">

**Assemblé · Explosif** · Forme `■` (1 case) · Assemblé

- Étourdit les armes adverses 1,2 s
- Pose 4 Choc
- Éteint le Feu continu adverse
- 2 charges par combat · délai 8 s
- Endurance : 0.5 par lancer
- ★ Explosif adjacent : +1 charge
- Objet assemblé (recette)
- Famille Tactique : 2 → le fumigène dure 50 % plus longtemps · 4 → prévu avec la radio et le drone
- 1 case · revente 4 cr

#### Bombe au phosphore

<img src="../public/art/items/bombe_phosphore.png" height="48">

**Assemblé · Explosif** · Forme `■■` (2 cases) · Assemblé

- 30 dégâts à l'adversaire, ignore l'armure
- Pose 8 Brûlure
- 3 charges par combat · délai 6 s
- Endurance : 0.5 par lancer
- ★ Explosif adjacent : +1 charge
- Objet assemblé (recette)
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 2 cases · revente 12 cr

### Médical

#### Trousse IFAK

<img src="../public/art/items/ifak.png" height="48">

**Base · Médical** · Forme `■■ / ■■` (4 cases) · Prix 4 · dès le cercle 1

- Soigne 30 PV quand les PV passent sous 50 %
- 1 charge par combat · délai 4 s
- ★ Protection adjacent (cases marquées) : soins +20 %
- Recette : IFAK + Adré. → Kit de trauma (ingrédients adjacents : assemblage automatique)
- Recette : IFAK + IFAK → Sac médical (ingrédients adjacents : assemblage automatique)
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 4 cases · revente 2 cr

#### Seringue d'adrénaline

<img src="../public/art/items/seringue.png" height="48">

**Base · Médical** · Forme `■■` (2 cases) · Prix 5 · dès le cercle 1

- +30 % de cadence pendant 4 s sous 30 % PV
- 1 charge par combat · délai 6 s
- ★ Arme adjacent : +10 % de cadence à cet objet
- Recette : IFAK + Adré. → Kit de trauma (ingrédients adjacents : assemblage automatique)
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 2 cases · revente 2 cr

#### Kit de trauma

<img src="../public/art/items/kit_trauma.png" height="48">

**Assemblé · Médical** · Forme `■■ / ■■` (4 cases) · Assemblé

- Soigne 35 PV quand les PV passent sous 50 %
- 2 charges par combat · délai 4 s
- ★ Protection adjacent : soins +30 %
- Objet assemblé (recette)
- Recette : Trauma + Sac méd. → Poste de secours (ingrédients adjacents : assemblage automatique)
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 4 cases · revente 7 cr

#### Bandage

<img src="../public/art/items/bandage.png" height="48">

**Base · Médical** · Forme `■` (1 case) · Prix 3 · dès le cercle 1

- Retire 10 de saignement et soigne 12 PV (saignement ≥ 8 ou PV sous 50 %)
- 1 charge par combat · délai 2 s
- ★ Protection adjacent : soins +50 %
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 1 case · revente 1 cr

#### Sac médical

<img src="../public/art/items/sac_medical.png" height="48">

**Assemblé · Médical** · Forme `■■ / ■■` (4 cases) · Assemblé

- Soigne 28 PV quand les PV passent sous 50 %
- 3 charges par combat · délai 5 s
- ★ Soin adjacent : +1 charge à cet objet
- Objet assemblé (recette)
- Recette : Trauma + Sac méd. → Poste de secours (ingrédients adjacents : assemblage automatique)
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 4 cases · revente 4 cr

#### Poste de secours

<img src="../public/art/items/poste_secours.png" height="48">

**Assemblé · Médical** · Forme `■■■ / ■■■` (6 cases) · Assemblé

- Soigne 60 PV quand les PV passent sous 50 %
- Au 1er soin : retire Brûlure, Choc et Saignement
- 3 charges par combat · délai 4 s
- ★ Protection adjacent : soins +30 %
- Objet assemblé (recette)
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 6 cases · revente 13 cr

### Composants

#### Briquet

<img src="../public/art/items/briquet.png" height="48">

**Base · Composant** · Forme `■` (1 case) · Prix 2 · dès le cercle 1

- ★ Explosif adjacent : +20 % de dégâts à cet objet
- Recette : Chg 9mm + Briquet → Chargeur incendiaire (ingrédients adjacents : assemblage automatique)
- Recette : Chg 5.56 + Briquet → Chargeur incendiaire (ingrédients adjacents : assemblage automatique)
- Recette : Chg 7.62 + Briquet → Chargeur incendiaire (ingrédients adjacents : assemblage automatique)
- Recette : Balles .44 + Briquet → Chargeur incendiaire (ingrédients adjacents : assemblage automatique)
- Recette : Cart. 12G + Briquet → Chargeur incendiaire (ingrédients adjacents : assemblage automatique)
- Recette : Frag + Briquet → Grenade incendiaire (ingrédients adjacents : assemblage automatique)
- Famille Démolition : 2 → +1 charge pour chaque explosif · 4 → explosions et fusils à pompe ignorent l'armure
- 1 case · revente 1 cr

#### Batterie

<img src="../public/art/items/batterie.png" height="48">

**Base · Composant** · Forme `■` (1 case) · Prix 2 · dès le cercle 1

- ★ Arme adjacent : +5 % de cadence à cet objet
- Recette : Chg 9mm + Batterie → Chargeur électrique (ingrédients adjacents : assemblage automatique)
- Recette : Chg 5.56 + Batterie → Chargeur électrique (ingrédients adjacents : assemblage automatique)
- Recette : Chg 7.62 + Batterie → Chargeur électrique (ingrédients adjacents : assemblage automatique)
- Recette : Balles .44 + Batterie → Chargeur électrique (ingrédients adjacents : assemblage automatique)
- Recette : Cart. 12G + Batterie → Chargeur électrique (ingrédients adjacents : assemblage automatique)
- Recette : Flash + Batterie → Grenade IEM (ingrédients adjacents : assemblage automatique)
- Recette : Taser + Batterie → Taser lourd (ingrédients adjacents : assemblage automatique)
- Famille Tactique : 2 → le fumigène dure 50 % plus longtemps · 4 → prévu avec la radio et le drone
- 1 case · revente 1 cr

#### Ration de combat

<img src="../public/art/items/ration.png" height="48">

**Base · Composant** · Forme `■` (1 case) · Prix 3 · dès le cercle 1

- Endurance +0,3 par seconde
- Famille Rempart : 2 → +30 % d'armure · 4 → l'armure se régénère de 3 par seconde
- 1 case · revente 1 cr
