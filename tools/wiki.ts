// Génère le wiki du jeu (docs/WIKI.md) à partir des données et des constantes des règles.
// Usage : npm run wiki. À relancer après chaque changement de données : le wiki ne s'écrit jamais à la main.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { CATEGORY_NAMES, Category, FAMILY_INFO, ITEMS, ItemDef } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { BAGS, BAG_IDS } from '../src/data/bags';
import { OPERATORS, OPERATOR_IDS } from '../src/data/operators';
import { describe, maxHpFor, FAMILY_TIERS, UNFED_RELOAD, MELEE_ONLY_SPEED, FEU_RATE, FEU_CAP, MARK_BONUS } from '../src/logic/stats';
import { starSpecs } from '../src/logic/stars';
import { ACCURACY, MAX_TIME, BLEED_RATE } from '../src/logic/combat';
import {
  ROUNDS, ZONE_COUNT, ACTIONS_PER_ZONE, CARDS_BY_SIZE, CARD_WEIGHTS, EPIC_CRATE_CHANCE, RICH_CRATES_FROM_ROUND, THEME_BIAS,
} from '../src/logic/zone';
import {
  CRATES, CATEGORY_WEIGHTS, DUEL_PICKS, ELITE_PICKS, ELITE_BAG_CHANCE, REROLL_COST, RESERVE_MAX, BAG_RESERVE_MAX,
  SELL_RATIO, SHOP_OFFERS, SHOP_BAG_CHANCE, START_CREDITS, duelCredits,
} from '../src/logic/run';
import { COLS, ROWS, BASE_X0, BASE_X1, BASE_Y0, BASE_Y1 } from '../src/logic/grid';

const OUT_DIR = 'docs';
const OUT = `${OUT_DIR}/WIKI.md`;
/** Chemin des sprites vu depuis docs/. */
const sprite = (id: string, h = 40) => existsSync(`public/art/items/${id}.png`) ? `<img src="../public/art/items/${id}.png" height="${h}">` : '';
const pct = (v: number) => `${Math.round(v * 100)} %`;
const name = (id: string) => ITEMS[id].name;
const shapeOf = (d: ItemDef) => '`' + d.shape.join(' / ').replace(/X/g, '■').replace(/\./g, '·') + '`';
const cells = (d: ItemDef) => d.shape.join('').split('').filter((c) => c === 'X').length;

const L: string[] = [];
/** Bloc de texte : une ligne vide entre deux lignes, sauf à l'intérieur d'une liste ou d'un tableau. */
const kind = (l: string) => (l.startsWith('|') ? 't' : /^(- |\d+\. )/.test(l) ? 'l' : 'p');
const p = (...lines: string[]) => {
  lines.filter((l) => l !== '').forEach((l, i, a) => {
    if (i > 0 && (kind(l) === 'p' || kind(l) !== kind(a[i - 1]))) L.push('');
    L.push(l);
  });
  L.push('');
};

p('# Hot Drop — Wiki', '> Généré par `npm run wiki` depuis les données du jeu : ne pas modifier à la main.');

p('## Sommaire',
  '1. [Le principe](#le-principe)',
  '2. [Déroulé d’une partie](#déroulé-dune-partie)',
  '3. [Le sac](#le-sac)',
  '4. [Le combat](#le-combat)',
  '5. [Les liens : étoiles et accessoires](#les-liens--étoiles-et-accessoires)',
  '6. [Familles](#familles)',
  '7. [Opérateurs](#opérateurs)',
  '8. [Recettes](#recettes)',
  '9. [Butin, caisses et boutique](#butin-caisses-et-boutique)',
  '10. [Sacoches](#sacoches)',
  '11. [Objets](#objets)');

// ---------- Principe ----------
p('## Le principe',
  'Un battle royale en solo, joué comme un *backpack battler* : on se largue sur une carte, on ramasse des objets, on les range dans un sac en grille, et les duels se jouent seuls à partir de ce que contient le sac.',
  'Tout se décide **hors combat** : quoi prendre, quoi revendre, et surtout **où ranger chaque objet**, car les objets qui se touchent se renforcent (étoiles, accessoires, chargeurs, recettes).',
  `Objectif : survivre aux ${ROUNDS} cercles puis gagner le duel final, le **Top 1**.`);

