# HOT DROP: redesign "1v1 backpacks" (spec shared by the agents)

The game designer (French-speaking, writes all player-facing text in French) asked for a
simplification. Everything below is decided; do not redesign it, implement it.
All player-facing strings stay in French. Code comments are in French, like the existing code.

## Run loop
1. Menu → **operator choice** (2 operators, `src/data/operators.ts`, already written: Viper = rafale,
   Sentinelle = précision). The operator fixes the item pool: `lootPool(op)` = own family + neutral
   (rempart, tactique, frag, flash). Démolition items (pompes, 12G) are out of the pools for now (keep their data).
2. **Battle-royale map**: ~9 zones of **different sizes** (petite / moyenne / grande) scattered on the map.
   No zone type indications, no biomes, no threats, no shop/établi places. A gas circle shrinks.
3. **ROUNDS = 5 circles.** Each round the player picks one zone inside the current circle and drops in.
4. In the zone, cards are drawn face-up: **petite 4, moyenne 6, grande 8**. The player plays **3** of them,
   one at a time, in any order. Card types:
   - **Squad**: chain of 2 duels (3 from round 3), HP carries over between the squad's duels. Big loot.
   - **Solo**: one duel. Normal loot.
   - **Caisse** (supply crate): modest loot, no fight (1 item, sometimes a bag).
   - **Shop**: opens the shop (5 offers from the operator pool, bags sometimes, reroll for credits).
   - **Caisse épique** (grande zones only, 50 % of drops, at most 1 per zone; it replaces one drawn card):
     no fight, at least 1 item Épique (15 % Légendaire) + 1 ordinary item of the round.
   Grande zones draw more squads and stronger bots ("hot" zones); petite zones are calmer.
   Danger bonus: petite +0, moyenne +0.5, grande +1 level, ramped by circle (`DANGER_RAMP` in bots.ts:
   ×0 at circle 1, then ×0.25, ×0.5, ×0.5, ×0.75).
   **Circle 1: everyone just dropped.** Whatever the zone size, circle-1 bots have a starting bag
   (never 'fort', starter items, all Common, base 5×4 backpack). Zone size at circle 1 only changes the card mix,
   so starting in a hot zone is a valid choice.
5. After the 3 actions the circle shrinks, zones outside it are gassed, next round.
6. After round 5: **final duel "Top 1"** against a very strong build. Win = victory.

## Fights: always 1v1, backpack vs backpack
- The enemy (bot) has a real backpack generated like a player's (same items, same rules, same
  `computeLoadout`). Symmetric simulation: both sides shoot each other, frag hits the opponent,
  flash stuns the opponent's weapons, smoke lowers the opponent's accuracy, heal/adrenaline on self.
- Multi-target mechanics are meaningless in 1v1: `targets: 2` becomes 2 hits per shot on the same target
  (pellets), ricochet (rafale tier 4) becomes "1 bullet in 8 hits twice".
- Max HP: `100 + 20 × round` for everyone (player and bots of that round).
- HP fully resets between actions (but not between the duels of a squad).
- The further you go, the more likely (not certain) a bot has a good build: better rarity, recipe items,
  smart placement (feeding chargeurs, accessories adjacent). Some bots are weak, some are strong.
- Loot from a won duel comes **from the bot's own backpack**: after each duel won (solo or each bot of a squad),
  the player sees the defeated bot's backpack as it was packed and **chooses exactly 1 item** in it
  ("comme quand on loot vraiment un gars"), + credits. The end of a squad adds a credit bonus and a bag chance.
  The choice is pending in the run (`pendingLoot`, survives a reload); no card, end of action or next squad duel
  until it is taken (`takeLoot`). Reserve full: the chosen item is sold automatically.

## Defeat: the Goulag
- First lost duel of the run (any card) → **Goulag**: one 1v1 against a fair bot (level of the round).
  Win → back in the game (the rest of the squad is cancelled, the action is consumed). Lose → run over.
- Goulag used once per run. A second defeat = run over. Losing the Top 1 = run over.

## Backpack and bags (sacoches), like Backpack Battles
- Grid max **9 cols × 8 rows**. Base backpack (always usable): **cols 2..6, rows 2..5** (5×4).
- **Bags** are separate objects (`data/bags.ts`) placed on the grid outside or next to the backpack;
  a cell is usable if it is in the base backpack or covered by a placed bag. Items sit on top of bags.
  A bag can be moved only when no item sits on it (V1). Bags: Pochette 1×2, Sacoche 2×2, Ceinture 1×4,
  Sac tactique 2×3 (rarer, pricier). Bags come from the shop and crates. No more "extension" purchases.
- Vest zones (poitrine/flancs/ceinture bonuses) are removed.
- **Recipes**: no more Établi. A recipe is crafted automatically as soon as its ingredients are adjacent,
  outside combat (`findCraftable` + `craft`, which must respect usable cells).
- Fusion of 2 identical same-rarity items stays.

## Removed
Biomes, briefing, threats (blindés, tireurs…), guardians, Cdt Kesh, sursis, planque, établi, extensions,
vest zones. Delete the dead code and data instead of leaving it around.
