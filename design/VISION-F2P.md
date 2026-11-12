# HOT DROP : vision free-to-play (proposition)

Document de vision, pas une spec : il fixe la direction, les principes et l'ordre des chantiers. Les specs détaillées
viendront phase par phase. Il s'appuie sur `PROFONDEUR.md` (mécaniques de classe, statuts, sacoches) et prend le pas
sur `REFONTE-BUILD.md` là où ils se contredisent (rôle des opérateurs et des familles).

---

## 0. En une phrase

Un battle royale en solo joué comme un backpack battler, **gratuit**, où l'on choisit une **classe** à collectionner,
où **le sac décide de la run**, et où chaque **saison** apporte une classe, des objets et un classement.

### Piliers

| Pilier | Ce que ça veut dire | Ce que ça interdit |
|---|---|---|
| **Le sac décide** | La classe donne un point de départ ; ce qu'on ramasse et comment on le range fait la run | Un kit ou une classe qui impose le build dès le départ |
| **Chaque run diverge** | Assez d'objets, de bifurcations et de pression pour ne jamais refaire le même sac | Une stratégie dominante qui gagne à 100 % |
| **Lisible sur téléphone** | Un duel se comprend sans lire de texte : liens visibles, rapport de duel | Des mécaniques invisibles ou des calculs cachés |
| **Juste** | On paie pour l'apparence et le confort de collection, jamais pour la victoire | Objets, puissance ou relances payants |

---

## 1. Constat (novembre 2026)

| Problème | Mesure ou observation |
|---|---|
| Trop facile | Le concepteur gagne ses runs à 100 %. Le kit de départ seul perd dès le cercle 2 (6 % de victoires), mais quelques prises suffisent : la menace des bots plafonne (DPS moyen 49 au cercle 3, 54 au cercle 5) |
| Bots sans plan | Les bots tirent des objets dans un pool, sans archétype : un sac humain bien rangé les dépasse vite |
| Peu de bifurcations | L'opérateur est choisi avant d'avoir vu un objet ; aucun choix ne force à changer de direction ensuite |
| Peu de contenu qui change les règles | 57 objets dont 18 assemblés ; presque tous les liens sont « +X % sur l'arme voisine » |
| Opérateur dans l'entre-deux | Pool commun, donc l'opérateur ne diffère que par un passif, un kit et 2-3 signatures : trop faible pour être une classe, assez présent pour figer l'identité |

---

## 2. Trois couches

```
 CLASSE (hors run)          BUILD (dans la run)                SAISON (le jeu vivant)
 à collectionner      →     ce que le sac devient        →     nouvelle classe, objets,
 mécanique unique           objets, étoiles, recettes,         carte, classement, pass
 part du pool               objets-clés, spécialisation
```

### 2.1 La classe

Une classe est l'unité de contenu principale : c'est elle qu'on débloque, qu'on montre et qu'on sort chaque saison.