// ---------- Déroulé ----------
p('## Déroulé d’une partie');
p('### La carte et le cercle',
  `- La carte compte ${ZONE_COUNT} zones de trois tailles (petite, moyenne, grande). Elle est grande au départ et le cercle de gaz se resserre à chaque manche : les zones gazées ne sont plus jouables.`,
  `- Une partie dure ${ROUNDS} manches (cercles). À chaque manche on choisit une zone dans le cercle et on s’y largue.`,
  `- Dans une zone, on tire des cartes (petite ${CARDS_BY_SIZE.petite}, moyenne ${CARDS_BY_SIZE.moyenne}, grande ${CARDS_BY_SIZE.grande}) et on en joue **${ACTIONS_PER_ZONE}** : chaque carte jouée est une action.`,
  '- Après la dernière action, le cercle se resserre : **ravitaillement** (une boutique garantie), puis retour sur la carte pour la manche suivante.',
  `- Après la ${ROUNDS}ᵉ manche : ravitaillement, puis le duel final **Top 1** contre le bot le plus fort de la partie.`);
p('### Les cartes',
  '| Carte | Effet |', '|---|---|',
  '| Duel | Un duel contre un bot. Victoire : crédits, puis on prend ' + DUEL_PICKS + ' objet dans son sac. |',
  `| Élite | Un duel contre un bot fort. Victoire : plus de crédits, ${ELITE_PICKS} objets à prendre dans son sac, ${pct(ELITE_BAG_CHANCE)} de chance d’une sacoche. |`,
  '| Caisse | Quelques objets proposés, on en garde un, plus des crédits. |',
  `| Caisse renforcée | Plus d’objets et de crédits, dont un ingrédient qui complète une recette commencée (à partir du cercle ${RICH_CRATES_FROM_ROUND + 1}). |`,
  `| Caisse épique | Contient un objet assemblé. Seulement dans les grandes zones (${pct(EPIC_CRATE_CHANCE.grande)} de chance par zone, à partir du cercle ${RICH_CRATES_FROM_ROUND + 1}). |`,
  '| Boutique | Acheter, revendre, relancer les offres. |');
p('Fréquence des cartes selon la taille de la zone (poids relatifs) :',
  '| Zone | Duel | Élite | Caisse | Caisse renforcée | Boutique |', '|---|---|---|---|---|---|',
  ...(['petite', 'moyenne', 'grande'] as const).map((s) => {
    const w = CARD_WEIGHTS[s];
    return `| ${s} | ${w.solo} | ${w.elite} | ${w.caisse} | ${w.caisse_renforcee} | ${w.shop} |`;
  }),
  'Une zone contient toujours au moins un combat, au plus une boutique et une caisse renforcée. Plus la zone est grande, plus les bots sont dangereux… et plus le butin est riche.');
p('### Thèmes de zone',
  `Chaque zone a un thème : ${pct(THEME_BIAS)} du butin (boutique, caisses, objets des bots) en vient.`,
  '| Thème | Oriente vers |', '|---|---|',
  '| Armurerie | Armes à feu et armes de mêlée |',
  '| Hôpital | Soins et protections |',
  '| Chantier | Explosifs et famille Démolition |',
  '| Commissariat | Accessoires et munitions |',
  '| Marché noir | Pas d’orientation, mais deux fois plus de boutiques |');
p('### Duels, crédits et Goulag',
  `- Chaque duel commence PV pleins. PV max à la manche *n* (1ʳᵉ = 0) : ${maxHpFor(0)} + ${maxHpFor(1) - maxHpFor(0)} × *n* (${[0, 1, 2, 3, 4, 5].map(maxHpFor).join(', ')} PV au Top 1). Les bots ont les mêmes PV.`,
  `- Crédits d’un duel gagné : ${duelCredits('solo', 0)} + ${duelCredits('solo', 1) - duelCredits('solo', 0)} × manche ; Élite : ${duelCredits('elite', 0)} + ${duelCredits('elite', 1) - duelCredits('elite', 0)} × manche.`,
  '- **Goulag** : la première défaite de la partie envoie au Goulag, un duel équitable PV pleins. Gagné, on revient en jeu ; perdu, c’est la fin. Une seule fois par partie.',
  '- Une défaite sans Goulag disponible, ou au Top 1, termine la partie.');

// ---------- Sac ----------
p('## Le sac',
  `- La grille fait ${COLS} × ${ROWS} cases. Le sac de base occupe le centre (${BASE_X1 - BASE_X0 + 1} × ${BASE_Y1 - BASE_Y0 + 1} cases) ; les **sacoches** posées autour ajoutent des cases utilisables.`,
  '- Chaque objet a une forme ; on peut le tourner par quarts de tour. Ses étoiles tournent avec lui.',
  `- Réserve : ${RESERVE_MAX} objets et ${BAG_RESERVE_MAX} sacoches non posés. Seuls les objets posés dans le sac comptent en combat.`,
  `- Revente : ${pct(SELL_RATIO)} du prix (au moins 1 crédit).`,
  `- Crédits de départ : ${START_CREDITS}.`);

