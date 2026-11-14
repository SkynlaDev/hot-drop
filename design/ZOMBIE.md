# Mode Zombie

Un survivor à la Vampire Survivors / Brotato dans l'univers de HOT DROP : un soldat, une ville en ruine au
crépuscule, des hordes qui arrivent de partout. On se déplace, le soldat tire tout seul. Tenir 10 minutes, puis
rejoindre l'hélico = extraction (victoire) ; on peut aussi l'ignorer et rester en mode sans fin. Trois décors
(ville en ruine, forêt, port industriel) avec des obstacles qui font des couloirs et des goulots.

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
| `map.ts` | Carte, pure : décors, génération des obstacles par morceaux (graine), collisions, ligne de tir, champ de flux |
| `extraction.ts` | Zone d'atterrissage à 10:00 : placement, attente, réussite (pur) |
| `mapview.ts` | Affichage des obstacles, du sol du décor, de la zone et de l'hélico ; flèche et jauge du HUD |
| `progress.ts` | Sauvegarde locale : classes, XP et accessoires d'armes, records, objectifs |
| `assets.ts` | Sprites PixelLab + textures dessinées en code (et sprites de repli) |
| `anim.ts`, `gait.ts` | Marches et chutes animées (feuilles `public/art/zombie/anim/`), cadence liée à la distance parcourue |
| `audio.ts` | Sons et musique du mode (Web Audio) ; `music.ts` (boucles calculées), `zsynth.ts` (bruitages calculés), `mix.ts` (intensité, limiteur de voix) |
| `ZHubScene` | QG : 3 classes, records, objectifs, accès arsenal |
| `ZClassScene` | Créateur de classe |
| `ZArsenalScene` | Niveau des armes, accessoires à équiper |
| `ZGameScene` | Le monde : affichage des réserves, effets, sons |
| `ZHudScene` | HUD par-dessus (caméra fixe) : joystick, barres, fenêtres de niveau / pause / extraction |
| `ZEndScene` | Rapport de fin |

