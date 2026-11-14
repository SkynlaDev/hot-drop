# HOT DROP : contenu v3 (journée autonome du 14 novembre 2026)

Le concepteur est absent pour la journée et a donné carte blanche : « au plus près des Battle Backpack, des objets,
des crafts, de la diversité et une envie de rejouer ». Pas de backend : tout reste hors ligne contre les bots.
Sauvegarde de l'état de départ : tag `backup-2026-11-14` et branche `backup/2026-11-14` (GitHub), archive
`../hot-drop-backups/hot-drop-2026-11-14.tar.gz`.

Chaque décision prise par défaut est notée ici et se change sans tout refaire.

## Plan (un commit poussé par étape)

| # | Étape | Pourquoi (Backpack Battles) |
|---|---|---|
| 1 | **Objets légendaires** : 9 objets uniques qui changent une règle du duel | Les objets « qui font le build » (Ruby Whelp, Hero Sword…) : un vrai moment de run |
| 2 | **Vague d'objets** : drone et radio (palier 4 de Tactique enfin réel), Molotov, pointes creuses, économie (caisse de l'intendant), 6 recettes dont un rang 2, archétype de bot « Drones » | Plus de pistes de build, objets qui rapportent, objets qui agissent seuls (les « pets ») |
| 3 | **Envie de rejouer** : profil local (statistiques, historique), carnet de collection (objets et recettes découverts), niveaux de Menace par opérateur, défi du jour (graine du jour) | Ascensions, collection, défi quotidien : les moteurs de rejouabilité, sans serveur |
| 4 | Sprites PixelLab des 20 nouveaux objets, wiki, équilibrage (`runsim`, matrice) | |

## 1. Objets légendaires

| Règle | Valeur |
|---|---|
| Niveau | « Légendaire » (3e niveau après Base et Assemblé), cadre violet clair |
| Apparition | Jamais au 1er cercle. Caisse épique : 60 % de chance d'en proposer un. Boutique : 18 % de chance que la dernière offre en soit un. Élites à partir du 3e cercle : 40 % d'en porter un (on peut le fouiller). Le bot du Top 1 en porte toujours un |
| Unicité | Un seul exemplaire de chaque par partie : plus proposé une fois possédé (sac ou réserve) |
| Bots | Chaque archétype a ses légendaires (`legendaries` dans `archetypes.ts`) |

| Objet | Forme | Règle | Étoile |
|---|---|---|---|
| Médaille de l'ange gardien | 1 | Une fois par duel, à 0 PV : revient à 35 % des PV | Protection : +10 d'armure |
| Détonateur de recharge | 2 | Chaque recharge d'une arme : éclat de 14 (moitié perce) | Explosif : +20 % |
| Plaques du vétéran | 1 | +1 dégât par touche par duel gagné dans la partie (Goulag compris), max +10 | — |
| Poche de sang | 1×2 | Vol de vie 10 % | Médical : soins +25 % |
| Bouclier anti-émeute | 2×3 | Armure 25, bloque les 6 premières touches (balles, coups, éclats) | Mêlée : +25 % de dégâts |
| Lunette thermique | 2 | Chaque critique pose 3 Brûlure | — |
| Insigne des Lames | 1 | Toute la mêlée : +4 saignement par coup, +25 % de vitesse | — |
| Condensateur | 2 | Toutes les 8 touches d'arme à feu : 5 Choc (décharge) | — |
| Cocktail de combat | 1 | Endurance max +6, +0,4/s | Arme : +8 % de cadence |

Moteur : nouveaux événements `revive` et `shot.blocked` ; l'éclat du détonateur est un `frag`, le vol de vie un
`heal` (paquets de 3 PV au moins). Rapport de duel : « N touches bloquées », résurrection comptée en soin.

## Journal

