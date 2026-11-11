# HOT DROP — prototype

Roguelike d'autobattler au gilet tactique, mobile d'abord, jouable dans le navigateur.
Phaser 4 + TypeScript + Vite.

**Règles, recettes et objets : [docs/WIKI.md](docs/WIKI.md)** (généré par `npm run wiki`).

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