Outils : `npx vite-node tests/zombiesim.ts [parties] [arme] [niveau d'arme]` (simulation rapide avec un bot,
pour l'équilibrage ; 5ᵉ argument : décor `ville`, `foret`, `port`, `aucun` ou `tous`), `?carte=foret` dans
l'adresse pour forcer un décor, `node tools/zombie-shots.mjs <dossier> menu hub class arsenal game:20 skip:120 …`
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
- **Fin** : mort → rapport. À 10:00, une zone d'atterrissage apparaît à 950-1 350 px (flèche verte au bord de
  l'écran, distance en mètres) ; y tenir 10 s (la jauge redescend de 0,5 s par seconde hors de la zone) pendant
  que la horde redouble (apparitions ×3, +70 zombies visés) = extraction (victoire). Sinon la partie continue en
  sans fin (zombies de plus en plus coriaces, boss toutes les 2 min 30, élites toutes les 20 s) et l'hélico
  attend toujours.
- **Carte** : obstacles (voitures, bus, murets, barricades, gravats ; sapins, arbres morts, rochers, troncs ;
  conteneurs, caisses, fûts) qui bloquent le soldat, les zombies et les balles (sauf celles des drones, qui
  tirent d'en haut ; grenades et obus passent par-dessus ; les balles perforantes traversent en y perdant une
  perforation). Le soldat ne tire que sur ce qu'il voit (sauf avec 2 perforations ou plus).

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

## Carte

- Monde infini découpé en morceaux de 16 × 16 cases de 64 px, générés à la demande depuis la graine de la
  partie, le décor et leurs coordonnées. Chaque obstacle occupe une empreinte de cases entières (pas de
  chevauchement) ; son collisionneur (rectangle ou cercle) est un peu plus petit que l'empreinte.
- La couronne de chaque morceau reste libre : une « rue » de 128 px tous les 1 024 px. Chaque obstacle posé est
  annulé s'il coupe une case libre de la couronne (remplissage) : pas d'enclos, tout l'espace libre est relié.
  Zone de départ : disque de 380 px dégagé.
- Génération par structures, selon le décor : obstacle seul, ligne (murets, barricades, voitures, conteneurs)
  avec une brèche dans les lignes de 3 et plus (un goulot), bosquet (arbres, caisses et fûts).
- Collisions : le cercle est repoussé hors du collisionneur (glissement le long des bords). Rayon contre les
  obstacles plafonné à 24 px : brutes, élites et Colosse passent dans les rues de 64 px (leur sprite déborde un
  peu). La charge du Colosse se brise sur un obstacle.
- Pilotage des zombies : champ de flux (distances en 4-voisinage sur 48 × 48 cases autour du soldat, recalculé
  quand il change de case, ~2 300 cases). Un zombie qui voit le soldat (ligne libre de la case au soldat,
  calculée à la demande et mise en cache) va tout droit ; sinon il vise le centre de la case suivante du champ
  (deux cases plus loin si la ligne est libre : trajectoire plus souple). À égalité, le côté choisi dépend de la
  case : une foule se partage des deux côtés d'un obstacle.
- Les balles s'arrêtent sur les obstacles, sauf les balles perforantes de l'arme : traverser un obstacle coûte
  une perforation (et 15 % de dégâts, comme un zombie). Le choix de cible ne retient que les zombies en vue (les
  8 plus proches, puis le premier en ligne libre) ; avec 2 perforations ou plus (Précision Aigle, ou des
  power-ups), le soldat tire aussi à travers les obstacles. Balles des drones, grenades et obus passent
  par-dessus. Sans cela, le Précision et le Revolver (cadence lente) s'effondraient en simulation.
- Obstacles devant le soldat qui le recouvriraient : à demi transparents.
- Décor tiré au hasard à chaque partie (annoncé par un toast « Secteur : … ») ; pas de choix au QG pour
  l'instant (`?carte=` pour les essais).

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

### Ressenti : animations, musique, sons

- **Animations PixelLab** (`animate_image` sur les sprites existants, 64 px × 8 images = 1 génération, 96 et
  128 px = 2) : marche de 8 images pour les 9 zombies (4 marcheurs, coureur, cracheur, gonflé, brute, Colosse)
  et les 8 personnages jouables ; chute de 9 images pour tous les zombies sauf le gonflé (il explose) et pour
  les 8 soldats. Feuilles dans `public/art/zombie/anim/` (`<nom>-walk.png`, `<nom>-die.png`, ≈ 0,8 Mo en
  tout) ; planche : `design/zombie/anim-planche.png`. 37 générations en tout (marcheur 1 d'abord pour valider
  la méthode : bon du premier coup, aucune reprise).
- **Marche pilotée par la distance**, pas par le temps : `GaitTracker` (pur, testé) lisse la vitesse réelle de
  chaque case de réserve et avance l'image d'une case tous les 5 px × taille × échelle (bornée 5-18 images/s).
  Les zombies arrêtés (cracheur à distance, foule bloquée) ne pédalent pas ; reculs et téléportations
  (zombie replacé, case réutilisée) n'emballent pas les jambes ; chaque zombie démarre à une phase différente.
  Décision : pas de `Sprite` + lecteur d'animations Phaser pour les 250 zombies (une mise à jour par objet et
  par image) : les images restent des `Image`, et `setFrame` n'est appelé que quand l'image change. Les chutes
  (rares) sont de vraies animations Phaser sur une réserve de 24 corps, qui restent au sol ~1 s puis s'effacent
  (seulement à l'écran). Le soldat tombe avec sa propre chute (repli : l'ancien affaissement).
- Le dandinement en écrasement / étirement reste, réduit (3,5 % → 1,2 %) et sans le petit saut vertical (la
  marche a déjà son balancement). Toujours aucune rotation de personnage. Repli : une feuille absente →
  l'image fixe et le dandinement d'origine.