**Étape 1 (légendaires : fait)**. Décisions par défaut : chiffres ci-dessus ; légendaires revendus à moitié prix comme
le reste ; la règle du légendaire est la première ligne de sa fiche (c'est elle qu'affiche l'offre de boutique).
Sprites provisoires (icônes) en attendant l'étape 4.

## 2. Vague d'objets : drones, radio, Molotov, pointes creuses, économie

| Objet | Forme | Effet |
|---|---|---|
| Drone de reconnaissance (dès le 2e cercle, 9 cr) | 2×2 | Arme « Drone » : 4 dégâts / 0,7 s, chargeur 30, alimentation intégrée, **aucune Endurance** |
| Radio de campagne (dès le 2e cercle, 7 cr) | 1×2 | Frappe d'artillerie 30, 2 charges, délai 9 s, **aucune Endurance** ; ★ arme : +10 % de dégâts |
| Balles à pointe creuse (dès le 2e cercle, 5 cr) | 1 | Arme adjacente (tout calibre) +20 % de dégâts, sans l'alimenter |
| Caisse de l'intendant (6 cr) | 2 | Économie : à chaque nouveau cercle, posée dans le sac, +2 crédits (+1 par cercle passé) |
| Cocktail Molotov (4 cr) | 1 | 8 dégâts + 5 Brûlure, 2 charges : une source de Brûlure dès le 1er cercle |

| Recette | Résultat |
|---|---|
| Drone + Batterie | **Drone d'assaut** : 6 / 0,55 s, chargeur 40, pose du Choc |
| Radio + Frag | **Appui mortier** : frappe 40, 3 charges, délai 8 s |
| Radio + Lunette | **Désignateur laser** : frappe 55 qui ignore l'armure, 2 charges ; ★ arme +15 % |
| Molotov + Molotov | **Bidon de napalm** : 12 + 8 Brûlure, 3 charges |
| Caisse + Caisse | **Coffre-fort** : +6 crédits par cercle (+1 par cercle passé) |
| Drone d'assaut + Appui mortier (rang 2) | **Essaim de drones** : 5 / 0,3 s, chargeur 60, Choc, sans Endurance |

**Palier 4 de Tactique** (enfin réel) : drones et radios agissent 30 % plus vite. Nouvel archétype de bot **Drones**
(les deux opérateurs, deux armes) ; Molotov et napalm chez Démolition, pointes creuses chez Marque et Tir lourd.

**Étape 2 (fait)**. Décisions par défaut : le drone profite du Feu continu de Viper comme toute arme (sans ça Viper
tombait à 43 % contre Sentinelle au 5e cercle, Sentinelle profitant déjà de la Marque avec un drone en 2e arme) ;
la Caisse de l'intendant rapporte au passage du cercle, avant la boutique du ravitaillement (ligne « Intendance »).

## 3. Envie de rejouer (profil local, sans serveur)

| Système | Règle |
|---|---|
| **Profil** (`src/logic/profile.ts`, `localStorage`) | Parties, Top 1, record par opérateur, 12 dernières parties (objets marquants du sac final) |
| **Carnet** (menu → Carnet) | Tous les objets : en couleur une fois obtenus (notés à chaque sauvegarde de la run), « ? » sinon. Compteurs objets / recettes découvertes / légendaires |
| **Menace** (choix de l'opérateur) | 0 à 5 par opérateur ; gagner le Top 1 au plus haut niveau débloque le suivant. Cumulatif : 1 bots +0,5 de danger ; 2 −3 crédits au départ, relance 3 cr ; 3 pas de Goulag ; 4 bots +1 de danger en tout (Top 1 compris) ; 5 PV max −15 % |
| **Défi du jour** (menu) | Graine et opérateur tirés de la date, Menace 1, même partie pour tout le monde ce jour-là ; meilleur résultat gardé (le bouton affiche « Défi ✓ ») ; ne débloque pas de Menace |
| Fin de partie | « MENACE N DÉBLOQUÉE », « NOUVEAU RECORD » ou « DÉFI DU JOUR : MEILLEUR RÉSULTAT » |

Paramètres : déplacés dans une roue dentée en haut à droite du menu (place pour Défi du jour et Carnet).

**Étape 3 (fait)**. Décisions par défaut : le Goulag n'ajoute pas la Menace au danger (il reste un duel équitable) ;
le défi du jour est en Menace 1 ; les objets vus au cours d'une partie (même revendus) comptent dans le carnet.

## 4. Sprites

20 sprites PixelLab (`create_image_pro`, image de style des armes, masque de forme, `fit-place.py`) : planche
`design/da/contenu-v3-objets.png`. 70 générations : un appel par taille de canevas avec plusieurs objets dans la
description (un appel coûte au moins 10 générations). Faibles : les ailes de la médaille de l'ange gardien se voient
peu ; l'essaim est dense mais lisible.

## 5. Troisième opérateur : le Sapeur

| | |
|---|---|
| Famille | Démolition (fusils à pompe, explosifs) ; arme au largage : une pompe parmi les trois |
| Passif | **Réaction en chaîne** : chaque explosion déclenchée (grenade, frappe de radio, C4, détonateur) donne +10 % de dégâts aux explosions suivantes et accélère ses explosifs de 6 %, 4 cumuls au plus |
| Signatures | **Charge C4** (2 cases, 26 dégâts qui ignorent l'armure, ★ explosif : +1 charge) ; **Amorces électriques** (1 case, Réaction en chaîne jusqu'à 6 cumuls, ★ explosif : +15 % de dégâts) ; **Gilet de démineur** (2×2, armure 24, −1 par balle, ★ explosif : +1 charge, dès le 2e cercle) |
| Kit | Casque, Charge C4, couteau |
| Personnage | PixelLab (`public/art/px/sapeur.png`, planche `design/da/sapeur.png`), 10 générations |
| Choix de l'opérateur | Onglets (un par opérateur) et une grande carte : passif, sac de départ, objets de signature, record |

**Étape 5 (fait)**. Équilibrage mesuré (bots contre bots, 900 bots par cercle) : chaque opérateur entre 46 et 53 %
à chaque cercle. Corrections en chemin :
- Les **drones d'assaut** posaient du Choc, le contre du Feu continu : Viper avec Feu continu était tombé de 45 % à
  39 % contre Sentinelle. Le Choc est remplacé par des dégâts (drone 5, drone d'assaut 10, essaim 8) et 30 % de
  perce-armure.
- Les **drones** ne posent ni ne consomment la Marque (ils tirent seuls) ; ils gardent le Feu continu de Viper.
- Les **frappes de radio** étaient trop fortes (gratuites en Endurance) : radio 24, appui mortier 30 ×3, désignateur
  34 ; chez les bots, seuls ceux du plan Drones en portent (les bots Lame en portaient quatre).
- L'archétype de bot **Drones** est joué par Sentinelle et le Sapeur (Viper garde son identité de rafale).
- Le test « Viper contre Sentinelle » passe à 600 paires : avec 300, l'échantillon du 5e cercle sortait de la marge
  (41-43 %) alors que la valeur mesurée sur 2 400 duels est de 46 à 48 %.
- Réaction en chaîne réduite (de +12 % / 8 % / 5 cumuls à +10 % / 6 % / 4) : Démolition et Drones du Sapeur
  dépassaient 63 %.

Simulation de runs (`runsim 40`, avant ces corrections) : agressif 18 % de Top 1 (Viper 0 %, Sentinelle 35 %),
d'où la chasse ci-dessus. À remesurer.

**Mesure après l'étape 5** (`runsim 45`) : agressif 18 % de Top 1 (Viper 7 %, Sentinelle 20 %, Sapeur 27 %, 15 runs
chacun : très bruité), prudent 4 %. Un peu sous l'avant-journée (25 %) : le simulateur n'achète ni légendaires ni
objets v3 de façon réfléchie, alors que le bot du Top 1 porte désormais toujours un légendaire. À surveiller au
prochain playtest humain (cible : 30 à 45 % de Top 1).

## 6. Promotions en boutique

Une fois sur trois (`SHOP_SALE_CHANCE`), une offre d'objet est à −50 % (arrondi au supérieur) : pastille rouge et
ancien prix barré. Comme dans Backpack Battles, ça pousse à acheter un objet hors de son plan… ou à relancer.