// ---------- Combat ----------
p('## Le combat',
  'Le duel se joue seul, sac contre sac, et dure en général 12 à 20 secondes.',
  `- **Armes à feu** : tirent en continu. Précision de base ${pct(ACCURACY)}. Critique de base 5 %, dégâts ×2.`,
  `- **Chargeurs** : les munitions sont infinies, mais une arme rechargée sans chargeur de son calibre posé contre elle recharge **${UNFED_RELOAD} fois plus lentement** (badge « RECH ×${UNFED_RELOAD} »). Chaque chargeur adjacent du bon calibre accélère encore la recharge.`,
  '- **Armure** : absorbe les dégâts avant les PV, sauf la part qui la perce.',
  `- **Mêlée** : frappe pendant tout le duel, à côté des armes à feu. Dans un sac **sans aucune arme à feu**, elle frappe ${String(MELEE_ONLY_SPEED).replace('.', ',')} fois plus vite (build Lame).`,
  `- **Saignement** : dégâts qui ignorent l'armure, versés peu à peu (${pct(BLEED_RATE)} de la réserve par seconde).`,
  '- **Objets actifs** (grenades, fumigène, soins, taser, bandage…) : se déclenchent seuls, avec des charges et un délai.',
  `- **Temps limite** : ${MAX_TIME} s. Au-delà, gagne celui qui a la plus grande part de ses PV max.`,
  '- **Rapport de duel** : après chaque duel, chaque objet du sac affiche ce qu\'il a apporté (dégâts en orange, soins en vert, armure absorbée en bleu-gris, le plus utile entouré d\'or). Le bouton « Rapport » détaille les deux sacs : touches, critiques, saignement, déclenchements, et les objets liés à chacun.');

// ---------- Liens ----------
p('## Les liens : étoiles et accessoires',
  'Les objets se renforcent quand ils se touchent dans le sac (bords partagés). Tout lien se voit dans le sac :',
  '- **Étoiles** : certains objets ont des étoiles sur des cases précises autour d’eux. Une étoile s’allume quand un objet du bon type occupe une de ses cases. Quand on tient un objet, les cases où il se lierait s’affichent en étoiles creuses, et les objets qu’il attend sont entourés en vert. Chaque objet posé affiche « ★ n », son nombre d’étoiles allumées.',
  '- **Accessoires et chargeurs** : ils ont une étoile tout autour d’eux qui attend une arme compatible (calibre pour les chargeurs, arme longue pour la lunette et le bipied, arme courte pour le viseur holo).',
  '- En boutique, en caisse et au butin : « ★ » signale un objet qui se lierait au sac, « ⚗ » un objet qui complète une recette.',
  '- *Max* : au plus ce nombre d’objets comptent pour une même étoile.');
p('### Toutes les étoiles',
  '| Objet | Attend | Effet |', '|---|---|---|',
  ...Object.values(ITEMS).flatMap((d) => starSpecs(d.id).map((s) =>
    `| ${sprite(d.id, 24)} ${d.name} | ${s.wantLabel}${s.at ? ' (cases précises)' : ' (tout autour)'} | ${s.text}${s.max ? ` (max ${s.max})` : ''} |`)));

// ---------- Familles ----------
p('## Familles',
  `Chaque objet appartient à une famille. Avoir ${FAMILY_TIERS[0]} puis ${FAMILY_TIERS[1]} objets d’une famille posés dans le sac donne des bonus.`,
  `| Famille | ${FAMILY_TIERS[0]} objets | ${FAMILY_TIERS[1]} objets |`, '|---|---|---|',
  ...Object.values(FAMILY_INFO).map((f) => `| ${f.name} | ${f.tier2} | ${f.tier4} |`));

// ---------- Opérateurs ----------
p('## Opérateurs',
  'On choisit un opérateur au début de la partie. Le pool d’objets est commun : chacun peut tout prendre, sauf les **objets de signature** de l’autre opérateur (et ce qui s’assemble avec eux).');
