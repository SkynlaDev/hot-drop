# HOT DROP — prototype

Roguelike d'autobattler au gilet tactique, mobile d'abord, jouable dans le navigateur.
Phaser 4 + TypeScript + Vite.

**Règles, recettes et objets : [docs/WIKI.md](docs/WIKI.md)** (généré par `npm run wiki`).

Deux modes :
- **Battle royale sac à dos** : 3 opérateurs (Viper, Sentinelle, Sapeur), objets, recettes et légendaires, Menace 0 à 5,
  défi du jour, carnet de collection. Contenu v3 : [design/CONTENU-V3.md](design/CONTENU-V3.md).
- **Mode Zombie** : survie de 10 minutes vue de dessus, classes personnalisées, armes qui montent de niveau entre les
  parties, power-ups à chaque niveau. Spec : [design/ZOMBIE.md](design/ZOMBIE.md).

## Lancer

```bash
npm install
npm run dev        # http://localhost:5173 (et l'adresse réseau, pour tester sur téléphone)
npm test           # tests de la logique (grille, rareté, synergies, combat)
npm run build      # version statique dans dist/
npm run wiki       # régénère docs/WIKI.md depuis les données
npx vite-node tests/balance.ts   # taux de victoire par étage, pour l'équilibrage
```

## Structure

- `src/data/` : objets, ennemis, menaces et biomes (valeurs de rareté Commun)
- `src/logic/` : règles pures, sans Phaser : grille, rareté, stats et synergies, simulation de combat déterministe, run et sauvegarde
- `src/scenes/` : Menu, Briefing (choix de la prochaine zone), Carte, Gilet (préparation, combat, boutique, loot), Fin
- `src/ui/` : boutons, vues d'objets, modales

## Contrôles

- Glisser : placer un objet (réserve ↔ gilet), ou le déposer sur VENDRE
- Tap : tourner un objet · touche R pendant le glisser sur desktop
- Appui long : fiche de l'objet
- À l'Atelier : déposer un objet sur un objet identique de même rareté pour les fusionner
