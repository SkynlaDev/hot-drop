# Mode Zombie

Un survivor à la Vampire Survivors / Brotato dans l'univers de HOT DROP : un soldat, une ville en ruine au
crépuscule, des hordes qui arrivent de partout. On se déplace, le soldat tire tout seul. Tenir 10 minutes =
extraction (victoire), puis on peut rester en mode sans fin.

Tout le code est dans `src/zombie/` ; seules retouches ailleurs : `src/main.ts` (enregistrement des scènes) et
`src/scenes/MenuScene.ts` (bouton « Mode Zombie »).

## Architecture

| Fichier | Rôle |
| --- | --- |
| `data.ts` | Tables : armes, accessoires, atouts, power-ups, évolutions, zombies, objectifs, constantes de partie |
| `stats.ts` | Stats du soldat en partie (classe + niveau d'arme + accessoires + power-ups + évolutions) |
| `powerups.ts` | Tirage des 3 choix, empilement, évolutions |
| `waves.ts` | Directeur : nombre cible de zombies, types selon le temps, élites, hordes, boss |
| `world.ts` | Simulation pure (sans Phaser) : réserves fixes, grille spatiale, événements pour l'affichage |
| `progress.ts` | Sauvegarde locale : classes, XP et accessoires d'armes, records, objectifs |
| `assets.ts` | Sprites PixelLab + textures dessinées en code (et sprites de repli) |
| `ZHubScene` | QG : 3 classes, records, objectifs, accès arsenal |
| `ZClassScene` | Créateur de classe |
| `ZArsenalScene` | Niveau des armes, accessoires à équiper |
| `ZGameScene` | Le monde : affichage des réserves, effets, sons |
| `ZHudScene` | HUD par-dessus (caméra fixe) : joystick, barres, fenêtres de niveau / pause / extraction |
| `ZEndScene` | Rapport de fin |

Outils : `npx vite-node tests/zombiesim.ts [parties] [arme] [niveau d'arme]` (simulation rapide avec un bot,
pour l'équilibrage), `node tools/zombie-shots.mjs <dossier> menu hub class arsenal game:20 skip:120 …`
(captures playwright, serveur vite sur le port 5199).

## Règles

- **Contrôles** : on pose le doigt n'importe où et on glisse (joystick virtuel qui suit le doigt) ; ZQSD / WASD /
  flèches sur desktop ; Échap ou P pour la pause. Le tir est automatique sur le zombie le plus proche à portée.
- **Arme** : chargeur et rechargement (barre sous le soldat). Coups critiques ×2 (plus avec « Coup au but »).
- **PV** : 100 de base. Contact d'un zombie = un coup toutes les 0,8 s par zombie ; 0,12 s d'invulnérabilité
  après un coup. Crachats acides et explosions des gonflés font aussi mal.
- **XP** : chaque zombie lâche une plaque (bleue 1, verte 2-4, orange 5-19, violette 20+). Rayon de ramassage
  90 px, puis elles filent vers le soldat. Besoin pour passer au niveau suivant : `5 + 6k + 0,32k²` (k = niveau − 1).
- **Niveau** : la partie s'arrête, 3 cartes (4 avec Veinard), une relance par partie (2 avec Veinard).
- **Objets au sol** : trousse (+30 PV, 0,6 % des kills), aimant (toute l'XP vient à soi, 0,25 %), frappe
  aérienne (tue tout à l'écran, 10 % des PV du boss, 0,12 %), caisse (lâchée par les élites et le boss :
  un passage de niveau gratuit).
- **Fin** : mort → rapport. À 10:00, fenêtre d'extraction : partir (victoire) ou continuer en sans fin
  (zombies de plus en plus coriaces, boss toutes les 2 min 30, élites toutes les 20 s).

## Zombies

| Type | PV | Vitesse | Dégâts | XP | Particularité |
| --- | --- | --- | --- | --- | --- |
| Marcheur (4 variantes) | 20 | 54 | 8 | 1 | dès le début |
| Coureur | 13 | 118 | 6 | 1 | dès 0:45 |
| Cracheur | 30 | 50 | 6 | 2 | dès 2:00 ; garde ses distances (220-320 px), crache de l'acide (9) toutes les 2,8 s |
| Gonflé (kamikaze) | 26 | 88 | — | 2 | dès 4:30 ; explose au contact ou à sa mort (26, rayon 85, blesse aussi les zombies) |
| Brute | 190 | 38 | 18 | 6 | dès 3:30 ; lourde (peu de recul) |
| Le Colosse (boss) | 2 000 × rang^1,7 | 44+ | 30+ | 60 | 3:00, 6:00, 9:00 ; charge (préparation 0,8 s, couloir rouge au sol), invoque 3 + 2 × rang marcheurs/coureurs toutes les 12 s |
| Élite | ×7 PV, ×1,5 dégâts, plus gros, rouge | | | ×8 | toutes les 40 s dès 1:00 ; lâche une caisse |

- PV × `1 + 0,1m + 0,03m²` (m = minutes) ; dégâts × `1 + 0,06m`.
- Nombre visé : `14 + 16m + 1,4m²`, plafonné à **250** ; apparitions jusqu'à `2,5 + 1,6m` par seconde, en
  anneau juste hors de l'écran (plus souvent devant le soldat quand il bouge). Les zombies trop loin sont
  replacés devant lui.
- Hordes : un anneau complet à 1:30, 4:30, 7:30 (24 + 6m zombies).

## Armes de départ

| Arme | Dégâts | Tirs/s | Plombs | Portée | Chargeur | Recharge | Particularité |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pistolet Mamba | 16 | 2,6 | 1 | 480 | 12 | 0,9 s | précis, +5 % vitesse |
| SMG Furet | 8 | 8 | 1 | 420 | 32 | 1,5 s | dispersion large |
| Fusil d'assaut KR-4 | 12 | 4,8 | 1 | 560 | 30 | 1,7 s | polyvalent |
| Pompe Sanglier | 13 | 1,4 | 7 | 360 | 6 | 2,0 s | plombs perforants (1), recul |
| Précision Aigle | 68 | 0,85 | 1 | 900 | 5 | 2,0 s | perfore 3, 15 % critique |
| Revolver Taureau | 36 | 1,6 | 1 | 520 | 6 | 1,8 s | perfore 1 — *objectif « Survivre 5 min »* |
| KR-4 Mitrailleur | 9 | 9 | 1 | 520 | 100 | 3,4 s | −12 % vitesse — *objectif « Tenir 10 min »* |

## Progression des armes (entre les parties)

- XP d'arme par partie : 1 par marcheur/coureur, 2 cracheur/gonflé, 4 brute, 60 Colosse, +10 par élite,
  +15 par minute tenue, +150 pour une extraction. (Toutes les éliminations de la partie comptent pour l'arme
  de la classe, y compris celles des soutiens : plus simple à comprendre.)
- Niveau suivant : `120 + 80 (niveau − 1)` XP ; niveau max 15. Chaque niveau : +3 % de dégâts.
- Niveaux 2 à 13 : un accessoire débloqué par niveau, dans un ordre propre à chaque arme (ses accessoires
  phares d'abord). Accessoires équipés : un par emplacement, communs à toutes les classes qui utilisent l'arme.

| Emplacement | Accessoire | Effet |
| --- | --- | --- |
| Bouche | Silencieux | +15 % dégâts, +10 % portée |
| Bouche | Refroidisseur | +15 % cadence |
| Optique | Viseur holo | +8 % critique, −25 % dispersion |
| Optique | Lunette ×4 | +35 % portée, +12 % critique |
| Sous-canon | Poignée verticale | −40 % dispersion, +8 % cadence |
| Sous-canon | Bipied | +22 % dégâts, −6 % vitesse |
| Chargeur | Chargeur étendu | +50 % capacité, −10 % recharge |
| Chargeur | Chargeur tambour | +120 % capacité, +15 % recharge |
| Munitions | Perforantes | +1 perforation |
| Munitions | Traçantes | +10 % critique, balles +30 % plus rapides |
| Munitions | Balles incendiaires | brûlure 30 % des dégâts/s pendant 3 s |
| Munitions | Balles électriques | 15 % de chance d'arc sur 2 zombies |

## Classes

3 emplacements. Nom de code (au hasard parmi 20 ou saisi), apparence (les 7 personnages pixel du jeu),
arme de départ (débloquée), atout :

| Atout | Effet | Disponible |
| --- | --- | --- |
| Médecin | +0,6 PV/s, trousses +50 % | départ |
| Sapeur | Grenades niv. 1 d'office, −25 % délai | départ |
| Éclaireur | +15 % vitesse, +40 % ramassage | départ |
| Tireur d'élite | +12 % critique, +20 % portée | départ |
| Colosse | +40 PV, −10 % dégâts subis, −8 % vitesse | objectif « 1 500 zombies au total » |
| Artificier | explosions +30 % zone, +20 % dégâts | objectif « Abattre un Colosse » |
| Veinard | 4 choix, 2 relances | objectif « Atteindre le niveau 20 » |

## Power-ups (en partie)

21 power-ups, empilables (max 5, ou 4 pour Ricochet, Perforation, Tir multiple).

- **Arme** : Cadence (+12 %), Gros calibre (+15 % dégâts, toutes sources), Ricochet (+1 rebond), Balles
  incendiaires (brûlure 30 → 70 %/s), Balles explosives (30 → 70 % des dégâts, rayon 50 → 90), Perforation (+1),
  Tir multiple (+1 projectile, +2 plombs au pompe), Coup au but (+6 % critique, critiques +10 %),
  Arc électrique (14 → 38 % de chance, 2 → 4 cibles), Main sûre (−12 % recharge, +15 % chargeur).
- **Soutiens** : Grenades (auto, toutes les 3,5 s → 2,1 s, +1 tous les 2 niveaux), Drone de combat (1 → 3 drones),
  Mines (toutes les 3,5 s → 2,3 s), Machettes (1 → 5 lames qui tournent), Tourelle (toutes les 14 s, 9 → 13 s
  de tir), Frappe d'artillerie (3 → 7 obus toutes les 9 s → 5,8 s).
- **Soldat** : Gilet lourd (+20 PV max), Trousse de soins (+0,4 PV/s), Rangers (+8 % vitesse), Aimant
  (+35 % rayon), Plaques (−7 % dégâts subis).

Tirage : sans remise, pondéré (un power-up déjà possédé pèse 1,4 contre 1 ; +0,6 si son partenaire
d'évolution est au max). Plus rien à améliorer : carte « Ration » (soigne 40 %).

### Évolutions

Quand deux power-ups sont au max, l'évolution est proposée en premier au niveau suivant.

| Évolution | Recette | Effet |
| --- | --- | --- |
| Bombardement | Balles explosives + Grenades | 6 grenades toutes les 2 s, zone ×1,3 |
| Tourbillon | Machettes + Rangers | 8 lames rouges, plus larges, dégâts ×2, repoussent |
| Escadrille | Drone + Cadence | 4 drones, cadence ×2, balles perforantes |
| Napalm | Balles incendiaires + Mines | les mines laissent une mare de feu, brûlure ×1,5 |
| Seconde vie | Gilet lourd + Trousse | revient une fois à 60 % des PV (onde de choc), régénération ×2 |
| Forteresse | Tourelle + Artillerie | 2 tourelles permanentes qui suivent, artillerie toutes les 4 s |

## Objectifs et records

Records : meilleur temps, plus de zombies en une partie, plus haut niveau ; totaux (zombies, parties,
extractions, Colosses). Objectifs (QG → Objectifs) : Survivre 5 min (Revolver), Abattre un Colosse
(Artificier), 1 500 zombies au total (Colosse), Niveau 20 (Veinard), Tenir 10 min (KR-4 Mitrailleur),
Tenir 15 min en sans fin (titre).

## Performances

Réserves de taille fixe pour tout (250 zombies, 420 balles, 420 plaques d'XP, objets, mines, obus, effets,
28 nombres de dégâts) ; une image Phaser par case de réserve, cachée quand elle est libre. Collisions par
grille spatiale (cases de 64 px, 44 × 44 centrées sur le soldat, listes chaînées dans des `Int32Array`),
séparation des zombies par la même grille. Pas de moteur physique. Les événements de la simulation passent
par un anneau de 640 objets réutilisés.

## Journal

### Étape 1-2 : boucle jouable, power-ups, vagues (décisions par défaut)

- Simulation pure séparée de l'affichage (comme `src/logic/` pour le jeu principal) : elle se teste et se
  simule sans navigateur (`tests/zombiesim.ts`, 600 s de partie en ~0,2 s).
- Monde infini (sol en tuiles qui défile), pas d'obstacles : plus lisible sur petit écran, et les zombies
  ne se coincent pas. Les zombies trop loin sont replacés devant le soldat.
- Personnages vus de côté (comme les sprites existants), retournés selon la direction ; un léger
  balancement en code remplace une animation de marche.
- Rechargement : ajouté (absent de Vampire Survivors) pour donner du sens aux chargeurs et différencier
  les armes.
- HUD dans une scène à part lancée par-dessus le monde (caméra fixe) : les widgets du jeu (bannières,
  toasts, fenêtres) s'y utilisent tels quels.

### Étape 3 : QG, classes, arsenal, fin

- Nom de code : 20 indicatifs au hasard, ou saisie via la boîte de dialogue du navigateur (pas de champ
  texte dans le canevas ; évite de toucher à la configuration DOM de Phaser).
- Accessoires communs à toutes les classes qui portent l'arme (on améliore *son* arme, pas une copie).
- Bouton du menu principal : « Mode Zombie » partage la dernière rangée avec « Réglages » (ex-« Paramètres »)
  pour ne pas allonger le menu, qui est déjà au bord de l'écran quand une partie est en cours.

### Étape 4 : équilibrage, lisibilité, effets

- **Bug d'affichage contourné** : dans les scènes du mode, des sprites *tournés* perdaient parfois la moitié de
  leur quad (zombies coupés en diagonale, soldat mort en lambeaux). Pas reproduit dans une page Phaser
  minimale ; contourné en n'utilisant plus de rotation sur les personnages : démarche en écrasement /
  étirement, mort en affaissement. (Les balles, grenades et machettes tournent encore : petites, ça ne se voit
  pas.) À surveiller dans le jeu principal (l'écran de fin y tourne aussi le personnage de −82°).
- Nombres de dégâts en chiffres-images (et pas en `Text`) : moins coûteux, et aucune texture qui change à
  chaque coup.
- Sol : tuiles Wang PixelLab (asphalte / gravats) assemblées en une texture de 512 px qui se raccorde sur
  ses bords (grille de coins torique), ×2 à l'écran. Plus claire que le fond du jeu : les zombies sombres s'y
  détachent.
- Le boss, les brutes et les élites ne virent plus au blanc à chaque balle (simple voile clair) ; le boss
  vire au rouge et trace un couloir au sol pendant sa préparation de charge. Flèches au bord de l'écran vers
  le boss (rouge) et les élites (or). Bords rouges qui battent sous 30 % de PV.
- Simulation (bot qui fuit la foule et ramasse l'XP proche, choix selon une préférence fixe ; 6 parties par
  arme) : à arme niveau 1, 0 à 4 extractions sur 6 selon l'arme, morts typiques entre 3:30 et 6:00 ; à arme
  niveau 8 avec accessoires, 4 extractions sur 6. C'est voulu : la première partie apprend, la progression
  d'arme fait gagner. Retouches : rayon de ramassage 70 → 90, boss 2 600 → 2 000 PV (rang 1), invocations
  plus rares, SMG et pompe renforcés, mitrailleuse un peu affaiblie. Le pompe reste faible pour le bot (qui
  fuit au lieu d'aller au contact) : à vérifier en jouant.
- Performances mesurées dans Chromium : à 250 zombies, simulation ≈ 0,07 ms et mise à jour des sprites
  ≈ 0,25 ms par image.

### Étape 5 : finitions

- Cracheur redessiné (PixelLab : capuche jaune, gorge verte gonflée) pour qu'on le distingue du marcheur.
- Fenêtres en partie (niveau, extraction, pause) : 450 ms d'insensibilité à l'ouverture, pour que le doigt
  qui tenait le joystick ne choisisse pas une carte en se relevant.
- Rappel des commandes au début de chaque partie ; titre « Increvable » au QG après 15 minutes en sans fin.
- Explosions moins aveuglantes (lueur plus petite, traces de brûlé légères et courtes) : avec Bombardement,
  l'écran restait lisible.
