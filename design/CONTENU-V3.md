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