for (const id of OPERATOR_IDS) {
  const o = OPERATORS[id];
  const sig = Object.values(ITEMS).filter((d) => d.signature === id).map((d) => d.name);
  p(`### ${o.name}`,
    `*${o.pitch}*`,
    `- **Passif** : ${o.passive}.`,
    `- **Famille** : ${FAMILY_INFO[o.family].name}.`,
    `- **Objets de signature** : ${sig.join(', ') || 'aucun'}.`,
    `- **Sac de départ** : ${o.start.map(([d]) => name(d)).join(', ')}.`);
}
p(`Détails des passifs : Feu continu +${pct(FEU_RATE)} de cadence par seconde de tir sans recharger, plafonné à +${pct(FEU_CAP)} ; Marque +${pct(MARK_BONUS)} de dégâts sur la touche suivante d’une autre arme.`);

// ---------- Recettes ----------
p('## Recettes',
  'Quand tous les ingrédients d’une recette sont **posés dans le sac et se touchent** (en un seul bloc), ils s’assemblent automatiquement hors combat en un objet plus fort. Les objets assemblés ne se trouvent jamais au butin ni en boutique (sauf caisse épique).',
  '| Ingrédients | Résultat |', '|---|---|',
  ...RECIPES.map((r) => `| ${r.inputs.map((i) => `${sprite(i, 24)} ${name(i)}`).join(' + ')} | ${sprite(r.output, 24)} **${name(r.output)}** |`));

// ---------- Butin ----------
p('## Butin, caisses et boutique',
  '| Caisse | Objets proposés | À garder | Crédits (manche *n*) | Chance de sacoche |', '|---|---|---|---|---|',
  ...(Object.keys(CRATES) as (keyof typeof CRATES)[]).map((k) => {
    const c = CRATES[k];
    const label = { caisse: 'Caisse', caisse_renforcee: 'Caisse renforcée', caisse_epique: 'Caisse épique' }[k];
    return `| ${label} | ${c.offers} | ${c.picks} | ${c.cash(0)} + ${c.cash(1) - c.cash(0)} × *n* | ${pct(c.bag)} |`;
  }),
  'Une caisse propose toujours au moins une arme.',
  `- **Boutique** : ${SHOP_OFFERS} offres, ${pct(SHOP_BAG_CHANCE)} de chance que l’une soit une sacoche. Relance : ${REROLL_COST} crédits.`,
  `- **Répartition du butin** par catégorie : ${(Object.keys(CATEGORY_WEIGHTS) as Category[]).map((c) => `${CATEGORY_NAMES[c]} ${CATEGORY_WEIGHTS[c]} %`).join(', ')}.`,
  '- Certains objets n’apparaissent qu’à partir d’un certain cercle (colonne « Dès » des tableaux d’objets).');

// ---------- Sacoches ----------
p('## Sacoches',
  'Posées sur la grille à côté du sac de base, elles ajoutent des cases. Les grandes deviennent plus fréquentes en fin de partie.',
  '| Sacoche | Forme | Prix |', '|---|---|---|',
  ...BAG_IDS.map((id) => `| ${BAGS[id].name} | \`${BAGS[id].shape.join(' / ').replace(/X/g, '■')}\` | ${BAGS[id].price} |`));

// ---------- Objets ----------
p('## Objets',
  'Formes : ■ = case occupée, · = case vide, lignes séparées par « / » (avant rotation).');
const groups: [string, (d: ItemDef) => boolean][] = [
  ['Armes à feu', (d) => !!d.weapon && !d.crafted],
  ['Armes à feu assemblées', (d) => !!d.weapon && !!d.crafted],
  ['Armes de mêlée', (d) => !!d.melee],
  ...(['munition', 'accessoire', 'protection', 'explosif', 'medical'] as Category[]).map((c) =>
    [CATEGORY_NAMES[c] + (c === 'munition' || c === 'accessoire' ? 's' : c === 'medical' ? '' : 's'), (d: ItemDef) => d.category === c && !d.weapon && !d.melee] as [string, (d: ItemDef) => boolean]),
];
for (const [title, f] of groups) {
  const list = Object.values(ITEMS).filter(f);
  if (!list.length) continue;
  p(`### ${title}`);
  for (const d of list) {
    const info = describe({ defId: d.id });
    const meta = [
      `**${info.subtitle}**`,
      `Forme ${shapeOf(d)} (${cells(d)} case${cells(d) > 1 ? 's' : ''})`,
      d.crafted ? 'Assemblé' : `Prix ${d.price} · dès le cercle ${d.minRound + 1}`,
      d.signature ? `Signature ${OPERATORS[d.signature].name}` : '',
    ].filter(Boolean).join(' · ');
    p(`#### ${d.name}`, sprite(d.id, 48), meta, ...info.lines.map((l) => `- ${l}`));
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, L.join('\n'));
console.log(`${OUT} : ${L.length} lignes, ${Object.keys(ITEMS).length} objets, ${RECIPES.length} recettes`);