- **Coût** (Chromium, 250 zombies, mesure A/B dans la même partie) : `render()` ≈ 0,2-0,3 ms par image avec
  ou sans animations (l'écart est sous le bruit de mesure).
- **Musique et bruitages calculés en code** : l'abonnement PixelLab (palier 1) refuse `create_music` et
  `create_sound_effect` (palier 2 requis). Décision : synthèse dans le style de `src/audio/synth.ts`, donc
  **aucun fichier audio** (0 octet à télécharger) et tout est déterministe et testé. Trois boucles mono à
  22 050 Hz : « calme » (QG, 70 bpm, 27 s : nappes ré mineur, arpège, vent), « tension » (partie, 92 bpm,
  21 s : basse pulsée, battement de cœur, cloches en seconde mineure), « menace » (même tempo et longueur :
  tambours, cuivres saturés, cordes en trémolo, montée de bruit). Les notes qui dépassent la fin repartent au
  début : boucles sans couture. Calcul ≈ 0,1 s par boucle, fait par lots de 6 ms entre deux images.
- **Intensité** (`mix.ts`) : « tension » joue toujours, « menace » se superpose en fondu (constante 1,2 s)
  selon la menace : la foule seule fait à peine monter, une horde la pousse au maximum 18 s puis elle redescend
  en 14 s, le Colosse la tient au maximum tant qu'il vit ; +0,15 sous 30 % de PV.
- **Bruitages** : 4 grognements (voix à formants, râle, souffle), rugissement du Colosse à son arrivée et cri
  court avant chaque charge, éclatement mouillé du gonflé, montée de niveau (arpège), choix d'une amélioration,
  plaque d'XP (« blip » qui monte avec la barre). Grognements : cadence en racine de la foule plafonnée à
  1,1/s, voix d'un zombie au hasard près de l'écran (volume selon la distance, panoramique, hauteur selon le
  type). Limiteur (`VoiceLimiter`, testé) : 8 voix pour ces sons, 2 grognements à la fois (0,3 s d'écart),
  1 rugissement, 3 éclatements ; le limiteur des sons du jeu (14 voix) reste en place.
- **Réglage « Musique »** ajouté à `src/logic/settings.ts` (défaut : activée) ; paramètres du menu : « Son »
  devient « Bruitages » + « Musique » côte à côte ; bouton « Musique : oui / non » dans la pause. La musique ne
  joue que dans les scènes du mode (branchée dans `zBackdrop` et au lancement de la partie) et s'arrête quand on
  en sort.
- À vérifier à l'oreille sur téléphone (rien n'a pu être écouté ici) : niveaux relatifs musique / bruitages
  (`MUSIC_VOL` 0,34, « calme » à 0,6), timbre des grognements, et si la couche « menace » n'est pas trop
  présente avec Bombardement.

### Carte : obstacles, décors, extraction

- **Monde** : resté infini (cohérent avec les apparitions en anneau et le recyclage des zombies lointains),
  découpé en morceaux de 1 024 px générés à la demande depuis une graine. Couronne libre autour de chaque
  morceau (« rues ») et connexité vérifiée obstacle par obstacle : pas d'enclos, et la vérification ne coûte
  rien (256 cases par essai). Revers assumé : la trame de rues se devine tous les 1 024 px.
- **Décors** (`?carte=` pour forcer) : ville en ruine (voitures, bus, murets, barricades, gravats ; sol
  d'origine), forêt (sapins, arbres morts, rochers, troncs couchés ; sol terre et mousse), port industriel
  (conteneurs, caisses, fûts ; sol de dalles et gravier). Tiré au hasard à chaque partie : un choix au QG
  demanderait de retoucher le QG, laissé pour plus tard.
- **Sprites** : PixelLab `create_map_object` (vue « high top-down », 1 génération chacun, fond transparent),
  rognés et affichés à la largeur de leur empreinte ; sols : `create_topdown_tileset` standard (32 px, 1
  génération), assemblés en textures de 512 px raccordées (grille de coins torique), assombris un peu. Les
  personnages restant vus de côté, les obstacles sont en 3/4 : la profondeur (pieds) les trie avec les
  zombies. L'hélico : un sprite, rotor dessiné en code (pas de sprite tourné, voir l'étape 4).
- **Pilotage** : champ de flux plutôt que simple glissement (un zombie qui glisse le long d'un mur droit vers
  le soldat reste collé au mur quand le soldat est juste derrière). Un zombie qui voit le soldat va tout droit :
  pas de démarche en escalier en terrain dégagé.
- **Extraction** : la fenêtre « Partir / Continuer » de 10:00 est remplacée par la zone d'atterrissage. À 10:00
  la partie passe d'office en sans fin (minuterie « +0:00 » rouge, boss toutes les 2 min 30…) et l'hélico
  attend jusqu'à ce qu'on le rejoigne. Victoire = extraction seulement : mourir après 10:00 sans l'avoir
  rejoint est une défaite (l'objectif « Tenir 10 min » reste acquis au temps). Rapport de fin : « Dix minutes
  tenues. L'hélico décolle sous les griffes. », ou « Extrait après …, dont … en sans fin ».
- **Équilibrage** (bot, 12 parties par arme, 3 décors en alternance, jusqu'à 13:00) : la carte rendait le bot
  nettement plus fragile (extractions à arme niveau 1 : 7/84 contre 21/84 sans carte). Compensations : 15 %
  de zombies visés en moins sur une carte (`MAP_CROWD`), balles perforantes qui traversent les obstacles,
  tir à travers les obstacles à 2 perforations ou plus, et le bot choisit son cap parmi 16 en gardant de
  l'espace devant lui. Résultat : niveau 1 : pistolet 0/12, SMG 2, fusil d'assaut 6, pompe 0, précision 1,
  revolver 2, mitrailleuse 6 (sans carte : 1, 3, 5, 4, 1, 2, 5) ; niveau 8 : 8, 10, 10, 6, 6, 8, 11 (sans
  carte : 8, 7, 11, 5, 8, 11, 12). Le bot qui atteint 10:00 réussit presque toujours l'extraction (10 s dans
  la zone, apparitions ×3) ; un joueur de niveau plus bas y souffre davantage (capture `carte-extraction-*`).
  Le pompe reste le plus faible pour le bot sur carte (perforation 1 perdue sur les obstacles) : à vérifier
  en jouant.
- **Performances** : simulation à ~240 zombies, en Node : 0,063 ms par image sans carte, 0,11 ms avec
  (champ de flux recalculé quand le soldat change de case, vues en cache, collisions sur 1 à 4 cases par
  zombie). Dans Chromium (sans GPU) : simulation 0,18-0,20 ms, sprites 0,30-0,53 ms, carte (obstacles
  visibles, zone) 0,05-0,09 ms par image.
- **Captures** : `design/zombie/carte-ville.png`, `carte-foret.png`, `carte-port.png`, `carte-contournement.png`
  (la foule se partage des deux côtés d'un bus et d'un muret), `carte-extraction-appel.png` (flèche verte,
  distance), `carte-extraction-attente.png`, `carte-extraction-decollage.png`, `carte-extraction-fin.png`.
- **Reste / fragile** : la trame régulière des rues ; brutes, élites et Colosse débordent visuellement sur les
  obstacles (rayon de collision plafonné à 24 px) ; le champ de flux couvre 3 072 px autour du soldat (au-delà,
  les zombies vont tout droit, mais ils sont recyclés à 1 350 px) ; pas de choix du décor au QG.


### Après fusion (ressenti + carte)

- Fusion des branches `zombie-ressenti` et `zombie-carte` dans `main` : conflits seulement d'ajouts (imports,
  champs, préchargement) dans `ZGameScene.ts`, gardés des deux côtés ; vérifié en partie (port, zombies animés,
  corps au sol).
- **Fusil à pompe sur carte** : 0 extraction sur 12 à arme niveau 1. Ses 2 perforations le faisaient viser les
  zombies cachés derrière les obstacles, et ses plombs dispersés s'y écrasaient. Il ne vise plus que ce qu'il
  voit (le tir à travers les obstacles reste aux armes à balle unique avec 2 perforations ou plus) : 5 sur 12
  (fusil d'assaut : 6 sur 12, décors alternés).

### Sons coupés (14/11/2026)

À l'écoute, la musique et les bruitages calculés du mode (grognements, rugissements, éclatement, niveau, XP) ne
sont pas assez bons : ils sont coupés par `ZOMBIE_AUDIO = false` (src/logic/settings.ts). Le code reste en place ;
les réglages « Musique » (paramètres et pause) sont masqués tant que l'interrupteur est à false. Les tirs, impacts
et sons d'interface, partagés avec le jeu principal, restent actifs.