| Élément | Règle |
|---|---|
| **Mécanique unique** | Une ressource ou une règle qui change la façon de jouer, que des objets alimentent et dépensent (cf. `PROFONDEUR.md` §4) : pas un bonus de statistiques |
| **Part du pool** | 12 à 15 objets propres (environ un tiers de ce qu'on voit en run), le reste vient du tronc commun |
| **Deux spécialisations** | Proposées au cercle 3 (§2.2), avec 3 ou 4 objets exclusifs chacune |
| **Kit de départ** | Faible et remplaçable (« surplus ») : 1 arme et 1 ou 2 objets. Il ne fixe pas la direction |
| **Puissance** | Horizontale : chaque classe gagne et perd contre d'autres (matrice de contres, `PROFONDEUR.md` §6). Une classe payante n'est jamais plus forte |
| **Apparence** | Un personnage par classe, des tenues à débloquer |

**Classes au lancement** (gratuites, à confirmer en phase 2) :

| Classe | Mécanique | Spécialisations | Origine |
|---|---|---|---|
| **Viper** | Chaleur : monte en tirant, des objets la dépensent | Mitrailleur, Fusilier | Opérateur actuel |
| **Sentinelle** | Repérage : critiques et Marques le remplissent, des objets le dépensent | Sniper, Pistolero | Opérateur actuel |
| **Sapeur** | Charges : les explosifs et la pompe partagent une réserve de charges que des objets rechargent | Artificier, Brécheur | Famille Démolition actuelle |

Classe de la saison 1 (exemple) : **Spectre**, contrôle (fumigène, flash, IEM) et lames, mécanique « Ombre » (esquives
qui s'accumulent).

### 2.2 Le build

C'est la couche qui fait varier les runs. La classe ouvre des chemins ; le sac en choisit un.

| Élément | Règle |
|---|---|
| **Tronc commun** | Objets partagés par toutes les classes : protections, soins, explosifs de base, accessoires, mêlée |
| **Étoiles et recettes** | Inchangées : le placement reste la compétence centrale |
| **Familles** | Elles ne sont plus des identités : elles deviennent des **étiquettes de synergie** (ce qu'une étoile ou une recette attend). Les paliers de famille disparaissent ou deviennent des étoiles |
| **Caisse de largage** | Au début de la run : 3 objets de départ proposés, on en garde 1. La première décision se prend en voyant des objets |
| **Objets-clés** | 2 ou 3 par spécialisation et par archétype du tronc commun, rares, à partir du cercle 2. Chacun change une règle (ex. « chaque recharge lance une grenade », « toute la mêlée saigne ») |
| **Spécialisation au cercle 3** | Un écran de choix entre les 2 spécialisations de la classe ; la carte qui colle au sac est mise en avant. Les objets exclusifs entrent alors dans le pool |
| **Boutique plus présente** | Une boutique à la fin de chaque zone en plus du ravitaillement, avec **verrou** d'une offre. Le magasin redevient le cœur des décisions |
| **Remplacement** | Les objets des cercles 4-5 doivent nettement dépasser ceux du départ : on remplace, on ne fait pas qu'empiler |

### 2.3 La saison

| Durée | 8 à 10 semaines |
|---|---|
| Contenu | 1 classe, 10 à 15 objets (tronc commun et classes existantes), 1 rotation de carte ou de modificateurs de zone, 1 pass |
| Classement | Remis à zéro (doux : on redescend de quelques rangs), récompenses de fin de saison cosmétiques |
| Équilibrage | Correctifs en cours de saison, mesurés sur les duels réels (§5) |

---

## 3. Adversaires et modes

### 3.1 Qui on affronte

| Étape | Adversaires |
|---|---|
| Phase 1 (hors ligne) | **Bots par archétype** : chaque bot suit un plan (objets-clés, rangement correct, étoiles allumées) ; son archétype est visible avant le duel ; la difficulté monte vraiment jusqu'au Top 1 |
| Phase 3 (en ligne) | **Fantômes asynchrones** : le sac figé d'un autre joueur, au même cercle et à un rang proche. Les bots restent en secours quand il manque des fantômes, et pour le mode hors ligne |
| Top 1 | Un fantôme de joueur qui a lui-même atteint le Top 1 (ou un bot « boss » de saison au début) |

**Anti-triche** : la simulation du duel est déterministe et en TypeScript pur. Le serveur rejoue chaque duel classé à
partir des deux sacs et de la graine, et ne garde que son propre résultat.

### 3.2 Modes

| Mode | Contenu | Récompenses |
|---|---|---|
| **Partie libre** | La run actuelle, contre fantômes ou bots, sans enjeu | XP du pass, maîtrise de classe |
| **Classé** | Même run, rang de saison en jeu (gain selon le cercle atteint) | Rang, récompenses de fin de saison |
| **Défi de la semaine** | Une run à modificateur (ex. « pas de boutique », « tout le butin est explosif »), même graine pour tous | Cosmétique du défi, classement de la semaine |

---

## 4. Méta-progression

| Système | Rôle | Récompenses |
|---|---|---|
| **Niveau de compte** | Suivre la progression globale | Déblocages du tutoriel, monnaie douce |
| **Maîtrise de classe** | Récompenser le fait de jouer une classe | Tenues, effets, titres de cette classe |
| **Niveaux de Menace** (par classe) | Difficulté choisie, comme les Ascensions : gagner débloque Menace +1 (bots plus forts, moins de crédits, gaz plus rapide…) | Bordures et titres ; contenu du mode hors ligne |
| **Pass de combat** | Le rendez-vous de la saison (§6) | Cosmétiques, monnaie, classe de la saison |

---

## 5. Économie et monétisation

### 5.1 Monnaies

| Monnaie | Où | Gagnée | Dépensée |
|---|---|---|---|
| **Crédits** | Dans la run uniquement | Duels, caisses, ventes | Boutique de la run. Disparaissent à la fin |
| **Plaques** (douce) | Compte | Parties, pass, missions | Classes, une partie des cosmétiques |
| **Or** (premium) | Compte | Achat ; un peu dans le pass premium | Pass premium, cosmétiques premium, accès anticipé aux classes |

Pas plus de deux monnaies de compte. Les prix s'affichent aussi en euros dans la boutique.

### 5.2 Ce qu'on vend, ce qu'on ne vend jamais

| Vendu | Jamais vendu |
|---|---|
| Skins d'armes (la base noire neutre est faite pour ça), tenues d'opérateurs, sacs, effets de victoire et de mort, emotes | Objets de run, bonus de stats, crédits de run |
| Pass premium | Relances de boutique, Goulag en plus, « continuer » après une défaite |
| Accès anticipé aux classes (aussi gagnables en Plaques) | Loot boxes ou tirages aléatoires payants : achat direct uniquement (réglementation de plusieurs pays, et confiance des joueurs) |
| Packs de démarrage cosmétiques | Avantage en classé de quelque nature que ce soit |

**Règle des classes** : chaque classe se gagne gratuitement. Ordre de grandeur visé : 2 à 3 semaines de jeu régulier
en Plaques, ou la fin du pass gratuit pour la classe de la saison. Le pass premium la donne dès le début.

### 5.3 Pass de combat

| | Gratuit | Premium |
|---|---|---|
| Paliers | 50 | 50, en parallèle |
| Contenu | Plaques, quelques cosmétiques, **la classe de la saison au dernier palier** | La classe de la saison au palier 1, une gamme de skins à thème, un peu d'Or (pas de quoi payer le pass suivant en entier) |
| Progression | XP par partie jouée (le cercle atteint compte, pas seulement la victoire) et missions hebdomadaires légères | Identique |

Garde-fous : pas de missions quotidiennes obligatoires pour finir le pass, finissable en jouant environ 3 à 4 parties
par semaine, pas d'expiration agressive.

---

## 6. Technique

| Besoin | Proposition | Phase |
|---|---|---|
| Comptes, sauvegardes, classements, fantômes | Backend géré (Supabase ou Firebase) : base de données, authentification, fonctions serveur | 3 |
| Vérification des duels | Fonction serveur qui exécute `simulateDuel` (même code que le client) | 3 |
| Plateformes | Web d'abord (déjà en place) ; mobile via un emballage natif (Capacitor par exemple) pour les stores | 3-5 |
| Paiements | Web : prestataire de paiement (Stripe par exemple). Stores : achats intégrés, commission du store | 5 |
| Mesure | Événements de jeu anonymes : rétention, durée des runs, victoires par classe et par cercle, choix de spécialisation | 4 |
| Contenu de saison | Données des classes et objets déjà en fichiers TypeScript (`src/data/`) : une saison = un lot de données + des tests d'équilibre | 2 |

---

## 7. Feuille de route

Chaque phase a un **critère de sortie** : on ne passe pas à la suivante sans l'avoir atteint.

| Phase | Contenu | Critère de sortie |
|---|---|---|
| **1. Boucle tendue** | Bots par archétype ; courbe de difficulté jusqu'au Top 1 ; caisse de largage 1 parmi 3 ; kit de départ « surplus » ; boutique de fin de zone avec verrou | Playtest de 5 personnes : Top 1 gagné 30 à 45 % des runs, au moins 3 archétypes différents parmi les sacs gagnants, « j'ai envie de relancer » |
| **2. Classes** | Refonte des 3 classes (mécanique, part du pool, 2 spécialisations chacune) ; familles en étiquettes ; objets-clés ; statuts de `PROFONDEUR.md` V1.1 | Écart de victoires entre classes ≤ 5 points ; chaque spécialisation choisie dans au moins 30 % des cas ; matrice de contres respectée |
| **3. En ligne** | Comptes, sauvegarde serveur, fantômes asynchrones, vérification serveur, classement simple | 50 testeurs externes jouent une semaine sans bug bloquant ; assez de fantômes pour chaque cercle |
| **4. Méta et pass gratuit** | Niveau de compte, maîtrise, Menace, pass gratuit, mesure | Lancement discret (soft launch). Ordres de grandeur à viser : retour le lendemain ≥ 35 %, après 7 jours ≥ 12 % |
| **5. Monétisation** | Boutique de cosmétiques, pass premium, Or, accès anticipé aux classes | Conversion et retours joueurs mesurés ; aucune plainte crédible de pay-to-win |
| **6. Saisons** | Saison 1 : Spectre, objets, carte, classement | Une saison livrée sans régression d'équilibre |

Les phases 1 et 2 sont du design de jeu pur et peuvent commencer tout de suite. Les phases 3 à 5 demandent les
décisions du §8.

---

## 8. Questions ouvertes (décisions du concepteur)

| # | Question | Ma recommandation |
|---|---|---|
| 1 | Plateforme de lancement : web, mobile, ou les deux ? | Web pour les tests (phases 1-3), puis mobile (Android d'abord, moins contraignant) pour le soft launch |
| 2 | Budget serveur et temps de maintenance d'un jeu en ligne ? | Commencer sur l'offre gratuite d'un backend géré ; un jeu à fantômes asynchrones coûte peu (pas de temps réel) |
| 3 | Nombre de classes au lancement : 3 ou 4 ? | 3 gratuites ; la 4e en saison 1 |
| 4 | Le mode hors ligne (bots) reste-t-il jouable sans compte ? | Oui : c'est l'essai gratuit, et il sert de secours |
| 5 | Le nom « HOT DROP » : est-il libre (marque, stores) ? | À vérifier avant toute dépense de marketing |
| 6 | Structure juridique pour encaisser (TVA, conditions d'utilisation, âge minimum) ? | À traiter avant la phase 5 |
| 7 | Les paliers de famille actuels : supprimés ou convertis en étoiles ? | Convertis en étoiles quand c'est possible (le geste « poser côte à côte » reste le cœur) |

---

## 9. Ce que deviennent les documents existants

| Document | Statut |
|---|---|
| `REFONTE-BUILD.md` | Acquis (étoiles, zones à thème, ravitaillement, sprites, son). Le rôle des opérateurs et des familles est remplacé par ce document |
| `PROFONDEUR.md` | Réservoir des mécaniques de classe (Chaleur, Repérage, spécialisations), des statuts et des sacoches à effet : utilisé en phase 2 |
| `PISTES-WARZONE.md` | Pistes encore valables : déplacement sur la carte, sacs à effet, déblocages (remplacés ici par la méta-progression du §4) |
| `REFONTE-1V1.md` | Historique |
