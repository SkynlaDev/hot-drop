// Génère les images du jeu (SVG) dans public/art/ à partir des dessins de la maquette.
// Lancer : node tools/gen-art.mjs   (à relancer après toute modification de tools/art/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIG_DEFS, figure, sandbags, jersey, container, drums } from './art/figures.mjs';
import { ICONS } from './art/icons.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art');
const write = (rel, svg) => {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, svg);
};
const manifest = { icons: {}, figures: {}, backgrounds: [], covers: {} };

// ---------- Icônes : blanches, teintées dans le jeu ----------
for (const [key, [vb, raw]] of Object.entries(ICONS)) {
  // Certaines icônes répètent l'attribut stroke (S + stroke="#000") : le second l'emporte, SVG strict l'interdit.
  const body = raw.replace(/stroke="currentColor"( fill="none" stroke-linecap="round" stroke-linejoin="round") stroke="/g, '$1 stroke="');
  const [, , w, h] = vb.split(' ').map(Number);
  const k = 96 / Math.max(w, h);
  write(`icons/${key}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${Math.round(w * k * 2)}" height="${Math.round(h * k * 2)}" fill="#ffffff" color="#ffffff">${body}</svg>`);
  manifest.icons[key] = { w: Math.round(w * k * 2), h: Math.round(h * k * 2) };
}

// ---------- Personnages : pieds à l'ancre, regard vers la droite ----------
const FIG = { w: 150, h: 128, x: 75, y: 116, scale: 4 };
const poses = { op: ['kneel', 'stand'], mil: ['stand'], mitr: ['stand'], tir: ['prone', 'stand'], lt: ['stand'], kesh: ['stand'] };
for (const [kind, list] of Object.entries(poses)) {
  for (const pose of list) {
    const f = figure(kind, pose, FIG.x, FIG.y, 1);
    const rel = (p) => (p ? [+(p[0] - FIG.x).toFixed(1), +(p[1] - FIG.y).toFixed(1)] : null);
    write(`fig/${kind}-${pose}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FIG.w} ${FIG.h}" width="${FIG.w * FIG.scale}" height="${FIG.h * FIG.scale}"><defs>${FIG_DEFS}</defs>${f.svg}</svg>`);
    // Points utiles (bouche du canon, tête, poitrine), relatifs aux pieds, à l'échelle 1
    manifest.figures[`${kind}-${pose}`] = { w: FIG.w, h: FIG.h, ax: FIG.x / FIG.w, ay: FIG.y / FIG.h, muzzle: rel(f.muzzle), head: rel(f.head), chest: rel(f.chest), scale: FIG.scale };
  }
}

// ---------- Couverts (devant les personnages) ----------
const cover = (name, w, h, body) => {
  write(`cover/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}"><defs>${FIG_DEFS}</defs>${body}</svg>`);
  manifest.covers[name] = { w, h, scale: 4 };
};
cover('sandbags', 60, 40, sandbags(4, 38, 4, 4, '#6d644d'));
cover('jersey', 60, 32, jersey(4, 30, 52, 27, '#7a766c'));
cover('drums', 44, 34, drums(4, 32, 2, '#5a2f22'));
cover('container', 100, 44, container(4, 42, 92, 38, '#2f4a4f'));

// ---------- Décors de combat par biome (680 × 288, comme le bandeau du jeu) ----------
const W = 680;
const H = 288;
const HORIZON = 150;
const sky = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const ground = (top, mid, bot, line) => `
  <linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".4" stop-color="${mid}"/><stop offset="1" stop-color="${bot}"/></linearGradient>
  ${line ? '' : ''}`;
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const fog = (c, y = HORIZON - 30, h = 60, o = 0.2) => `<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset=".5" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>|<rect y="${y}" width="${W}" height="${h}" fill="url(#fog)"/>`;
const vignette = `<radialGradient id="vign" cx=".5" cy=".55" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>`;
const perspective = (op = 0.18) => {
  let s = '';
  for (let i = -8; i <= 16; i++) s += `<path d="M${W / 2 + i * 40} ${HORIZON + 6} L${W / 2 + i * 120} ${H}" stroke="#000" stroke-opacity="${op}" stroke-width="1.5"/>`;
  return s;
};

function backdrop(biome) {
  const r = rnd(biome.length * 977 + 13);
  let defs = vignette;
  let far = '';
  let near = '';
  let gnd = '';
  if (biome === 'banlieue') {
    // Crépuscule orangé, barres d'immeubles éventrées, poteaux électriques
    defs += sky('sky', [[0, '#1d1e2a'], [0.55, '#5a3c34'], [0.92, '#c8743c'], [1, '#e39050']]) + ground('#3a3530', '#2a2622', '#141210');
    far += `<circle cx="540" cy="${HORIZON - 30}" r="70" fill="#ffb060" opacity=".22"/><circle cx="540" cy="${HORIZON - 28}" r="12" fill="#ffe2b0"/>`;
    far += `<g fill="#2b2528" opacity=".9">`;
    for (let i = 0; i < 9; i++) {
      const x = i * 80 - 20 + r() * 30;
      const h = 50 + r() * 70;
      const w = 50 + r() * 30;
      far += `<rect x="${x}" y="${HORIZON - h}" width="${w}" height="${h}"/>`;
      if (r() > 0.5) far += `<path d="M${x + w * 0.6} ${HORIZON - h} l${w * 0.2} ${-14} l${w * 0.2} 14z" fill="#2b2528"/>`;
      for (let wy = HORIZON - h + 8; wy < HORIZON - 10; wy += 12) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (r() > 0.82) far += `<rect x="${wx}" y="${wy}" width="5" height="6" fill="#f0a35a" opacity=".55"/>`;
    }
    far += `</g><g stroke="#1c1a1c" stroke-width="3"><path d="M120 ${HORIZON} V60 M150 ${HORIZON} V66 M100 66 H170"/><path d="M420 ${HORIZON} V70 M400 76 H450"/></g><path d="M100 70 Q260 92 420 76" stroke="#1c1a1c" stroke-width="1.2" fill="none"/>`;
    gnd += `<path d="M0 ${HORIZON + 6} H${W}" stroke="#d8a060" stroke-opacity=".4" stroke-width="1.5"/>` + perspective();
    near += fog('#e8b088').split('|')[1];
    defs += fog('#e8b088').split('|')[0];
  } else if (biome === 'industrie') {
    // Ciel de fumées jaunâtres, cheminées, silos, tour de refroidissement
    defs += sky('sky', [[0, '#23261f'], [0.6, '#56553e'], [1, '#9a8f5e']]) + ground('#3a3a34', '#2a2a26', '#121210');
    far += `<g fill="#2a2b26" opacity=".95"><path d="M60 ${HORIZON} Q70 90 56 50 H120 Q106 90 116 ${HORIZON}z"/>`;
    for (const x of [200, 230, 520, 600]) far += `<rect x="${x}" y="${HORIZON - 110 + r() * 30}" width="14" height="140"/><rect x="${x - 2}" y="${HORIZON - 116 + r() * 30}" width="18" height="6"/>`;
    far += `<rect x="300" y="${HORIZON - 70}" width="34" height="70" rx="16"/><rect x="340" y="${HORIZON - 80}" width="34" height="80" rx="16"/><rect x="380" y="${HORIZON - 60}" width="34" height="60" rx="16"/>`;
    far += `<rect x="430" y="${HORIZON - 40}" width="140" height="40"/><path d="M430 ${HORIZON - 40} l20 -14 h100 l20 14z"/></g>`;
    for (const x of [207, 237, 527, 607]) far += `<g fill="#8a8a7a" opacity=".22"><circle cx="${x + r() * 10}" cy="40" r="22"/><circle cx="${x + 20}" cy="26" r="18"/><circle cx="${x + 40}" cy="16" r="14"/></g>`;
    gnd += `<path d="M0 ${HORIZON + 4} H${W}" stroke="#c9b060" stroke-opacity=".35" stroke-width="2" stroke-dasharray="20 10"/>` + perspective(0.2);
    defs += fog('#b8b088', HORIZON - 40, 80, 0.25).split('|')[0];
    near += fog('#b8b088', HORIZON - 40, 80, 0.25).split('|')[1];
  } else if (biome === 'port') {
    // Crépuscule sur la mer, phare et son faisceau, grues et conteneurs dans la brume
    defs += sky('sky', [[0, '#1b2030'], [0.55, '#4a3a3e'], [0.9, '#c06a36'], [1, '#e08a44']]) + ground('#3a342d', '#29251f', '#151411');
    defs += `<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c3a3c"/><stop offset="1" stop-color="#1c2328"/></linearGradient><linearGradient id="beam" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#FFE7B0" stop-opacity=".45"/><stop offset="1" stop-color="#FFE7B0" stop-opacity="0"/></linearGradient>`;
    far += `<circle cx="570" cy="${HORIZON - 40}" r="80" fill="#ffb060" opacity=".25"/><circle cx="570" cy="${HORIZON - 38}" r="13" fill="#FFE9BF"/>`;
    far += `<rect y="${HORIZON - 30}" width="${W}" height="36" fill="url(#sea)"/><path d="M500 ${HORIZON - 24} h140 M520 ${HORIZON - 16} h100" stroke="#FFC98A" stroke-width="1.5" opacity=".5"/>`;
    far += `<g fill="#2a2628"><path d="M244 ${HORIZON - 28} L250 ${HORIZON - 100} H264 L270 ${HORIZON - 28}z"/><rect x="246" y="${HORIZON - 114}" width="22" height="14"/><path d="M244 ${HORIZON - 114} L257 ${HORIZON - 126} L270 ${HORIZON - 114}z"/><rect x="250" y="${HORIZON - 111}" width="14" height="7" fill="#FFE2A0"/></g><path d="M257 ${HORIZON - 108} L20 ${HORIZON - 160} L20 ${HORIZON - 100}z" fill="url(#beam)" opacity=".6"/>`;
    far += `<g fill="#34303a" opacity=".85"><path d="M56 ${HORIZON - 28} V60 h7 V${HORIZON - 28}z M96 ${HORIZON - 28} V60 h7 V${HORIZON - 28}z M30 60 H180 V68 H30z"/><path d="M56 104 L103 70 M56 72 L103 108" stroke="#34303a" stroke-width="3"/><rect x="360" y="${HORIZON - 64}" width="76" height="36"/><rect x="372" y="${HORIZON - 86}" width="56" height="22"/><rect x="630" y="${HORIZON - 76}" width="50" height="48"/></g>`;
    gnd += `<path d="M0 ${HORIZON + 6} H${W}" stroke="#e0a65a" stroke-opacity=".55" stroke-width="2"/><path d="M0 ${HORIZON + 12} H${W}" stroke="#c9a03a" stroke-width="3" stroke-dasharray="26 14" opacity=".45"/>` + perspective(0.22);
    defs += fog('#e8b088').split('|')[0];
    near += fog('#e8b088').split('|')[1];
  } else if (biome === 'foret') {
    // Matin brumeux, rangées de sapins de plus en plus nettes
    defs += sky('sky', [[0, '#2a3a36'], [0.6, '#6f8270'], [1, '#b7c2a6']]) + ground('#3a3a28', '#2a2c1e', '#12130c');
    const pines = (y, n, hmin, hmax, col, op) => {
      let s = `<g fill="${col}" opacity="${op}">`;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * W + r() * 30 - 15;
        const h = hmin + r() * (hmax - hmin);
        s += `<path d="M${x} ${y - h} L${x - h * 0.28} ${y} H${x + h * 0.28}z"/><rect x="${x - 2}" y="${y - 4}" width="4" height="8"/>`;
      }
      return s + '</g>';
    };
    far += pines(HORIZON - 10, 26, 40, 70, '#4a5a48', 0.6) + pines(HORIZON, 20, 60, 100, '#33402f', 0.85) + pines(HORIZON + 8, 12, 90, 140, '#1f2a1c', 1);
    gnd += `<g fill="#4a4a30" opacity=".5">${Array.from({ length: 30 }, () => `<ellipse cx="${r() * W}" cy="${HORIZON + 20 + r() * 120}" rx="${6 + r() * 14}" ry="2"/>`).join('')}</g>`;
    defs += fog('#d8e0c8', HORIZON - 50, 100, 0.35).split('|')[0];
    near += fog('#d8e0c8', HORIZON - 50, 100, 0.35).split('|')[1];
  } else {
    // Base aérienne de nuit : hangar éclairé, tour de contrôle, projecteur
    defs += sky('sky', [[0, '#070b14'], [1, '#1b2536']]) + ground('#262a30', '#1a1d21', '#0d0e10');
    defs += `<linearGradient id="spill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8A35C" stop-opacity=".4"/><stop offset="1" stop-color="#E8A35C" stop-opacity="0"/></linearGradient><linearGradient id="search" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#BFD8FF" stop-opacity=".35"/><stop offset="1" stop-color="#BFD8FF" stop-opacity="0"/></linearGradient>`;
    far += `<g fill="#fff" opacity=".6">${Array.from({ length: 40 }, () => `<circle cx="${r() * W}" cy="${r() * 90}" r="${r() * 1.2 + 0.3}"/>`).join('')}</g>`;
    far += `<path d="M470 ${HORIZON - 20} L600 0 L680 0 L520 ${HORIZON - 20}z" fill="url(#search)"/>`;
    far += `<g fill="#14181f"><path d="M300 ${HORIZON} V${HORIZON - 60} Q390 ${HORIZON - 110} 480 ${HORIZON - 60} V${HORIZON}z"/><rect x="80" y="${HORIZON - 100}" width="22" height="100"/><rect x="66" y="${HORIZON - 124}" width="50" height="26"/><rect x="70" y="${HORIZON - 120}" width="42" height="10" fill="#7fb0d8" opacity=".55"/></g>`;
    far += `<rect x="340" y="${HORIZON - 44}" width="100" height="44" fill="#E8A35C" opacity=".25"/><path d="M340 ${HORIZON} L300 ${H} H480 L440 ${HORIZON}z" fill="url(#spill)"/>`;
    gnd += `<path d="M0 ${HORIZON + 30} H${W}" stroke="#e8e0c0" stroke-opacity=".25" stroke-width="3" stroke-dasharray="40 30"/>` + perspective(0.25);
    for (const x of [40, 200, 520, 650]) gnd += `<circle cx="${x}" cy="${HORIZON + 8}" r="3" fill="#ffb060"/><circle cx="${x}" cy="${HORIZON + 8}" r="10" fill="#ffb060" opacity=".2"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}"><defs>${defs}${FIG_DEFS}</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>${far}
<rect y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#gnd)"/>${gnd}${near}
<rect width="${W}" height="${H}" fill="url(#vign)"/></svg>`;
  write(`bg/${biome}.svg`, svg);
  manifest.backgrounds.push(biome);
}
for (const b of ['banlieue', 'industrie', 'port', 'foret', 'base']) backdrop(b);

// Le manifeste est importé par le jeu (src/artManifest.json) : tailles, ancres et points utiles des images.
writeFileSync(join(ROOT, '..', '..', 'src', 'artManifest.json'), JSON.stringify(manifest, null, 1));
console.log(`${Object.keys(manifest.icons).length} icônes, ${Object.keys(manifest.figures).length} personnages, ${manifest.backgrounds.length} décors, ${Object.keys(manifest.covers).length} couverts`);
