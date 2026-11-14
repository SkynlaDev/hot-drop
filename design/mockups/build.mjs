// Générateur de la maquette HOT DROP : produit un HTML statique autonome (aucun JS à l'exécution).
import { writeFileSync } from 'node:fs';
import { figure, KINDS, flash, tracer, sparks, puff, explosion, casings, sandbags, jersey, container, drums, FIG_DEFS } from './figures.mjs';

const OUT = '/home/ndecrucq/Bureau/claude-workspace/hot-drop/design/mockups/index.html';

// ---------- Données (reprises du code du jeu) ----------
const RAR = [
  { n: 'Commun', c: '#9E9E9E', hi: '#C9C9C9' },
  { n: 'Peu commun', c: '#4CAF50', hi: '#7EDB82' },
  { n: 'Rare', c: '#2F80ED', hi: '#6FA8FF' },
  { n: 'Épique', c: '#9B51E0', hi: '#C390F5' },
  { n: 'Légendaire', c: '#F2C94C', hi: '#FFE38A' },
];
const FAM = {
  rafale: { n: 'Rafale', c: '#E8A33D', i: 'f-rafale', t2: '+15 % de cadence des armes Rafale', t4: '1 balle sur 8 ricoche sur un 2e ennemi' },
  precision: { n: 'Précision', c: '#4FC3F7', i: 'f-precision', t2: '+10 % de critique pour toutes les armes', t4: 'Critiques ×2,5 au lieu de ×2' },
  demolition: { n: 'Démolition', c: '#E5484D', i: 'f-demolition', t2: '+1 charge pour chaque explosif', t4: 'Explosions et pompe ignorent armure et Blindés' },
  rempart: { n: 'Rempart', c: '#9FB3C0', i: 'f-rempart', t2: "+20 % d'armure", t4: "L'armure se régénère de 2 par seconde" },
  tactique: { n: 'Tactique', c: '#9BBF3A', i: 'f-tactique', t2: 'Fumigène +50 % de durée', t4: '—' },
};
const THR = {
  blindes: { n: 'Blindés', c: '#9FB3C0', i: 't-blindes', e: 'Chaque balle subit −4 dégâts (min. 1)', k: 'Gros calibres, perforantes, explosifs' },
  tireurs: { n: "Tireurs d'élite", c: '#4FC3F7', i: 't-tireurs', e: 'Tirs lents mais très puissants, ils tirent en premier', k: 'Fumigène, armure élevée' },
  essaim: { n: 'Essaim', c: '#E8A33D', i: 't-essaim', e: '5 à 6 ennemis plus faibles', k: 'Explosifs, armes multi-cibles, Rafale' },
  medics: { n: 'Médics', c: '#5FBF6A', i: 't-medics', e: 'Toutes les 5 s, chaque ennemi récupère 12 PV', k: 'Dégâts concentrés : critiques, silencieux' },
  assaut: { n: 'Assaut', c: '#E5484D', i: 't-assaut', e: 'Dégâts ennemis +10 % toutes les 5 s', k: 'Gros DPS pour finir vite, soins' },
};
const PLACE = {
  contrat: { n: 'Contrat', i: 'p-contrat', d: 'Combat standard : chaque ennemi abattu lâche un objet' },
  elite: { n: 'Élite', i: 'p-elite', d: 'Combat difficile : butin Rare ou mieux' },
  marchand: { n: 'Marchand', i: 'p-marchand', d: 'Acheter, vendre, relancer la boutique' },
  caisse: { n: 'Caisse', i: 'p-caisse', d: 'Ravitaillement : 2 objets au hasard, sans combat' },
  planque: { n: 'Planque', i: 'p-planque', d: 'Repos : récupère 1 sursis' },
  exfil: { n: 'Exfiltration', i: 'p-exfil', d: 'Gardée par un lieutenant' },
};

// ---------- Icônes SVG (symboles) ----------
const S = 'stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  // Armes (48×24)
  pistol: ['0 0 48 24', '<path d="M6 6h32l2 2v3H21l-1.5 2.5h-3L14 21H8l2.6-10H6z"/><path d="M15.5 11v3.5h5" ' + S + ' stroke-width="1.6"/>'],
  smg: ['0 0 48 24', '<path d="M3 8h31V6h4v2h7v3H34v2h-8v8h-4.5v-8H17l-2.5 4.5H9L11 13H3z"/>'],
  rifle: ['0 0 48 24', '<path d="M1 9.5 9 7h22V5h3v2h13v2.5H34V12h-5l1.5 8.5h-4L24 12h-5l-1 5h-4l1-5H9L1 15z"/>'],
  shotgun: ['0 0 48 24', '<path d="M1 10l8-2.5h37V10H31v2.5H14L12 16H7.5l1-3.5L1 15z"/><rect x="21" y="13" width="9" height="3" rx="1"/>'],
  sniper: ['0 0 48 24', '<path d="M1 11l7-2h24v-.5h15V11H32v2.5H22l-1.5 5h-4l1-5H8l-7 5z"/><rect x="13" y="3.5" width="15" height="3.5" rx="1.6"/><rect x="17" y="6.5" width="2" height="2.5"/><rect x="23" y="6.5" width="2" height="2.5"/>'],
  // Objets (24×24)
  mag: ['0 0 24 24', '<path d="M9.5 4c0-2 1-3 2-3s2 1 2 3z"/><path d="M8 4.5h7v3l2.5 14h-7L8 7.5z"/><path d="M9.5 10h5.5M10 13.5h5.6" stroke="#000" stroke-opacity=".35" stroke-width="1.2"/>'],
  shells: ['0 0 24 24', '<rect x="2.5" y="6" width="5.5" height="15" rx="1.2"/><rect x="9.25" y="4" width="5.5" height="17" rx="1.2"/><rect x="16" y="6" width="5.5" height="15" rx="1.2"/><path d="M2.5 17.5h19" stroke="#000" stroke-opacity=".4" stroke-width="1.4"/>'],
  bullet: ['0 0 24 24', '<path d="M9.5 20V10c0-4 1.2-7 2.5-8.5 1.3 1.5 2.5 4.5 2.5 8.5v10z"/><rect x="8.5" y="19" width="7" height="3.5" rx=".8"/>'],
  bullets: ['0 0 24 24', '<path d="M4 20V10c0-4 1-7 2.5-8.5C8 3 9 6 9 10v10zM10 20V10c0-4 1-7 2.5-8.5C14 3 15 6 15 10v10zM16 20V10c0-4 1-7 2.5-8.5C20 3 21 6 21 10v10z"/><path d="M3 21h19" ' + S + ' stroke-width="2"/>'],
  scope: ['0 0 24 24', '<rect x="1.5" y="7.5" width="21" height="7.5" rx="3.6"/><rect x="6.5" y="15" width="3" height="3.5"/><rect x="14.5" y="15" width="3" height="3.5"/><circle cx="4.6" cy="11.2" r="2" fill="#000" fill-opacity=".4"/>'],
  grip: ['0 0 24 24', '<path d="M6 3h12v4h-2.5l-1.2 14H9.7L8.5 7H6z"/><path d="M10 11h4M10 14h4" stroke="#000" stroke-opacity=".35" stroke-width="1.2"/>'],
  bipod: ['0 0 24 24', '<rect x="4" y="3" width="16" height="4.5" rx="1.6"/><path d="M10 8 4 21M14 8l6 13" ' + S + ' stroke-width="2.6"/>'],
  holo: ['0 0 24 24', '<path d="M4 17V9l3-4h10l3 4v8z" ' + S + ' stroke-width="2.4"/><circle cx="12" cy="11.5" r="2.2"/><rect x="2.5" y="17.5" width="19" height="3.5" rx="1"/>'],
  silencer: ['0 0 24 24', '<rect x="1.5" y="8" width="21" height="8" rx="2.5"/><path d="M6 8v8M10 8v8M14 8v8" stroke="#000" stroke-opacity=".3" stroke-width="1.2"/>'],
  plate: ['0 0 24 24', '<path d="M5 2.5h14l1.5 4V15c0 3.2-4 6.2-8.5 7C7.5 21.2 3.5 18.2 3.5 15V6.5z"/><path d="M8 8h8M8 12h8" stroke="#000" stroke-opacity=".3" stroke-width="1.6"/>'],
  helmet: ['0 0 24 24', '<path d="M3 15.5C3 9.5 7 5 12 5s9 4.5 9 10.5v1.5H3z"/><rect x="1.5" y="16" width="21" height="3.2" rx="1.2"/><path d="M8 9.5h8" stroke="#000" stroke-opacity=".3" stroke-width="1.4"/>'],
  frag: ['0 0 24 24', '<circle cx="11" cy="14.5" r="7"/><rect x="8.5" y="4" width="5" height="4" rx="1"/><path d="M13.5 5.5 19 3" ' + S + ' stroke-width="2"/><path d="M6 14.5h10M11 9.5v10" stroke="#000" stroke-opacity=".3" stroke-width="1.3"/>'],
  smoke: ['0 0 24 24', '<rect x="7.5" y="8" width="9" height="14" rx="2"/><rect x="9.5" y="5" width="5" height="3"/><circle cx="6" cy="5" r="3" opacity=".55"/><circle cx="17.5" cy="4" r="2.6" opacity=".55"/><circle cx="12" cy="2.5" r="2" opacity=".45"/>'],
  flash: ['0 0 24 24', '<rect x="8" y="7.5" width="8" height="14" rx="2"/><rect x="10" y="4.5" width="4" height="3"/><path d="M2.5 8.5l3 1.2M21.5 8.5l-3 1.2M3 15h3M18 15h3" ' + S + ' stroke-width="2"/>'],
  medkit: ['0 0 24 24', '<rect x="2.5" y="6" width="19" height="14.5" rx="2.6"/><path d="M9 6V3.8h6V6" ' + S + ' stroke-width="2"/><path d="M10.5 9h3v3h3v3h-3v3h-3v-3h-3v-3h3z" fill="#000" fill-opacity=".45"/>'],
  syringe: ['0 0 24 24', '<g transform="rotate(45 12 12)"><rect x="9" y="6" width="6" height="10" rx="1"/><rect x="11.2" y="16" width="1.6" height="6.5"/><rect x="7.5" y="3.5" width="9" height="2.2" rx=".6"/><rect x="11" y=".5" width="2" height="3"/></g>'],
  // Menaces
  't-blindes': ['0 0 24 24', '<path d="M3 14C3 8 7 3.5 12 3.5S21 8 21 14v6H3z"/><rect x="5.5" y="11" width="13" height="3.5" rx="1" fill="#000" fill-opacity=".55"/>'],
  't-tireurs': ['0 0 24 24', '<circle cx="10" cy="14" r="6.5" ' + S + ' stroke-width="2.4"/><circle cx="10" cy="14" r="2"/><path d="M18 1.5l1.3 4 4 1.3-4 1.3-1.3 4-1.3-4-4-1.3 4-1.3z"/>'],
  't-essaim': ['0 0 24 24', '<circle cx="12" cy="6.5" r="3.2"/><path d="M6.5 15c0-3.2 2.4-5 5.5-5s5.5 1.8 5.5 5z"/><circle cx="5" cy="11" r="2.5"/><path d="M.8 19c0-2.6 1.7-3.8 4.2-3.8S9.2 16.4 9.2 19z"/><circle cx="19" cy="11" r="2.5"/><path d="M14.8 19c0-2.6 1.7-3.8 4.2-3.8s4.2 1.2 4.2 3.8z"/>'],
  't-medics': ['0 0 24 24', '<path d="M9 2.5h6v6.5h6.5v6H15v6.5H9V15H2.5V9H9z"/>'],
  't-assaut': ['0 0 24 24', '<path d="M2 21.5 12 14l10 7.5v-5L12 9 2 16.5z"/><path d="M2 13 12 5.5 22 13V8L12 .5 2 8z"/>'],
  // Familles
  'f-rafale': ['0 0 24 24', '<path d="M3 20V10.5c0-4 1-6.5 2.5-8C7 4 8 6.5 8 10.5V20zM9.5 20V10.5c0-4 1-6.5 2.5-8 1.5 1.5 2.5 4 2.5 8V20zM16 20V10.5c0-4 1-6.5 2.5-8 1.5 1.5 2.5 4 2.5 8V20z"/>'],
  'f-precision': ['0 0 24 24', '<circle cx="12" cy="12" r="7.5" ' + S + ' stroke-width="2.4"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6" ' + S + ' stroke-width="2.4"/><circle cx="12" cy="12" r="1.9"/>'],
  'f-demolition': ['0 0 24 24', '<path d="M12 1l2.4 6.2 5.8-3.3-2.3 6.6L23.5 13l-6.3 1.6 2 6.4-6-3.2L10.6 23l-1.4-6.4L2.8 18l3.4-5.6L.8 9.3l6.4-.6-1.7-6.3 5.7 3.4z"/>'],
  'f-rempart': ['0 0 24 24', '<path d="M12 1.5l8.5 3.2v6.6c0 5.3-3.6 9.4-8.5 11.2-4.9-1.8-8.5-5.9-8.5-11.2V4.7z"/><path d="M12 4.5v15" stroke="#000" stroke-opacity=".3" stroke-width="1.6"/>'],
  'f-tactique': ['0 0 24 24', '<circle cx="8" cy="14" r="5.5"/><circle cx="15.5" cy="11" r="6.5"/><circle cx="12" cy="17" r="4.5"/>'],
  // Lieux
  'p-contrat': ['0 0 24 24', '<path d="M3.5 18.5 17 5l2.2 2.2L5.7 20.7zM20.5 18.5 7 5 4.8 7.2l13.5 13.5z"/><circle cx="12" cy="12" r="2.2" fill="#000" fill-opacity=".5"/>'],
  'p-elite': ['0 0 24 24', '<path d="M12 1.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 13.9l-4.8 2.5.9-5.4L4.2 7.2l5.4-.8z"/><path d="M4 19.5l8-3.4 8 3.4V23l-8-3.4L4 23z"/>'],
  'p-marchand': ['0 0 24 24', '<path d="M12 1.8l8.8 5.1v10.2L12 22.2l-8.8-5.1V6.9z"/><path d="M15 9.2a3.8 3.8 0 1 0 0 5.6" ' + S + ' stroke="#000" stroke-opacity=".6" stroke-width="2.4"/>'],
  'p-caisse': ['0 0 24 24', '<path d="M3 9.5C3 4.5 7 2 12 2s9 2.5 9 7.5z"/><path d="M4.5 9.5l5 5.5M19.5 9.5l-5 5.5M12 9.5V15" ' + S + ' stroke-width="1.5"/><rect x="6.5" y="14.5" width="11" height="8" rx="1"/><path d="M6.5 18.5h11" stroke="#000" stroke-opacity=".4" stroke-width="1.4"/>'],
  'p-planque': ['0 0 24 24', '<path d="M12 2.5 1.5 21.5h21z"/><path d="M12 10.5 8 21.5h8z" fill="#000" fill-opacity=".5"/>'],
  'p-exfil': ['0 0 24 24', '<rect x="1" y="3" width="17" height="1.8" rx=".9"/><rect x="8.6" y="4.5" width="2" height="3"/><path d="M3.5 10.5c0-2 1.6-3.2 4-3.2h4.5c3.2 0 5.3 2 5.5 4.6h6v2.2h-6.4c-.6 1.4-1.8 2.2-3.6 2.2H7c-2.2 0-3.5-1.4-3.5-3.2z"/><path d="M6 19.5h11M8.5 16v3.5M14 16v3.5" ' + S + ' stroke-width="1.6"/>'],
  'p-boss': ['0 0 24 24', '<path d="M12 1.5c-5 0-8.5 3.6-8.5 8.3 0 2.7 1.2 4.6 3.2 5.8v3.9h10.6v-3.9c2-1.2 3.2-3.1 3.2-5.8 0-4.7-3.5-8.3-8.5-8.3z"/><circle cx="8.8" cy="10.3" r="2.1" fill="#000" fill-opacity=".65"/><circle cx="15.2" cy="10.3" r="2.1" fill="#000" fill-opacity=".65"/><path d="M9 19.5v3M12 19.5v3M15 19.5v3" ' + S + ' stroke-width="1.6"/>'],
  // Interface
  credit: ['0 0 24 24', '<path d="M12 1.5l9 5.2v10.6l-9 5.2-9-5.2V6.7z"/><path d="M15 9.2a3.8 3.8 0 1 0 0 5.6" ' + S + ' stroke="#000" stroke-opacity=".55" stroke-width="2.4"/>'],
  tag: ['0 0 24 24', '<rect x="5" y="2" width="14" height="20" rx="4"/><circle cx="12" cy="6" r="1.5" fill="#000" fill-opacity=".55"/><path d="M8.5 11h7M8.5 14h7M8.5 17h4" stroke="#000" stroke-opacity=".4" stroke-width="1.4"/>'],
  heart: ['0 0 24 24', '<path d="M12 21.3 3.8 13.4C1.2 10.8 1.4 6.7 4.3 4.8c2.4-1.6 5.5-1 7.7 1.4 2.2-2.4 5.3-3 7.7-1.4 2.9 1.9 3.1 6 .5 8.6z"/>'],
  bolt: ['0 0 24 24', '<path d="M13.5 1.5 4 13.5h6.5L9 22.5l10-12.5h-6.5z"/>'],
  link: ['0 0 24 24', '<path d="M9.5 14.5l5-5M8 11 5.5 13.5a3.5 3.5 0 0 0 5 5L13 16M16 13l2.5-2.5a3.5 3.5 0 0 0-5-5L11 8" ' + S + ' stroke-width="2.4"/>'],
  menu: ['0 0 24 24', '<path d="M4 6h16M4 12h16M4 18h16" ' + S + ' stroke-width="2.6"/>'],
  rotate: ['0 0 24 24', '<path d="M19 12a7 7 0 1 1-2.1-5" ' + S + ' stroke-width="2.4"/><path d="M19.5 2.5v5.5H14z"/>'],
  lock: ['0 0 24 24', '<rect x="4.5" y="10" width="15" height="11.5" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" ' + S + ' stroke-width="2.4"/>'],
  check: ['0 0 24 24', '<path d="M4 12.5l5 5L20 6.5" ' + S + ' stroke-width="3"/>'],
  play: ['0 0 24 24', '<path d="M6 3.5v17l14-8.5z"/>'],
  skip: ['0 0 24 24', '<path d="M3 4v16l10-8zM12 4v16l10-8z"/>'],
  chev: ['0 0 24 24', '<path d="M8 4l8 8-8 8" ' + S + ' stroke-width="3"/>'],
  gas: ['0 0 24 24', '<circle cx="12" cy="12" r="2.6"/><path d="M12 9.4a6.5 6.5 0 0 1-3.5-7.2 9 9 0 0 1 7 0A6.5 6.5 0 0 1 12 9.4zM9.8 13.3a6.5 6.5 0 0 1-6.7 4.3 9 9 0 0 1-3.5-6 6.5 6.5 0 0 1 10.2 1.7zM14.2 13.3a6.5 6.5 0 0 1 6.7 4.3 9 9 0 0 0 3.5-6 6.5 6.5 0 0 0-10.2 1.7z" transform="translate(0 1)"/>'],
  clock: ['0 0 24 24', '<circle cx="12" cy="12" r="9" ' + S + ' stroke-width="2.4"/><path d="M12 7v5l3.5 2.5" ' + S + ' stroke-width="2.4"/>'],
  reroll: ['0 0 24 24', '<path d="M19.5 9A8 8 0 0 0 5 7.5M4.5 15A8 8 0 0 0 19 16.5" ' + S + ' stroke-width="2.4"/><path d="M4 2.5v6h6zM20 21.5v-6h-6z"/>'],
  expand: ['0 0 24 24', '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" opacity=".55"/><path d="M17.5 13.5v8M13.5 17.5h8" ' + S + ' stroke-width="2.6"/>'],
  close: ['0 0 24 24', '<path d="M5 5l14 14M19 5 5 19" ' + S + ' stroke-width="3"/>'],
  sell: ['0 0 24 24', '<path d="M2.5 12.5 12 3h9v9l-9.5 9.5z"/><circle cx="16.5" cy="7.5" r="1.8" fill="#000" fill-opacity=".55"/>'],
  hand: ['0 0 24 24', '<path d="M9 11V4.5a1.8 1.8 0 0 1 3.6 0V10l5.2.9c1.6.3 2.6 1.8 2.3 3.4l-1.2 5.7a2.4 2.4 0 0 1-2.3 1.9h-6a2.6 2.6 0 0 1-2-.9L4.2 15.6a1.6 1.6 0 0 1 2.3-2.2L9 15z"/>'],
  warn: ['0 0 24 24', '<path d="M12 2 23 21.5H1z"/><path d="M12 9v6M12 17.5v.5" stroke="#000" stroke-opacity=".7" stroke-width="2.6" stroke-linecap="round"/>'],
  compass: ['0 0 24 24', '<path d="M12 1.5l4 10.5h-8z"/><path d="M12 22.5 8 12h8z" opacity=".35"/>'],
};
const sym = Object.entries(ICONS).map(([k, [vb, body]]) => `<symbol id="i-${k}" viewBox="${vb}">${body}</symbol>`).join('');
const ic = (k, size = 16, cls = '', style = '') => {
  const vb = ICONS[k][0].split(' ');
  const w = (+vb[2] / +vb[3]) * size;
  return `<svg class="ic ${cls}" width="${w}" height="${size}" style="${style}" aria-hidden="true"><use href="#i-${k}"/></svg>`;
};

// ---------- Composants ----------
const famChip = (f, extra = '') => `<span class="chip fam" style="--c:${FAM[f].c}">${ic(FAM[f].i, 12)}${FAM[f].n}${extra}</span>`;
const thrBadge = (t, small = false) => `<span class="thr${small ? ' sm' : ''}" style="--c:${THR[t].c}"><span class="ti">${ic(THR[t].i, small ? 10 : 11)}</span>${small ? '' : `<b>${THR[t].n}</b>`}</span>`;
const rarChip = (r) => `<span class="chip rar" style="--c:${RAR[r].c}">${RAR[r].n}</span>`;
const credits = (n) => `<span class="cr">${ic('credit', 14)}<b>${n}</b></span>`;
const sursis = (n) => `<span class="sursis" title="Sursis">${[0, 1, 2].map((i) => ic('tag', 14, i < n ? 'on' : 'off')).join('')}</span>`;

function rot(mask, k) {
  let m = mask.map((r) => [...r].map((c) => c === 'X'));
  for (let i = 0; i < k; i++) {
    const h = m.length, w = m[0].length;
    m = Array.from({ length: w }, (_, r) => Array.from({ length: h }, (__, c) => m[h - 1 - c][r]));
  }
  return m;
}

/** Pièce d'objet : forme exacte en SVG, bordure = rareté, coin = famille, icône. */
function piece(it, C = 40, extra = {}) {
  const m = rot(it.mask, it.rot || 0);
  const h = m.length, w = m[0].length;
  const cells = [];
  m.forEach((row, y) => row.forEach((v, x) => v && cells.push([x, y])));
  const has = (x, y) => y >= 0 && y < h && x >= 0 && x < w && m[y][x];
  const r = RAR[it.r];
  const ins = 2;
  let fill = '';
  let edges = '';
  let seams = '';
  for (const [x, y] of cells) {
    const x0 = x * C, y0 = y * C, x1 = x0 + C, y1 = y0 + C;
    const l = has(x - 1, y) ? x0 : x0 + ins, t = has(x, y - 1) ? y0 : y0 + ins;
    const rr = has(x + 1, y) ? x1 : x1 - ins, b = has(x, y + 1) ? y1 : y1 - ins;
    fill += `M${l} ${t}H${rr}V${b}H${l}Z`;
    if (!has(x, y - 1)) edges += `M${x0 + ins} ${y0 + ins}H${x1 - ins}`;
    if (!has(x, y + 1)) edges += `M${x0 + ins} ${y1 - ins}H${x1 - ins}`;
    if (!has(x - 1, y)) edges += `M${x0 + ins} ${y0 + ins}V${y1 - ins}`;
    if (!has(x + 1, y)) edges += `M${x1 - ins} ${y0 + ins}V${y1 - ins}`;
    if (has(x + 1, y)) seams += `M${x1} ${y0 + 6}V${y1 - 6}`;
    if (has(x, y + 1)) seams += `M${x0 + 6} ${y1}H${x1 - 6}`;
  }
  // Position de l'icône
  let ix, iy, iw, ih;
  const isWeapon = ['rifle', 'smg', 'pistol', 'shotgun', 'sniper'].includes(it.icon);
  if (isWeapon) {
    let best = 0, by = 0;
    m.forEach((row, y) => { const n = row.filter(Boolean).length; if (n > best) { best = n; by = y; } });
    const xs = m[by].map((v, x) => (v ? x : -1)).filter((x) => x >= 0);
    const span = (xs[xs.length - 1] - xs[0] + 1) * C;
    iw = Math.min(span - 8, 2 * (C - 6) * 1.6);
    ih = iw / 2;
    if (ih > C - 8) { ih = C - 8; iw = ih * 2; }
    ix = xs[0] * C + (span - iw) / 2;
    iy = by * C + (C - ih) / 2 - 2;
  } else {
    const cx = cells.reduce((a, c) => a + c[0], 0) / cells.length;
    const cy = cells.reduce((a, c) => a + c[1], 0) / cells.length;
    let gx = Math.round(cx), gy = Math.round(cy);
    if (!has(gx, gy)) { gx = cells[0][0]; gy = cells[0][1]; }
    const cxx = has(Math.floor(cx), Math.floor(cy)) && cells.length === 4 ? (cx + 0.5) * C : (gx + 0.5) * C;
    const cyy = has(Math.floor(cx), Math.floor(cy)) && cells.length === 4 ? (cy + 0.5) * C : (gy + 0.5) * C;
    const s = cells.length >= 4 ? C * 0.95 : cells.length === 1 ? C * 0.5 : C * 0.62;
    iw = ih = s;
    ix = cxx - s / 2;
    iy = cyy - s / 2 - (it.label ? (cells.length === 1 ? 6 : 3) : 0);
  }
  const [fx, fy] = cells[0];
  const famc = FAM[it.fam].c;
  const glow = it.r >= 3 ? `filter:drop-shadow(0 0 6px ${r.c}aa)` : '';
  const label = it.label ? `<text x="${fx * C + 5}" y="${(h - 1) * C + C - 5}" class="plabel">${it.label}</text>` : '';
  // étiquette : sous la première case de la dernière ligne occupée
  let lab = '';
  if (it.label) {
    const ly = h - 1;
    const lx = m[ly].findIndex(Boolean);
    lab = `<text x="${lx * C + 5}" y="${ly * C + C - 5}" class="plabel">${it.label}</text>`;
  }
  const cal = it.cal ? `<g transform="translate(${(w * C) - 4},${4 + ins})"><rect x="-${it.cal.length * 5 + 6}" y="0" width="${it.cal.length * 5 + 6}" height="12" rx="3" fill="${it.unfed ? '#5a1d1f' : '#1f3b22'}" stroke="${it.unfed ? '#E5484D' : '#5FBF6A'}" stroke-width="1"/><text x="-${(it.cal.length * 5 + 6) / 2}" y="9.2" class="pcal" fill="${it.unfed ? '#FF9EA0' : '#9BE3A2'}">${it.cal}</text></g>` : '';
  void label;
  return `<svg class="piece${extra.cls ? ' ' + extra.cls : ''}" width="${w * C}" height="${h * C}" style="left:${it.x * C}px;top:${it.y * C}px;${glow};${extra.style || ''}">
<path d="${fill}" fill="url(#rg${it.r})"/>
<path d="${fill}" fill="url(#sheen)"/>
<path d="${seams}" stroke="#000" stroke-opacity=".28" stroke-width="1" stroke-dasharray="2 3"/>
<path d="${edges}" stroke="${r.c}" stroke-width="2.2" stroke-linecap="square" fill="none"/>
<path d="M${fx * C + ins} ${fy * C + ins}h11l-11 11z" fill="${famc}"/>
<use href="#i-${it.icon}" x="${ix}" y="${iy}" width="${iw}" height="${ih}" class="picon"/>
${lab}${cal}
</svg>`;
}

// ---------- Gilet ----------
const UNLOCKED = new Set();
for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) UNLOCKED.add(`${x},${y}`);
['0,2', '0,3', '0,4', '3,6', '4,6', '5,6'].forEach((k) => UNLOCKED.add(k));
const zoneOf = (x, y) => (x >= 2 && x <= 4 && y >= 1 && y <= 3 ? 'poi' : x === 0 || x === 6 ? 'fla' : y === 6 ? 'cei' : '');

const VEST = [
  { icon: 'rifle', label: 'KR-4', mask: ['XXXX', '.X..'], x: 1, y: 1, r: 2, fam: 'rafale', cal: '5.56' },
  { icon: 'mag', label: '5.56', mask: ['X'], x: 5, y: 1, r: 1, fam: 'rafale' },
  { icon: 'scope', label: '×4', mask: ['XX'], x: 3, y: 2, r: 2, fam: 'precision' },
  { icon: 'grip', label: 'Poignée', mask: ['XX'], x: 0, y: 2, r: 0, fam: 'rafale' },
  { icon: 'smg', label: 'Guêpe', mask: ['XX', '.X'], x: 1, y: 3, r: 0, fam: 'rafale', cal: '9mm', unfed: true },
  { icon: 'plate', label: 'Plaque', mask: ['XX', 'XX'], x: 3, y: 3, r: 3, fam: 'rempart' },
  { icon: 'syringe', label: 'Adré.', mask: ['X'], x: 0, y: 4, r: 1, fam: 'rempart' },
  { icon: 'frag', label: 'Frag', mask: ['X'], x: 3, y: 6, r: 0, fam: 'demolition' },
  { icon: 'smoke', label: 'Fumi', mask: ['X', 'X'], rot: 1, x: 4, y: 6, r: 1, fam: 'tactique' },
];
const LINKS = [
  { x: 5, y: 1, v: true, c: '#FFC46B' }, // KR-4 ↔ chargeur
  { x: 3.5, y: 2, v: false, c: '#7FD8FF' }, // KR-4 ↔ lunette
  { x: 1.5, y: 2, v: false, c: '#FFC46B' }, // KR-4 ↔ poignée
];

function vestGrid({ C = 40, mode = 'prep', drag = false, dim = false } = {}) {
  let cells = '';
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const k = `${x},${y}`;
    const z = zoneOf(x, y);
    const open = UNLOCKED.has(k);
    cells += `<div class="cell ${open ? 'open' : 'locked'} ${z}" style="left:${x * C}px;top:${y * C}px">${open ? '' : ic('lock', 10)}</div>`;
  }
  const pieces = VEST.map((it) => piece(it, C, { cls: mode === 'combat' && it.icon === 'rifle' ? 'firing' : '' })).join('');
  const links = LINKS.map((l) => l.v
    ? `<i class="link v" style="left:${l.x * C - 3}px;top:${l.y * C + C / 2 - 9}px;--c:${l.c}"></i>`
    : `<i class="link h" style="left:${l.x * C + C / 2 - 9 - C / 2 + C / 2}px;top:${l.y * C - 3}px;--c:${l.c}"></i>`).join('');
  // zones
  const zoneFrames = `
    <div class="zframe poi" style="left:${2 * C}px;top:${1 * C}px;width:${3 * C}px;height:${3 * C}px"></div>
    <div class="ztab poi" style="left:${2 * C}px;top:${C - 17}px;width:${3 * C + 28}px">${ic('f-rempart', 10)} POITRINE · ARMURE +25 %</div>`;
  let overlay = '';
  if (mode === 'prep') {
    overlay += `<div class="rech" style="left:${1 * C + 2}px;top:${3 * C - 9}px">RECH ×2</div>`;
    if (drag) {
      overlay += `<div class="drop-ok" style="left:${1 * C}px;top:${4 * C}px;width:${C}px;height:${C}px"></div>`;
      overlay += piece({ icon: 'mag', label: '9mm', mask: ['X'], x: 1, y: 4, r: 0, fam: 'rafale' }, C, { cls: 'dragging' });
      overlay += `<div class="hint" style="left:${4}px;top:${5 * C + 4}px">${ic('link', 12)} Alimente <b>Guêpe</b> · RECH ×2 retiré</div>`;
      overlay += `<div class="finger" style="left:${1 * C + 22}px;top:${4 * C + 18}px">${ic('hand', 26)}</div>`;
    }
  } else {
    // combat : recharges et charges
    overlay += `<div class="cd" style="left:${1 * C + 4}px;top:${1 * C + 4}px;--p:72%"></div>`;
    overlay += `<div class="reload" style="left:${1 * C + 4}px;top:${3 * C + 30}px;width:${2 * C - 8}px"><i style="width:38%"></i><span>RECH ×2</span></div>`;
    overlay += `<div class="charges" style="left:${3 * C + 26}px;top:${6 * C + 2}px">2</div>`;
    overlay += `<div class="charges used" style="left:${5 * C + 26}px;top:${6 * C + 2}px">1</div>`;
    overlay += `<div class="pulse" style="left:${3 * C}px;top:${6 * C}px;width:${C}px;height:${C}px"></div>`;
  }
  return `<div class="vest${dim ? ' dim' : ''}" style="width:${7 * C}px;height:${7 * C}px">${cells}${zoneFrames}${pieces}${links}${overlay}</div>`;
}

const topBar = (left, right) => `<div class="topbar"><div class="tb-l">${left}</div><div class="cam"></div><div class="tb-r">${right}</div></div>`;

function statsStrip() {
  const fams = [['rafale', 4], ['rempart', 2], ['precision', 1], ['demolition', 1]];
  return `<div class="stats">
    <div class="stat"><span class="k">${ic('heart', 11)} PV / ${ic('f-rempart', 11)} ARM</span><span class="v">100<small>/</small><em class="arm">90</em></span></div>
    <div class="stat"><span class="k">${ic('bolt', 11)} DPS EST.</span><span class="v">31</span></div>
    <div class="stat warn"><span class="k">${ic('mag', 11)} ALIMENTÉES</span><span class="v">1<small>/2</small></span></div>
    <div class="stat"><span class="k">${ic('link', 11)} SYNERGIES</span><span class="v">3</span></div>
  </div>
  <div class="famrow">${fams.map(([f, n]) => `<div class="fp${n >= 2 ? ' act' : ''}" style="--c:${FAM[f].c}">${ic(FAM[f].i, 12)}<span class="pips">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? 'on' : ''}${i === 2 || i === 4 ? ' tier' : ''}"></i>`).join('')}</span><b>${n >= 4 ? 'P4' : n >= 2 ? 'P2' : n + '/2'}</b></div>`).join('')}</div>`;
}

function enemyIntel() {
  const en = [['Tireur', 72, 0, '17 dgt', true], ['Tireur', 72, 0, '17 dgt', true], ['Milicien', 78, 0, '6 dgt', false]];
  return `<div class="intel">
    <div class="intel-h"><span class="lbl">ESCOUADE ENNEMIE · PHARE</span>${thrBadge('tireurs')}</div>
    <div class="intel-b">
      ${en.map(([n, hp, a, d, op]) => `<div class="foe">${soldier('#C9504F', true, 26)}<div><b>${n}</b>${op ? '<em>TIRE EN 1ER</em>' : ''}<span>PV ${hp} · ${d}</span></div></div>`).join('')}
    </div>
    <div class="intel-f">${ic('t-tireurs', 11)} Tirs lents et puissants. <b>Contre :</b> fumigène, armure élevée</div>
  </div>`;
}

function soldier(color = '#D9D2B8', flip = false, h = 60) {
  return `<svg class="sold" viewBox="0 0 60 80" width="${h * 0.75}" height="${h}" style="color:${color};${flip ? 'transform:scaleX(-1)' : ''}"><g fill="currentColor">
  <path d="M21 9c0-5 4.5-8.5 10-8.5s9.5 3.5 9.5 8.5v2.5H20z"/><circle cx="31" cy="14" r="5.8"/>
  <rect x="13" y="22" width="7" height="16" rx="2"/><path d="M19 20.5h20l3 22H17z"/>
  <path d="M19 42.5h9.5l-1.5 35h-8.5zM31.5 42.5H41l3 35h-8.5z"/>
  <path d="M31 25h12l2 5H33z"/><path d="M29 26.5h31v4H46v4h-4l1 7h-4.2l-1-7H30z"/></g>
  <path d="M21 31h18" stroke="#000" stroke-opacity=".35" stroke-width="2"/></svg>`;
}

function reserve(items, { dragFrom = -1, dim = false } = {}) {
  const slots = Array.from({ length: 6 }, (_, i) => items[i]);
  return `<div class="tray${dim ? ' dim' : ''}">
    <div class="sell">${ic('sell', 18)}<b>VENDRE</b><span>50 %</span></div>
    <div class="res">
      <div class="res-h"><b>RÉSERVE ${items.filter(Boolean).length}/6</b><span>n'agit pas en combat</span></div>
      <div class="slots">${slots.map((it, i) => `<div class="slot${i === dragFrom ? ' from' : ''}">${it && i !== dragFrom ? `<div class="mini" style="--rc:${RAR[it.r].c}">${ic(it.icon, it.wide ? 18 : 24)}<i style="background:${FAM[it.fam].c}"></i></div>` : ''}</div>`).join('')}</div>
    </div>
  </div>`;
}
const RES = [{ icon: 'mag', r: 0, fam: 'rafale' }, { icon: 'helmet', r: 0, fam: 'rempart' }, { icon: 'flash', r: 1, fam: 'demolition' }];

const hudLeft = (txt) => `<button class="iconbtn">${ic('menu', 16)}</button><div class="where">${txt}</div>`;
const hudRight = (s = 3, c = 14) => `${sursis(s)}${credits(c)}`;

// ---------- Écrans ----------
function scrMenu() {
  return `<div class="scr menu">
    <div class="menu-bg">${mapArt(360, 640, 'menu')}</div>
    <div class="menu-shade"></div>
    ${topBar('<button class="iconbtn">' + ic('menu', 16) + '</button>', `<span class="ver">v0.6 · proto</span>`)}
    <div class="logo">
      <div class="logo-k">RÉGION DE VESTRA</div>
      <h1>HOT<br>DROP</h1>
      <div class="logo-s">Range ton gilet. Chaque case compte.</div>
    </div>
    <div class="op-card">
      <div class="op-av">${soldier('#E6DFC6', false, 46)}</div>
      <div class="op-t"><b>VIPER</b><span>Opérateur PMC · contrat Vestra</span>
        <div class="run-line">${ic('p-exfil', 12)} Run en cours · <b>Zone 2/3 · Port</b></div>
        <div class="run-line dim">Tour 4/7 · ${sursis(2)} · ${credits(23)}</div></div>
    </div>
    <div class="menu-btns">
      <button class="btn primary xl">${ic('play', 18)}CONTINUER</button>
      <button class="btn secondary">NOUVELLE RUN</button>
    </div>
    <div class="gestures">
      <span>${ic('hand', 13)}<b>Glisser</b> placer</span><span>${ic('rotate', 13)}<b>Tap</b> tourner</span><span>${ic('clock', 13)}<b>Appui long</b> fiche</span>
    </div>
  </div>`;
}

function biomeThumb(id, w = 70, h = 104) {
  const P = {
    banlieue: { g: '#1f211b', t: ['#2a2a22', '#25261f', '#2e2c24', '#232820'], wa: '#22343a', b: '#5a5648' },
    port: { g: '#1b2022', t: ['#232a2c', '#262b28', '#1f2729', '#2a2d29'], wa: '#1d3442', b: '#55615f' },
    industrie: { g: '#1d1e1c', t: ['#2b2a26', '#262624', '#302c25', '#23241f'], wa: '#26323a', b: '#6a5f4c' },
  }[id];
  let s = mulberry(id.length * 97);
  let out = `<rect width="${w}" height="${h}" fill="${P.g}"/>`;
  for (let i = 0; i < 12; i++) out += `<ellipse cx="${s() * w}" cy="${s() * h}" rx="${10 + s() * 22}" ry="${6 + s() * 14}" fill="${P.t[i % 4]}"/>`;
  if (id === 'port') out += `<path d="M0 0H30C24 30 36 60 22 ${h}H0z" fill="${P.wa}"/><path d="M22 30h22M26 52h26M20 78h24" stroke="#4d5a5a" stroke-width="4"/>`;
  else out += `<path d="M0 ${h * 0.7}C${w * 0.3} ${h * 0.6} ${w * 0.6} ${h * 0.75} ${w} ${h * 0.55}" stroke="${P.wa}" stroke-width="6" fill="none"/>`;
  out += `<path d="M0 ${h * 0.35}H${w}M${w * 0.55} 0V${h}" stroke="#3b3f36" stroke-width="2.5"/>`;
  for (let i = 0; i < 16; i++) out += `<rect x="${s() * w}" y="${s() * h}" width="${3 + s() * 7}" height="${3 + s() * 6}" fill="${P.b}" opacity=".8"/>`;
  out += `<rect width="${w}" height="${h}" fill="url(#vign)"/>`;
  return `<svg width="${w}" height="${h}" class="thumb">${out}</svg>`;
}

function scrBriefing() {
  const cards = [
    { id: 'port', name: 'Port', thr: ['tireurs', 'assaut'], fam: ['rafale', 'precision'], g: 'Lieutenant', gt: 'tireurs', sel: true },
    { id: 'banlieue', name: 'Banlieue en ruine', thr: ['essaim', 'medics'], fam: ['rempart', 'rafale'], g: 'Lieutenant', gt: 'essaim' },
    { id: 'industrie', name: 'Zone industrielle', thr: ['blindes', 'tireurs'], fam: ['demolition', 'precision'], g: 'Lieutenant', gt: 'blindes' },
  ];
  return `<div class="scr brief">
    ${topBar(hudLeft('<b>BRIEFING</b>'), hudRight(3, 10))}
    <div class="prog">
      <div class="pg now"><i>1</i><span>Largage</span></div><div class="pl"></div>
      <div class="pg"><i>2</i><span>À venir</span></div><div class="pl"></div>
      <div class="pg boss"><i>${ic('p-boss', 13)}</i><span>Cdt Kesh</span></div>
    </div>
    <div class="h1">Choisis ta zone de largage</div>
    <div class="sub">L'ordre fixe la difficulté : la 1re zone est la plus calme.</div>
    <div class="bcards">${cards.map((c) => `
      <div class="bcard${c.sel ? ' sel' : ''}">
        ${biomeThumb(c.id)}
        <div class="bc-b">
          <div class="bc-t">${c.name.toUpperCase()}${c.sel ? `<span class="selmark">${ic('check', 11)}</span>` : ''}</div>
          <div class="bc-r"><span class="k">MENACES</span>${c.thr.map((t) => thrBadge(t)).join('')}</div>
          <div class="bc-r"><span class="k">BUTIN</span>${c.fam.map((f) => famChip(f)).join('')}</div>
          <div class="bc-r ex"><span class="k">EXFIL</span>${ic('p-exfil', 13, 'exf')}<b>${c.g}</b>${thrBadge(c.gt, true)}</div>
        </div>
      </div>`).join('')}
    </div>
    <div class="bottom"><button class="btn primary xl">LARGUER · PORT ${ic('chev', 16)}</button></div>
  </div>`;
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- Carte de zone (Port) ----------
const POIS = [
  { n: 'Douanes', x: 104, y: 300, t: 'contrat', f: 'rafale', th: ['assaut'], st: 'visited' },
  { n: 'Criée', x: 150, y: 248, t: 'contrat', f: 'rempart', th: [], st: 'here' },
  { n: 'Phare', x: 76, y: 168, t: 'contrat', f: 'precision', th: ['tireurs'], st: 'sel' },
  { n: 'Cuves', x: 214, y: 288, t: 'elite', f: 'demolition', th: ['blindes', 'assaut'], st: 'reach' },
  { n: 'Capitainerie', x: 136, y: 180, t: 'marchand', st: 'reach' },
  { n: 'Dépôt munitions', x: 214, y: 222, t: 'caisse', f: 'rafale', st: 'reach' },
  { n: 'Infirmerie', x: 92, y: 232, t: 'planque', st: 'reach' },
  { n: 'Grues', x: 180, y: 128, t: 'contrat', f: 'precision', th: ['tireurs'] },
  { n: 'Docks', x: 108, y: 112, t: 'contrat', f: 'rafale', th: ['essaim'] },
  { n: 'Terminal', x: 258, y: 118, t: 'elite', f: 'rafale', th: ['assaut'] },
  { n: 'Conserverie', x: 300, y: 214, t: 'contrat', f: 'rempart', th: ['medics'] },
  { n: 'Chantier naval', x: 272, y: 270, t: 'caisse', f: 'demolition' },
  { n: 'Cale sèche', x: 300, y: 322, t: 'contrat', f: 'demolition', th: ['blindes'] },
  { n: 'Gare maritime', x: 172, y: 62, t: 'contrat', f: 'rempart', th: ['medics'] },
  { n: 'Silo à grain', x: 300, y: 72, t: 'contrat', f: 'precision' },
  { n: 'Caserne', x: 322, y: 158, t: 'contrat', f: 'rafale', th: ['assaut'] },
  { n: 'Hangar', x: 214, y: 344, t: 'marchand' },
  { n: 'Jetée', x: 46, y: 300, t: 'contrat', f: 'rafale', st: 'gas' },
  { n: 'Ponton', x: 40, y: 352, t: 'caisse', f: 'rempart', st: 'gas' },
  { n: 'Marina', x: 58, y: 56, t: 'contrat', f: 'rempart', th: ['essaim'], st: 'gas' },
];
const GAS = { x: 218, y: 172, r: 150, nr: 100 };
const EXFIL = { x: 226, y: 151 };
const EDGES = [[0, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [0, 6], [0, 17], [17, 18], [2, 4], [2, 8], [4, 7], [4, 8], [8, 19], [8, 13], [7, 13], [7, 9], [9, 14], [9, 15], [15, 10], [5, 10], [5, 3], [3, 11], [11, 12], [3, 16], [11, 10], [7, 5], [13, 14], [0, 16]];

function mapArt(W, H, kind) {
  const s = mulberry(7);
  let o = `<rect width="${W}" height="${H}" fill="#1b2022"/>`;
  for (let i = 0; i < 70; i++) o += `<ellipse cx="${s() * W}" cy="${s() * H}" rx="${12 + s() * 40}" ry="${8 + s() * 26}" fill="${['#232a2c', '#262b28', '#1f2729', '#2a2d29'][i % 4]}" opacity=".9"/>`;
  // mer
  o += `<path d="M0 0H70C50 60 40 110 30 150C22 190 12 230 24 270C34 310 20 360 0 ${H}z" fill="#183041"/>`;
  o += `<path d="M0 0H70C50 60 40 110 30 150C22 190 12 230 24 270C34 310 20 360 0 ${H}" stroke="#2f5468" stroke-width="2" fill="none" opacity=".8"/>`;
  for (let i = 0; i < 18; i++) { const y = s() * H; o += `<path d="M${2 + s() * 18} ${y}q4 -3 8 0t8 0" stroke="#2a4b5e" stroke-width="1" fill="none"/>`; }
  // jetées
  o += `<path d="M30 160H66M24 300H52M14 352h28M40 96h30" stroke="#4a5656" stroke-width="5"/>`;
  // bâtiments
  for (let i = 0; i < 160; i++) { const x = 40 + s() * (W - 40), y = s() * H; o += `<rect x="${x}" y="${y}" width="${3 + s() * 9}" height="${3 + s() * 7}" fill="#56605c" opacity="${0.35 + s() * 0.4}"/>`; }
  // quadrillage tactique
  for (let x = 0; x <= W; x += 45) o += `<path d="M${x} 0V${H}" stroke="#ffffff" stroke-opacity=".045"/>`;
  for (let y = 0; y <= H; y += 45) o += `<path d="M0 ${y}H${W}" stroke="#ffffff" stroke-opacity=".045"/>`;
  if (kind === 'menu') return `<svg width="${W}" height="${H}">${o}</svg>`;
  return o;
}

function poiMarker(p, i) {
  const fam = p.f ? FAM[p.f].c : '#D9D2B8';
  const st = p.st || 'far';
  const big = st === 'sel';
  const r = big ? 14 : st === 'reach' || st === 'here' ? 12 : 10;
  const inGas = st === 'gas';
  const op = st === 'far' ? 0.62 : inGas ? 0.45 : 1;
  let g = `<g transform="translate(${p.x} ${p.y})" opacity="${op}">`;
  if (big) g += `<circle r="${r + 9}" fill="#FF8C1A" opacity=".18"/><circle r="${r + 5}" fill="none" stroke="#FF8C1A" stroke-width="2"/>`;
  else if (st === 'reach') g += `<circle r="${r + 5}" fill="none" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  const fillC = st === 'visited' || st === 'here' ? '#2a2d27' : '#12150f';
  if (p.t === 'elite') g += `<path d="M0 ${-r - 2}L${r + 1} ${-r / 2}V${r / 2}L0 ${r + 2}L${-r - 1} ${r / 2}V${-r / 2}z" fill="${fillC}" stroke="${fam}" stroke-width="2.6"/>`;
  else g += `<circle r="${r}" fill="${fillC}" stroke="${p.t === 'marchand' || p.t === 'planque' ? '#E9D8A6' : fam}" stroke-width="${p.f ? 2.8 : 1.8}"/>`;
  const icC = st === 'visited' ? '#8a8c7c' : p.t === 'marchand' ? '#E9D8A6' : p.t === 'planque' ? '#9BE3A2' : '#ECE8D8';
  g += `<use href="#i-${st === 'visited' ? 'check' : PLACE[p.t].i}" x="${-r * 0.62}" y="${-r * 0.62}" width="${r * 1.24}" height="${r * 1.24}" style="color:${icC}"/>`;
  (p.th || []).forEach((t, k) => {
    const bx = r * 0.8 + k * 11, by = -r * 0.9;
    g += `<g transform="translate(${bx} ${by})"><circle r="6" fill="#140f0f" stroke="${THR[t].c}" stroke-width="1.4"/><use href="#i-${THR[t].i}" x="-4" y="-4" width="8" height="8" style="color:${THR[t].c}"/></g>`;
  });
  const lc = st === 'sel' ? 'sel' : st === 'reach' ? 'reach' : st === 'here' ? 'here' : '';
  g += `<text y="${r + 12}" class="mlabel ${lc}">${p.n.toUpperCase()}</text>`;
  if (inGas) g += `<circle r="${r}" fill="#9BE33B" opacity=".25"/>`;
  return g + '</g>';
}

POIS.forEach((p) => { p.y = Math.round(p.y * 0.88); });
function zoneMap() {
  const W = 360, H = 340;
  let o = mapArt(W, H, 'map');
  // routes
  EDGES.forEach(([a, b]) => { const A = POIS[a], B = POIS[b]; o += `<path d="M${A.x} ${A.y}L${B.x} ${B.y}" stroke="#3d4440" stroke-width="3.2"/><path d="M${A.x} ${A.y}L${B.x} ${B.y}" stroke="#596258" stroke-width="1" stroke-dasharray="4 4"/>`; });
  o += `<path d="M${POIS[0].x} ${POIS[0].y}L${POIS[1].x} ${POIS[1].y}" stroke="#B7B29C" stroke-width="2.5" stroke-dasharray="1 5" stroke-linecap="round"/>`;
  [2, 3, 4, 5, 6].forEach((i) => { const A = POIS[1], B = POIS[i]; o += `<path d="M${A.x} ${A.y}L${B.x} ${B.y}" stroke="${i === 2 ? '#FF8C1A' : '#E8E2CC'}" stroke-opacity="${i === 2 ? 1 : 0.55}" stroke-width="${i === 2 ? 3 : 1.8}" stroke-dasharray="6 4"/>`; });
  // gaz
  o += `<path d="M0 0H${W}V${H}H0Z M${GAS.x - GAS.r} ${GAS.y}a${GAS.r} ${GAS.r} 0 1 0 ${GAS.r * 2} 0a${GAS.r} ${GAS.r} 0 1 0 ${-GAS.r * 2} 0Z" fill-rule="evenodd" fill="#7BD62E" fill-opacity=".2"/>`;
  o += `<path d="M0 0H${W}V${H}H0Z M${GAS.x - GAS.r} ${GAS.y}a${GAS.r} ${GAS.r} 0 1 0 ${GAS.r * 2} 0a${GAS.r} ${GAS.r} 0 1 0 ${-GAS.r * 2} 0Z" fill-rule="evenodd" fill="url(#hatch)"/>`;
  o += `<circle cx="${GAS.x}" cy="${GAS.y}" r="${GAS.r}" fill="none" stroke="#B4FF5A" stroke-width="7" stroke-opacity=".18"/><circle cx="${GAS.x}" cy="${GAS.y}" r="${GAS.r}" fill="none" stroke="#9BE33B" stroke-width="2"/>`;
  o += `<circle cx="${GAS.x}" cy="${GAS.y}" r="${GAS.nr}" fill="none" stroke="#FFFFFF" stroke-opacity=".85" stroke-width="1.6" stroke-dasharray="7 5"/>`;
  
  // exfil
  o += `<g transform="translate(${EXFIL.x} ${EXFIL.y})"><circle r="20" fill="#9BE33B" opacity=".12"/><circle r="14" fill="#10140c" stroke="#E9F5D0" stroke-width="2.2"/><use href="#i-p-exfil" x="-9" y="-9" width="18" height="18" style="color:#E9F5D0"/><g transform="translate(13 -12)"><circle r="6.5" fill="#140f0f" stroke="#4FC3F7" stroke-width="1.4"/><use href="#i-t-tireurs" x="-4.2" y="-4.2" width="8.4" height="8.4" style="color:#4FC3F7"/></g><text y="27" class="mlabel exf">EXFIL · TOUR 7</text></g>`;
  POIS.forEach((p, i) => { o += poiMarker(p, i); });
  // joueur
  const me = POIS[1];
  o += `<g transform="translate(${me.x - 16} ${me.y})"><path d="M4 0-6-6v12z" fill="#FF8C1A"/><rect x="-32" y="-7" width="27" height="14" rx="3" fill="#FF8C1A"/><text x="-18.5" y="3.3" class="mlabel me">TOI</text></g>`;
  // boussole
  o += `<g transform="translate(${W - 20} 22)"><circle r="12" fill="#0e110c" fill-opacity=".8" stroke="#565c4c"/><use href="#i-compass" x="-8" y="-9" width="16" height="16" style="color:#FF8C1A"/><text y="-14" class="mlabel">N</text></g>`;
  o += `<g transform="translate(14 ${H - 14})"><path d="M0 0h45" stroke="#ECE8D8" stroke-width="2"/><path d="M0 -4v8M45 -4v8" stroke="#ECE8D8" stroke-width="1.5"/><text x="52" y="3.5" class="mlabel left">500 m</text></g>`;
  return `<svg class="zmap" width="${W}" height="${H}">${o}</svg>`;
}

function scrMap() {
  return `<div class="scr map">
    ${topBar(hudLeft('<b>PORT</b><span>Zone 1/3</span>'), hudRight(3, 14))}
    <div class="turns">
      <span class="tl">TOUR 3/7</span>
      <div class="tpips">${[1, 2, 3, 4, 5, 6, 7].map((i) => `<i class="${i < 3 ? 'done' : i === 3 ? 'now' : ''}${i === 7 ? ' ex' : ''}">${i === 7 ? ic('p-exfil', 11) : ''}</i>`).join('')}</div>
      <span class="gasn"><i class="dash"></i>zone sûre T4</span>
    </div>
    <div class="mapwrap">${zoneMap()}
      <div class="legend"><span>${ic('p-contrat', 10)}Contrat</span><span>${ic('p-elite', 10)}Élite</span><span>${ic('p-caisse', 10)}Caisse</span><span>${ic('p-marchand', 10)}Marchand</span><span>${ic('p-planque', 10)}Planque</span></div>
    </div>
    <div class="sheet">
      <div class="grab"></div>
      <div class="sh-h">
        <div class="ptype" style="--c:${FAM.precision.c}">${ic('p-contrat', 20)}</div>
        <div><div class="sh-t">PHARE</div><div class="sh-s">Contrat · 2 à 3 ennemis</div></div>
        <span class="chip ok">À PORTÉE</span>
      </div>
      <div class="gaswarn">${ic('gas', 13)} Hors de la prochaine zone sûre : gaz au tour 4</div>
      <div class="sh-cols">
        <div class="col"><span class="k">BUTIN</span>${famChip('precision')}<span class="d">60 % du butin dans cette famille</span></div>
        <div class="col"><span class="k">MENACE</span>${thrBadge('tireurs')}<span class="d"><b>Contre :</b> fumigène, armure</span></div>
      </div>
      <button class="btn primary xl">ALLER · PHARE ${ic('chev', 16)}</button>
    </div>
  </div>`;
}

function vestScreen({ mode = 'prep', drag = false, overlay = '', dimAll = false, scene = 'phare' } = {}) {
  const prep = mode === 'prep';
  return `<div class="scr vestscr${dimAll ? ' under' : ''}">
    ${topBar(hudLeft(scene === 'kesh' ? '<b>EXFIL</b><span>Z3 · Tour 7/7</span>' : '<b>PHARE</b><span>Z1 · Tour 3/7</span>'), hudRight(scene === 'kesh' ? 1 : 3, scene === 'kesh' ? 31 : 14))}
    ${prep ? `<div class="band intelband">${enemyIntel()}</div>${statsStrip()}` : combatBand(scene)}
    <div class="gridwrap${prep ? '' : ' combat'}">
      <div class="zlabel l">FLANC · RECH. −10 %</div>
      ${vestGrid({ mode, drag })}
      <div class="zlabel r">FLANC · RECH. −10 %</div>
      <div class="zlabel b">${ic('frag', 10)} CEINTURE · DÉLAI −15 %</div>
    </div>
    ${prep ? reserve(RES, { dragFrom: drag ? 0 : -1 }) : (scene === 'kesh' ? `<div class="log"><div><b class="r">Cdt Kesh</b> → Viper <b class="r">−26</b> (pompe, Assaut +20 %)</div><div><b class="o">KR-4</b> → Cdt Kesh <b class="b">armure −9</b> · reste 22</div></div>` : `<div class="log"><div><b class="o">KR-4</b> → Milicien <b class="y">51 CRIT</b></div><div><b class="o">Frag</b> → Tireur <b class="y">−20</b> · <b class="r">ÉTOURDI</b></div></div>`)}
    <div class="bottom">${prep ? `<button class="btn primary xl go">${ic('play', 16)}<span>PRÊT · LANCER LE COMBAT</span></button>` : `<button class="btn disabled xl">${ic('clock', 15)} COMBAT EN COURS…</button>`}</div>
    ${overlay}
  </div>`;
}

// --- Bandeau de combat : scène mise en scène (remplace l'ancienne version à figurines) ---
function foeBar(f, p, extra = '') {
  const arm = f.armMax ? `<div class="fb2 arm"><i style="width:${(f.arm / f.armMax) * 100}%"></i></div>` : '';
  return `<div class="foetag${f.dead ? ' dead' : ''}" style="left:${Math.round(p[0])}px;top:${Math.round(p[1])}px">
    <div class="ft-n">${f.n}${f.st ? `<em>${f.st}</em>` : ''}</div>
    <div class="fb2 hp"><i style="width:${(f.hp / f.max) * 100}%"></i></div>${arm}${extra}</div>`;
}

function scenePhare() {
  let bg = `<defs><linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2030"/><stop offset=".55" stop-color="#4a3a3e"/><stop offset=".9" stop-color="#c06a36"/><stop offset="1" stop-color="#e08a44"/></linearGradient>
    <linearGradient id="seaA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c3a3c"/><stop offset="1" stop-color="#1c2328"/></linearGradient>
    <linearGradient id="quayA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a342d"/><stop offset=".35" stop-color="#29251f"/><stop offset="1" stop-color="#151411"/></linearGradient>
    <radialGradient id="sunA" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE2A8"/><stop offset=".25" stop-color="#FFB060" stop-opacity=".7"/><stop offset="1" stop-color="#FF8C1A" stop-opacity="0"/></radialGradient>
    <linearGradient id="beamA" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#FFE7B0" stop-opacity=".45"/><stop offset="1" stop-color="#FFE7B0" stop-opacity="0"/></linearGradient>
    <linearGradient id="fogA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8b088" stop-opacity="0"/><stop offset=".5" stop-color="#e8b088" stop-opacity=".16"/><stop offset="1" stop-color="#e8b088" stop-opacity="0"/></linearGradient></defs>`;
  bg += `<rect width="360" height="196" fill="url(#skyA)"/>`;
  bg += `<circle cx="300" cy="94" r="46" fill="url(#sunA)"/><circle cx="300" cy="95" r="7" fill="#FFE9BF"/>`;
  bg += `<rect y="96" width="360" height="18" fill="url(#seaA)"/><path d="M262 99 h76 M272 103 h56 M284 107 h30" stroke="#FFC98A" stroke-width="1" opacity=".55"/>`;
  // phare lointain (lieu du combat) et son faisceau
  bg += `<g filter="url(#haze)" opacity=".85"><path d="M128 98 L132 62 H140 L144 98 Z" fill="#2a2628"/><rect x="129.5" y="55" width="13" height="8" fill="#2a2628"/><path d="M128 55 L136 49 L144 55 Z" fill="#2a2628"/><rect x="132" y="56.5" width="8" height="4" fill="#FFE2A0"/>
    <path d="M110 98 Q136 90 160 98 Z" fill="#232022"/></g><path d="M136 58 L20 34 L20 62 Z" fill="url(#beamA)" opacity=".55"/>`;
  // grue portuaire et piles de conteneurs, voilées par la brume
  bg += `<g fill="#34303a" opacity=".8" filter="url(#haze)"><path d="M30 98 V36 h4 V98 Z M52 98 V36 h4 V98 Z"/><path d="M14 36 H96 V41 H14 Z"/><path d="M30 60 L56 40 M30 44 L56 64" stroke="#34303a" stroke-width="1.6"/><rect x="62" y="41" width="8" height="10"/>
    <rect x="190" y="78" width="40" height="20"/><rect x="196" y="66" width="30" height="12"/><rect x="336" y="72" width="24" height="26"/></g>`;
  bg += `<rect y="84" width="360" height="40" fill="url(#fogA)"/>`;
  // quai : béton, ligne jaune, joints en perspective, flaque
  bg += `<path d="M0 113 H360 V196 H0 Z" fill="url(#quayA)"/><path d="M0 113 H360" stroke="#e0a65a" stroke-width="1.2" opacity=".55"/><path d="M0 116 H360" stroke="#c9a03a" stroke-width="2" stroke-dasharray="14 8" opacity=".45"/>`;
  for (let i = -6; i <= 12; i++) bg += `<path d="M${180 + i * 22} 116 L${180 + i * 62} 196" stroke="#000" stroke-opacity=".22" stroke-width="1"/>`;
  bg += `<path d="M0 150 H360" stroke="#000" stroke-opacity=".2"/><ellipse cx="150" cy="170" rx="34" ry="3.6" fill="#e9a46a" opacity=".18"/><ellipse cx="278" cy="182" rx="22" ry="2.6" fill="#e9a46a" opacity=".14"/>`;
  bg += `<g fill="#1a1816"><rect x="104" y="108" width="6" height="7" rx="2"/><rect x="246" y="108" width="6" height="7" rx="2"/></g>`;

  // plan intermédiaire : conteneur avec tireur couché, tireur abattu au pied
  let mid = container(222, 142, 92, 38, '#2f4a4f');
  const tir1 = figure('tir', 'prone', 262, 102, 0.74, { flip: true });
  const tir2 = figure('tir', 'stand', 342, 172, 0.6, { flip: true, dim: true });
  mid += tir1.svg;
  // milicien debout derrière un muret
  const mil = figure('mil', 'stand', 206, 150, 0.86, { flip: true });
  mid += mil.svg + jersey(166, 152, 48, 27, '#7a766c');
  mid += tir2.svg;
  // premier plan : opérateur à genou derrière des sacs de sable
  const op = figure('op', 'kneel', 52, 162, 1.0);
  let front = op.svg + sandbags(80, 164, 4, 4, '#6d644d');
  // effets
  let fx = '';
  fx += tracer(op.muzzle, [mil.chest[0] + 1, mil.chest[1] - 2], '#FFE7A8', 1.8, 0.62);
  fx += tracer(op.muzzle, [mil.chest[0] + 8, mil.chest[1] - 12], '#FFE7A8', 1.1, 0.35);
  fx += flash(op.muzzle, 1.05, 1);
  fx += sparks([mil.chest[0] + 1, mil.chest[1] - 2], '#FFE7A8', 8);
  fx += tracer(mil.muzzle, [112, 134], '#FF8A5C', 1.4, 0.5) + flash(mil.muzzle, 0.75, -1);
  fx += puff([112, 134], 4.5, '#b7ad98') + sparks([112, 134], '#d9cdb0', 5);
  fx += casings([op.muzzle[0] - 34, op.muzzle[1]]);
  fx += explosion([tir1.head[0] + 6, tir1.head[1] - 2], 0.9);
  // premier plan flou (profondeur de champ)
  const dof = `<g filter="url(#dof)"><path d="M330 196 Q342 182 360 180 V196 Z" fill="#0d0c0b"/><rect x="-6" y="176" width="40" height="24" rx="6" fill="#100f0d"/><circle cx="340" cy="186" r="12" fill="#14120f"/></g>`;
  const vign = `<rect width="360" height="196" fill="url(#vign)"/>`;
  const tags = [
    foeBar({ n: 'Tireur', hp: 31, max: 72, st: 'ÉTOURDI' }, [tir1.head[0] - 4, tir1.head[1] - 34]),
    foeBar({ n: 'Milicien', hp: 24, max: 78 }, [mil.head[0] - 26, mil.head[1] - 22]),
  ].join('');
  const nums = `
    <div class="dmg crit" style="left:${Math.round(mil.head[0] - 52)}px;top:${Math.round(mil.head[1] - 14)}px">51<small>CRIT</small></div>
    <div class="dmg" style="left:${Math.round(tir1.head[0] + 34)}px;top:${Math.round(tir1.head[1] - 22)}px">−20</div>
    <div class="dmg hurt" style="left:22px;top:58px">−17</div>
    <div class="dmg miss" style="left:118px;top:104px">raté</div>
    <div class="grenade-l" style="left:${Math.round(tir1.head[0] - 6)}px;top:${Math.round(tir1.head[1] + 6)}px">FRAG</div>`;
  return { svg: `${bg}${mid}${front}${fx}${dof}${vign}`, html: tags + nums, alive: '2/3' };
}

function sceneKesh() {
  let bg = `<defs><linearGradient id="skyB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070b14"/><stop offset="1" stop-color="#1b2536"/></linearGradient>
    <linearGradient id="tarB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262a30"/><stop offset="1" stop-color="#101215"/></linearGradient>
    <linearGradient id="spillB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8A35C" stop-opacity=".35"/><stop offset="1" stop-color="#E8A35C" stop-opacity="0"/></linearGradient>
    <linearGradient id="coneB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D8E8FF" stop-opacity=".28"/><stop offset="1" stop-color="#D8E8FF" stop-opacity="0"/></linearGradient>
    <radialGradient id="lampB" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#cfe2ff" stop-opacity=".6"/><stop offset="1" stop-color="#cfe2ff" stop-opacity="0"/></radialGradient></defs>`;
  bg += `<rect width="360" height="196" fill="url(#skyB)"/>`;
  for (let i = 0; i < 18; i++) bg += `<circle cx="${(i * 97) % 360}" cy="${(i * 37) % 60 + 4}" r=".6" fill="#fff" opacity=".5"/>`;
  bg += `<g filter="url(#haze)"><path d="M8 112 V64 Q100 30 196 64 V112 Z" fill="#161b24"/><path d="M8 64 Q100 30 196 64" stroke="#2a3344" stroke-width="1.4" fill="none"/>
    <rect x="70" y="72" width="64" height="40" fill="#2a2016"/><rect x="74" y="74" width="56" height="38" fill="#E8A35C" opacity=".55"/><rect x="100" y="74" width="30" height="38" fill="#1a1f28"/>
    <text x="22" y="86" font-family="Arial Narrow, sans-serif" font-weight="700" font-size="9" fill="#ffffff" opacity=".18" letter-spacing="2">HANGAR 3</text></g>`;
  bg += `<path d="M300 112 V30 M296 112 L300 30 L304 112" stroke="#1d2330" stroke-width="2.2"/><rect x="290" y="24" width="20" height="8" fill="#1d2330"/><circle cx="300" cy="30" r="16" fill="url(#lampB)"/><path d="M294 32 L232 196 H336 L306 32 Z" fill="url(#coneB)"/>`;
  bg += `<path d="M0 112 H360 V196 H0 Z" fill="url(#tarB)"/><path d="M70 112 L30 196 H180 L134 112 Z" fill="url(#spillB)"/>`;
  bg += `<path d="M200 112 Q160 150 40 196" stroke="#E8C24A" stroke-width="2.4" fill="none" opacity=".55"/><path d="M0 132 H360 M0 160 H360" stroke="#000" stroke-opacity=".25"/>`;
  bg += `<ellipse cx="282" cy="184" rx="40" ry="3" fill="#cfe2ff" opacity=".12"/>`;
  let mid = drums(178, 150, 2, '#5a2f22');
  const mil = figure('mil', 'stand', 214, 146, 0.68, { flip: true, rim: 'rimC' });
  mid = mil.svg + mid;
  const kesh = figure('kesh', 'stand', 282, 170, 0.8, { flip: true, rim: 'rimC' });
  mid += kesh.svg;
  const op = figure('op', 'kneel', 58, 170, 0.84, { rim: 'rimC' });
  let front = op.svg + jersey(80, 172, 50, 32, '#6e6d68');
  let fx = '';
  // décharge du fusil à pompe : gerbe de plombs
  const km = kesh.muzzle;
  [[-4, 0.5], [0, 0.6], [5, 0.45], [9, 0.4], [-8, 0.35]].forEach(([dy, f]) => { fx += tracer(km, [124, 136 + dy], '#FFB070', 1.1, f); });
  fx += flash(km, 1.5, -1) + puff([126, 138], 5, '#9a978f') + sparks([126, 137], '#ffd9a0', 7);
  // tirs de l'opérateur qui ricochent sur l'armure
  fx += tracer(op.muzzle, [kesh.chest[0] + 2, kesh.chest[1] - 4], '#FFE7A8', 1.8, 0.6) + flash(op.muzzle, 1.05, 1);
  fx += sparks([kesh.chest[0] + 2, kesh.chest[1] - 4], '#BFD8FF', 9);
  const dof = `<g filter="url(#dof)"><rect x="318" y="164" width="50" height="40" rx="4" fill="#0b0d10"/><path d="M0 196 V178 Q30 170 52 196 Z" fill="#0b0d10"/></g>`;
  const vign = `<rect width="360" height="196" fill="url(#vign)"/>`;
  const tags = foeBar({ n: 'Milicien', hp: 60, max: 78 }, [mil.head[0] - 52, mil.head[1] + 4]);
  const boss = `<div class="bossbar"><div class="bb-h">${ic('p-boss', 12)}<b>CDT KESH</b><span class="thr sm" style="--c:#E5484D"><span class="ti">${ic('t-assaut', 10)}</span></span><em>Assaut +20 %</em></div>
    <div class="bb-hp"><i style="width:71%"></i><span>198/280</span></div><div class="bb-ar"><i style="width:55%"></i><span>${ic('f-rempart', 7)} 22/40</span></div></div>`;
  const nums = `
    <div class="dmg armor" style="left:${Math.round(kesh.chest[0] + 14)}px;top:${Math.round(kesh.chest[1] - 22)}px">${ic('f-rempart', 12)}−9</div>
    <div class="dmg armor sm" style="left:${Math.round(kesh.chest[0] + 22)}px;top:${Math.round(kesh.chest[1] + 2)}px">${ic('f-rempart', 9)}−9</div>
    <div class="dmg hurt big" style="left:30px;top:76px">−26</div>`;
  return { svg: `${bg}${mid}${front}${fx}${dof}${vign}`, html: tags + boss + nums, alive: 'BOSS' };
}

function combatBand(variant = 'phare') {
  const sc = variant === 'kesh' ? sceneKesh() : scenePhare();
  return `<div class="band combatband${variant === 'kesh' ? ' boss' : ''}">
    <div class="cb-scene">
      <svg width="360" height="196" class="cb-bg">${sc.svg}</svg>
      <div class="cb-top">
        <span class="timer">${ic('clock', 12)} ${variant === 'kesh' ? '0:21' : '0:12'}</span>
        <div class="speed"><b>×1</b><b class="on">×2</b><b>×4</b></div>
        <button class="skip">PASSER ${ic('skip', 11)}</button>
      </div>
      ${sc.html}
    </div>
    <div class="cb-hud">
      <div class="who">${ic('heart', 12)}<b>VIPER</b></div>
      <div class="bars"><div class="bar hp"><i style="width:${variant === 'kesh' ? 54 : 83}%"></i><span>${variant === 'kesh' ? 54 : 83}/100</span></div><div class="bar ar"><i style="width:${variant === 'kesh' ? 20 : 48}%"></i><span>${variant === 'kesh' ? 18 : 43}/90</span></div></div>
      <div class="vs">${sc.alive}</div>
    </div>
  </div>`;
}

function bestiary() {
  const list = [['op', 'stand'], ['mil', 'stand'], ['mitr', 'stand'], ['tir', 'prone'], ['lt', 'stand'], ['kesh', 'stand']];
  return `<div class="bcell full"><h4>Bestiaire · silhouettes de combat (proportions ≈ 8 têtes, lecture par la forme avant la couleur)</h4><div class="best-row">${list.map(([k, pose]) => {
    const f = figure(k, pose, pose === 'prone' ? 112 : 70, 128, pose === 'prone' ? 1.25 : 1.1);
    return `<div class="bst"><svg width="${pose === 'prone' ? 200 : 150}" height="140"><rect width="100%" height="140" fill="url(#bstbg)"/><path d="M0 129 H200" stroke="#3a4231"/>${f.svg}</svg><b>${KINDS[k].name}</b><em>${KINDS[k].role}</em><span>${KINDS[k].cue}</span></div>`;
  }).join('')}</div><p class="note">Le brassard rouge et les barres rouges marquent le camp ennemi ; le type se lit à la silhouette : cagoule et AK (Milicien), masse et mitrailleuse à la hanche (Mitrailleur), couché sous capuche (Tireur), antenne radio (Lieutenant), blindage et visière rouge (Cdt Kesh).</p></div>`;
}

function lootOverlay() {
  const loot = [
    { icon: 'sniper', n: 'DMR Faucon', r: 2, fam: 'precision', wide: true },
    { icon: 'holo', n: 'Viseur holo', r: 1, fam: 'precision' },
    { icon: 'bullet', n: 'Balles .44', r: 0, fam: 'precision' },
  ];
  return `<div class="ov loot">
    <div class="rays"></div>
    <div class="banner win"><span class="bk">CONTRAT · PHARE</span><h2>VICTOIRE</h2><span class="bs">${ic('clock', 12)} 18 s · 3 ennemis neutralisés</span></div>
    <div class="rewards">
      <div class="cr-gain">${ic('credit', 22)}<b>+6</b><span>crédits</span></div>
      <div class="sur">${ic('tag', 14)} Sursis ${sursis(3)} intacts</div>
    </div>
    <div class="lootrow">${loot.map((l, i) => `<div class="lcard r${l.r}" style="--rc:${RAR[l.r].c};--rh:${RAR[l.r].hi};animation-delay:${i * 0.1}s">
      <div class="lc-top">${rarChip(l.r)}</div>
      <div class="lc-ic">${ic(l.icon, l.wide ? 30 : 40)}</div>
      <div class="lc-n">${l.n}</div>${famChip(l.fam)}</div>`).join('')}</div>
    <div class="fly">${ic('chev', 12)} ${ic('chev', 12)} vers la réserve</div>
    <svg class="trail" width="360" height="640"><path d="M60 360C40 450 120 470 140 520" stroke="#4F9BFF" stroke-width="2" fill="none" stroke-dasharray="3 5" opacity=".8"/><path d="M180 360C180 450 190 480 186 520" stroke="#5FD068" stroke-width="2" fill="none" stroke-dasharray="3 5" opacity=".8"/><path d="M300 360C320 450 260 480 232 520" stroke="#B4B4B4" stroke-width="2" fill="none" stroke-dasharray="3 5" opacity=".8"/></svg>
    <div class="ov-btns"><button class="btn primary xl">RANGER LE BUTIN ${ic('chev', 16)}</button><div class="famhint">${ic('f-precision', 12)} Précision 1 → <b>3</b> si tu les poses : palier 2 débloqué</div></div>
  </div>`;
}

function shopOverlay() {
  const offers = [
    { icon: 'sniper', n: 'DMR Faucon', r: 1, fam: 'precision', mask: ['XXXX', '..X.'], st: 'Dgt 31 · 1,5 s · 7.62', p: 15, wide: true, poor: true },
    { icon: 'mag', n: 'Chargeur 9 mm', r: 0, fam: 'rafale', mask: ['X'], st: 'Alimente Guêpe', p: 2, tip: true },
    { icon: 'bipod', n: 'Bipied', r: 2, fam: 'precision', mask: ['XX'], st: '+45 % dégâts arme longue', p: 13 },
    { icon: 'helmet', n: 'Casque balistique', r: 1, fam: 'rempart', mask: ['.X.', 'XXX'], st: 'Armure +17', p: 6, sold: true },
  ];
  const miniShape = (mask) => `<div class="mshape" style="grid-template-columns:repeat(${mask[0].length},8px)">${mask.join('').split('').map((c) => `<i class="${c === 'X' ? 'on' : ''}"></i>`).join('')}</div>`;
  return `<div class="ov shop">
    <div class="modal">
      <div class="mh"><div class="mh-ic">${ic('p-marchand', 20)}</div><div><h3>MARCHAND</h3><span>Capitainerie · prix neutres</span></div><div class="mh-cr">${credits(14)}</div><button class="iconbtn x">${ic('close', 14)}</button></div>
      <div class="offers">${offers.map((o) => `<div class="offer${o.sold ? ' sold' : ''}${o.poor ? ' poor' : ''}" style="--rc:${RAR[o.r].c}">
        <div class="of-top">${rarChip(o.r)}${miniShape(o.mask)}</div>
        <div class="of-ic">${ic(o.icon, o.wide ? 26 : 34)}</div>
        <div class="of-n">${o.n}</div>
        <div class="of-s">${famChip(o.fam)}</div>
        <div class="of-d">${o.tip ? ic('link', 10) + ' ' : ''}${o.st}</div>
        <button class="price">${o.sold ? 'VENDU' : `${ic('credit', 12)} ${o.p}`}</button>
        ${o.sold ? '<div class="stamp">VENDU</div>' : ''}
      </div>`).join('')}</div>
      <div class="shop-acts">
        <button class="btn secondary">${ic('reroll', 15)} RELANCER <span class="cost">${ic('credit', 11)} 2</span></button>
        <button class="btn secondary ext">${ic('expand', 15)} GILET +3 CASES <span class="cost">${ic('credit', 11)} 6</span></button>
      </div>
      <button class="btn ghost">FERMER</button>
    </div>
  </div>`;
}

function scrEnd(win = true) {
  const tiles = win
    ? [['Zones', '3/3'], ['Lieux visités', '18'], ['Ennemis abattus', '41'], ['Sursis restants', '1'], ['Crédits', '23'], ['Durée', '26 min']]
    : [['Zones', '1/3'], ['Tour', '5/7'], ['Lieux visités', '11'], ['Ennemis abattus', '24'], ['Crédits', '9'], ['Durée', '17 min']];
  const line = win ? `${ic('check', 11)} Port · ${ic('check', 11)} Banlieue en ruine · ${ic('check', 11)} Zone industrielle` : `${ic('p-boss', 11)} <b>Base aérienne · Cuves</b> · abattu par un Lieutenant ${thrBadge('assaut', true)}`;
  const rows = win
    ? [['Zones', '3/3', `${ic('check', 10)} Port · ${ic('check', 10)} Banlieue · ${ic('check', 10)} Industrie`], ['Lieux visités', '18', ''], ['Ennemis neutralisés', '41', ''], ['Sursis restants', '1', ''], ['Crédits restants', '23', ''], ['Durée', '26 min', '']]
    : [['Zones', '1/3', 'Port terminé'], ['Tombé à', 'Base aérienne', 'Tour 5/7 · Cuves'], ['Abattu par', 'Lieutenant', 'Assaut'], ['Lieux visités', '11', ''], ['Durée', '17 min', '']];
  return `<div class="scr end ${win ? 'win' : 'lose'}">
    ${topBar('', '')}
    <div class="end-art">${win ? `<svg width="360" height="210"><defs><radialGradient id="sun" cx=".5" cy=".9" r=".7"><stop offset="0" stop-color="#FFB347" stop-opacity=".55"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient></defs><rect width="360" height="210" fill="url(#sun)"/><path d="M0 170C80 150 160 165 240 150S330 158 360 150V210H0z" fill="#12140f"/><g transform="translate(150 70) scale(4.2)" style="color:#0b0c09"><use href="#i-p-exfil" width="24" height="24"/></g><path d="M196 140l-30 50h60z" fill="#9BE33B" opacity=".09"/><circle cx="196" cy="180" r="6" fill="#9BE33B"/><circle cx="196" cy="180" r="16" fill="none" stroke="#9BE33B" stroke-opacity=".5"/></svg>`
      : `<svg width="360" height="210"><rect width="360" height="210" fill="url(#redglow)"/><g transform="translate(140 76) scale(3.2)" style="color:#2a1414"><use href="#i-tag" width="24" height="24"/></g><path d="M0 175C90 160 200 172 360 158V210H0z" fill="#120f0e"/></svg>`}</div>
    <div class="end-t"><span class="ek">${win ? 'CDT KESH NEUTRALISÉ' : 'PLUS AUCUN SURSIS'}</span><h2>${win ? 'EXTRACTION<br>RÉUSSIE' : 'OPÉRATEUR<br>TOMBÉ'}</h2></div>
    <div class="recap">${tiles.map(([k, v]) => `<div class="tile"><span class="v">${v}</span><span class="k">${k}</span></div>`).join('')}</div>
    <div class="recap-l">${line}</div>
    ${win ? `<div class="best"><span class="k">MEILLEUR OBJET</span><div class="bi" style="--rc:${RAR[4].c}">${ic('sniper', 22)}</div><div><b>Fusil de précision Aigle</b><span>${rarChip(4)} ${famChip('precision')}</span></div></div>` : `<div class="best lose"><span class="k">CONSEIL</span><div><b>Les armes non alimentées tirent 2× moins.</b><span>Colle un chargeur du bon calibre à chaque arme.</span></div></div>`}
    <div class="bottom two"><button class="btn primary xl">NOUVELLE RUN</button><button class="btn secondary">MENU</button></div>
  </div>`;
}

// ---------- Planche de style ----------
function styleBoard() {
  const sw = (hex, n, dark) => `<div class="sw"><i style="background:${hex}${dark ? ';outline:1px solid #3a4231' : ''}"></i><b>${n}</b><code>${hex}</code></div>`;
  const demoPiece = piece({ icon: 'rifle', label: 'KR-4', mask: ['XXXX', '.X..'], x: 0, y: 0, r: 2, fam: 'rafale', cal: '5.56' }, 40);
  const demoPiece2 = piece({ icon: 'smg', label: 'Guêpe', mask: ['XX', '.X'], x: 0, y: 0, r: 0, fam: 'rafale', cal: '9mm', unfed: true }, 40);
  return `<section class="board">
  <div class="bh"><h1>HOT DROP</h1><p>Maquette haute fidélité · direction artistique « PMC tactique » · portrait 9:16 (360×640 = moitié exacte du canevas Phaser 720×1280 : toutes les cotes ×2 en jeu)</p></div>
  <div class="bgrid">
    <div class="bcell"><h4>Palette · fonds et texte</h4><div class="sws">
      ${sw('#0E100C', 'Fond', 1)}${sw('#171B13', 'Fond 2', 1)}${sw('#1F2419', 'Panneau', 1)}${sw('#2B3123', 'Panneau haut', 1)}${sw('#3A4231', 'Filet', 1)}${sw('#ECE8D8', 'Texte')}${sw('#9A9C88', 'Texte calme')}${sw('#5E6152', 'Texte éteint')}
    </div><h4>Signal</h4><div class="sws">
      ${sw('#FF8C1A', 'Accent (action)')}${sw('#FFB347', 'Accent clair')}${sw('#E5484D', 'Danger')}${sw('#5FBF6A', 'Succès')}${sw('#9BE33B', 'Gaz')}${sw('#8FA3B0', 'Armure')}${sw('#D9B86C', 'Crédits (laiton)')}
    </div></div>
    <div class="bcell"><h4>Typographie</h4>
      <div class="ty"><span class="t-disp">HOT DROP</span><code>Titre · condensée grasse 48–64, italique −8°, majuscules</code></div>
      <div class="ty"><span class="t-h1">EXTRACTION RÉUSSIE</span><code>H1 · condensée 26–32, interlettrage 0,02em</code></div>
      <div class="ty"><span class="t-h2">ESCOUADE ENNEMIE</span><code>Étiquette · condensée 10–12, majuscules, interlettrage 0,12em</code></div>
      <div class="ty"><span class="t-body">Tirs lents mais très puissants, ils tirent en premier.</span><code>Corps · système 12–13</code></div>
      <div class="ty"><span class="t-num">100<small>/</small><em>90</em> · 31</span><code>Chiffres · condensée, chiffres tabulaires</code></div>
      <p class="note">Pile : Bahnschrift Condensed → DIN Condensed → Oswald → Roboto Condensed → Arial Narrow → Liberation/Nimbus Sans Narrow. Recommandé en jeu : une police libre embarquée (Oswald ou Barlow Condensed, OFL).</p>
    </div>
    <div class="bcell"><h4>Espacement (base 4)</h4><div class="spc">${[4, 8, 12, 16, 24, 32].map((n) => `<div><i style="width:${n}px;height:${n}px"></i><code>${n}</code></div>`).join('')}</div>
      <p class="note">Rayons : 6 (puces), 10 (cartes), 14 (boutons), 28 (modales). Cible tactile ≥ 40 px dans la maquette = 80 px en jeu. Zone sûre : rien d'important dans les 30 px du haut au centre (caméra) ni sous les 12 px du bas (barre gestuelle).</p>
      <h4>Boutons</h4><div class="btns">
        <button class="btn primary">${ic('play', 14)}PRIMAIRE</button><button class="btn secondary">SECONDAIRE</button><button class="btn disabled">DÉSACTIVÉ</button><button class="btn danger">${ic('sell', 13)}VENDRE</button><button class="iconbtn">${ic('menu', 16)}</button>
      </div><p class="note">Primaire : dégradé orange + lèvre 4 px (s'écrase de 3 px à l'appui, 60 ms). Un seul primaire par écran.</p>
    </div>
    <div class="bcell"><h4>Rareté (bordure de la pièce)</h4><div class="rars">${RAR.map((r, i) => rarChip(i)).join('')}</div>
      <h4>Familles (coin de la pièce, puces)</h4><div class="fams">${['rafale', 'precision', 'demolition', 'rempart'].map((f) => `<div class="famcard" style="--c:${FAM[f].c}">${ic(FAM[f].i, 18)}<b>${FAM[f].n}</b><code>${FAM[f].c}</code><span><i>2</i>${FAM[f].t2}</span><span><i>4</i>${FAM[f].t4}</span></div>`).join('')}</div>
    </div>
    <div class="bcell"><h4>Badges de menace (forme écusson, fond sombre rouge)</h4><div class="thrs">${Object.keys(THR).map((t) => `<div>${thrBadge(t)}<span>${THR[t].e}</span></div>`).join('')}</div>
      <h4>Types de lieux (anneau = famille de butin)</h4><div class="places">${Object.keys(PLACE).map((p) => `<div><span class="pm">${ic(PLACE[p].i, 18)}</span><b>${PLACE[p].n}</b></div>`).join('')}<div><span class="pm boss">${ic('p-boss', 18)}</span><b>Cdt Kesh</b></div></div>
    </div>
    <div class="bcell anat"><h4>Anatomie d'une pièce</h4>
      <div class="anat-row"><div class="pdemo" style="width:160px;height:80px">${demoPiece}</div>
      <ul><li><b>Bordure</b> = rareté (Rare)</li><li><b>Coin</b> = famille (Rafale)</li><li><b>Puce verte</b> = calibre alimenté</li><li><b>Pointillés</b> = nombre de cases</li></ul></div>
      <div class="anat-row"><div class="pdemo" style="width:80px;height:80px">${demoPiece2}<div class="rech" style="left:2px;top:-9px">RECH ×2</div></div>
      <ul><li><b>Puce rouge</b> + pastille <b>RECH ×2</b> : aucun chargeur 9mm voisin</li><li>Liaison lumineuse sur l'arête partagée quand une synergie est active</li><li>Épique/Légendaire : halo externe</li></ul></div>
    </div>
    ${bestiary()}
  </div></section>`;
}

function mix(a, b, t) { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join(''); }
// ---------- Assemblage ----------
const PHONES = [
  ['01', 'Menu principal', scrMenu(), ['Reprise de run mise en avant : où, quand, combien de sursis', 'Un seul bouton primaire, au tiers inférieur (zone du pouce)', 'Gestes rappelés en puces iconographiées']],
  ['02', 'Briefing', scrBriefing(), ['Cartes de biome avec vignette satellite et badges (menaces, butin, gardien)', 'Barre de progression 1 → 2 → Cdt Kesh', 'Le bouton nomme la destination']],
  ['03', 'Carte de zone', scrMap(), ['Gaz hachuré + anneau pointillé de la prochaine zone sûre', 'Anneau = famille de butin, écussons = menaces, lieux à portée en pointillés', 'Panneau du bas : avertissement de gaz explicite, contre-mesures']],
  ['04', 'Gilet · préparation', vestScreen({ drag: true }), ['Escouade adverse et contre-mesures visibles avant le combat', 'Pièces à forme exacte, rareté en bordure, calibre en puce', 'Aperçu de dépôt : case verte + effet annoncé avant de lâcher']],
  ['05', 'Combat · Phare (Port, crépuscule)', vestScreen({ mode: 'combat' }), ['Scène en 4 plans : mer et phare voilés, conteneur, couverts, premier plan flou', 'Silhouettes ≈ 8 têtes, équipement lisible, contre-jour orange cohérent', 'Tireur couché sur le conteneur, milicien derrière un muret, Viper à genou derrière des sacs de sable']],
  ['05b', 'Combat · variante boss (Cdt Kesh)', vestScreen({ mode: 'combat', scene: 'kesh' }), ['Base aérienne de nuit : projecteur froid, lumière chaude du hangar', 'Barre de boss pleine largeur : PV, armure, escalade Assaut', 'Chiffres d\'armure gris-bleu distincts des dégâts PV (blanc) et subis (rouge)']],
  ['06', 'Butin · victoire', vestScreen({ overlay: lootOverlay(), dimAll: true }), ['Bannière VICTOIRE + rayons, crédits en gros', 'Cartes de butin teintées par rareté qui filent vers la réserve', 'Indice de famille : ce que le butin débloque']],
  ['07', 'Marchand', vestScreen({ overlay: shopOverlay(), dimAll: true }), ['Cartes avec forme miniature, famille et effet clé', 'Prix trop cher grisé en rouge, objet vendu tamponné', 'Relance et extension en secondaires, coût affiché']],
  ['08', 'Fin de run · extraction', scrEnd(true), ['Illustration d\'exfiltration, titre vert', 'Bilan en lignes lisibles + meilleur objet', 'Nouvelle run en primaire']],
  ['09', 'Fin de run · défaite', scrEnd(false), ['Même gabarit en rouge', 'Cause de la mort et conseil actionnable', '']],
];

const CSS = `
:root{--bg:#0E100C;--bg2:#171B13;--panel:#1F2419;--panel2:#2B3123;--line:#3A4231;--text:#ECE8D8;--quiet:#9A9C88;--mute:#5E6152;--accent:#FF8C1A;--accent2:#FFB347;--danger:#E5484D;--good:#5FBF6A;--gas:#9BE33B;--armor:#8FA3B0;--brass:#D9B86C;
--fd:"Bahnschrift Condensed","Bahnschrift SemiBold Condensed","DIN Condensed","Oswald","Roboto Condensed","Arial Narrow","Liberation Sans Narrow","Nimbus Sans Narrow",sans-serif;
--fb:system-ui,-apple-system,"Segoe UI",Roboto,"Liberation Sans",sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#080907 radial-gradient(1200px 600px at 20% 0,#1a1f14,transparent);color:var(--text);font:13px/1.35 var(--fb);padding:32px 28px 60px}
button{font:inherit;color:inherit;border:0;background:none}
.ic{display:inline-block;vertical-align:middle;fill:currentColor;flex:none}
code{font:11px ui-monospace,Menlo,Consolas,monospace;color:var(--quiet)}
b{font-weight:700}
/* Planche */
.board{max-width:1680px;margin:0 auto 40px}
.bh{display:flex;align-items:baseline;gap:24px;margin-bottom:18px;border-bottom:1px solid var(--line);padding-bottom:12px}
.bh h1{font:italic 800 44px/1 var(--fd);letter-spacing:.02em;background:linear-gradient(#FFD08A,#FF8C1A 60%,#D96A06);-webkit-background-clip:text;color:transparent;transform:skewX(-6deg)}
.bh p{color:var(--quiet);max-width:800px}
.bgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.bcell{background:linear-gradient(#1c2117,#151912);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.bcell h4{font:700 12px var(--fd);letter-spacing:.14em;text-transform:uppercase;color:var(--accent2);margin:6px 0 10px}
.sws{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}
.sw{display:flex;flex-direction:column;gap:2px}.sw i{height:30px;border-radius:6px}.sw b{font-size:11px}
.ty{display:flex;flex-direction:column;margin-bottom:9px}
.t-disp{font:italic 800 46px/1 var(--fd);color:var(--accent);transform:skewX(-6deg);transform-origin:left}
.t-h1{font:800 28px/1.05 var(--fd);letter-spacing:.02em}
.t-h2{font:700 12px var(--fd);letter-spacing:.12em;color:var(--quiet)}
.t-body{font-size:13px}
.t-num{font:800 26px var(--fd);font-variant-numeric:tabular-nums}.t-num small{color:var(--mute)}.t-num em{font-style:normal;color:var(--armor)}
.note{color:var(--quiet);font-size:11.5px;margin:6px 0}
.spc{display:flex;gap:14px;align-items:flex-end}.spc div{display:flex;flex-direction:column;align-items:center;gap:4px}.spc i{background:var(--accent);opacity:.8;border-radius:2px}
.btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.btns .btn{height:44px;padding:0 16px;font-size:15px}
.rars,.thrs,.places{display:flex;flex-wrap:wrap;gap:8px}
.thrs{flex-direction:column;gap:6px}.thrs div{display:flex;gap:8px;align-items:center}.thrs span{color:var(--quiet);font-size:11.5px}
.fams{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.famcard{border:1px solid color-mix(in srgb,var(--c) 45%,transparent);background:linear-gradient(color-mix(in srgb,var(--c) 14%,#171b13),#151912);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:3px;color:var(--c)}
.famcard b{font:800 15px var(--fd);letter-spacing:.06em;text-transform:uppercase}.famcard span{color:var(--text);font-size:11px;display:flex;gap:6px}.famcard span i{font-style:normal;font:800 10px var(--fd);background:var(--c);color:#111;border-radius:3px;padding:0 4px;height:14px}
.places div{display:flex;align-items:center;gap:6px;font-size:12px}
.pm{width:30px;height:30px;border-radius:50%;background:#12150f;border:2px solid #E9D8A6;display:grid;place-items:center}.pm.boss{border-color:var(--danger);color:#ff8a8d}
.anat-row{display:flex;gap:16px;align-items:center;margin:14px 0 18px}.anat-row ul{list-style:none;font-size:12px;color:var(--quiet)}.anat-row li{margin:2px 0}.anat-row li b{color:var(--text)}
.pdemo{position:relative;flex:none}
/* Téléphones */
.phones{display:flex;flex-wrap:wrap;gap:34px 30px;max-width:1680px;margin:0 auto}
.ph{display:flex;flex-direction:column;gap:10px;width:376px}
.ph-h{display:flex;gap:10px;align-items:baseline}.ph-h i{font:800 13px var(--fd);color:#111;background:var(--accent);padding:1px 6px;border-radius:4px;font-style:normal}.ph-h b{font:700 17px var(--fd);letter-spacing:.06em;text-transform:uppercase}
.bezel{padding:8px;border-radius:40px;background:linear-gradient(145deg,#2c2f2a,#121411);box-shadow:0 30px 60px -20px #000,inset 0 0 0 1px #3c403a}
.ph ul{list-style:none;color:var(--quiet);font-size:12px}.ph li{padding-left:14px;position:relative;margin:2px 0}.ph li:before{content:"";position:absolute;left:2px;top:7px;width:6px;height:2px;background:var(--accent)}
.scr{width:360px;height:640px;position:relative;overflow:hidden;border-radius:32px;background:radial-gradient(500px 300px at 50% -10%,#232a1c,transparent),var(--bg);isolation:isolate}
.scr:after{content:"";position:absolute;left:50%;bottom:6px;width:110px;height:4px;margin-left:-55px;border-radius:3px;background:#ffffff40;z-index:50}
/* Barre haute */
.topbar{position:absolute;left:0;right:0;top:0;height:34px;display:flex;align-items:center;justify-content:space-between;padding:6px 12px 0;z-index:20}
.cam{position:absolute;left:50%;top:9px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#000;box-shadow:0 0 0 2px #1a1a1a}
.tb-l,.tb-r{display:flex;align-items:center;gap:8px}
.iconbtn{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(#2e3427,#1f2419);border:1px solid #454d3b;box-shadow:inset 0 1px 0 #ffffff14,0 2px 0 #0b0d09;color:var(--text)}
.where{display:flex;flex-direction:column;line-height:1.05}.where b{font:800 15px var(--fd);letter-spacing:.06em}.where span{font:600 10px var(--fd);letter-spacing:.12em;color:var(--quiet);text-transform:uppercase}
.ver{font:600 10px var(--fd);letter-spacing:.1em;color:var(--mute)}
.sursis{display:flex;gap:1px}.sursis .on{color:#E9E1C3;filter:drop-shadow(0 0 3px #ffffff40)}.sursis .off{color:#3a3e33}
.cr{display:inline-flex;align-items:center;gap:3px;height:22px;padding:0 8px 0 4px;border-radius:11px;background:#0b0d09cc;border:1px solid #4c4430;color:var(--brass)}.cr b{font:800 14px var(--fd);color:#F3E3B5;font-variant-numeric:tabular-nums}
/* Puces */
.chip{display:inline-flex;align-items:center;gap:4px;height:18px;padding:0 7px;border-radius:9px;font:700 10.5px var(--fd);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.chip.fam{color:var(--c);background:color-mix(in srgb,var(--c) 16%,#0e100c);border:1px solid color-mix(in srgb,var(--c) 55%,transparent)}
.chip.rar{color:#111;background:linear-gradient(color-mix(in srgb,var(--c) 70%,#fff),var(--c));box-shadow:inset 0 -2px 0 #0003}
.chip.ok{color:#bff5c4;background:#1d3a20;border:1px solid #3f7d45}
.thr{display:inline-flex;align-items:center;gap:4px;height:19px;padding:0 6px 0 0;background:linear-gradient(#2c1515,#1a0e0e);border:1px solid color-mix(in srgb,var(--c) 70%,transparent);border-radius:3px 9px 9px 3px;font:700 10px var(--fd);letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;overflow:hidden}
.thr .ti{display:grid;place-items:center;width:18px;height:100%;background:var(--c);color:#140c0c;clip-path:polygon(0 0,100% 0,78% 100%,0 100%)}
.thr b{color:var(--text);font-weight:700}
.thr.sm{padding:0;border-radius:3px}.thr.sm .ti{width:17px;clip-path:none}
/* Boutons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;padding:0 18px;border-radius:14px;font:800 17px var(--fd);letter-spacing:.08em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
.btn.xl{width:100%;height:56px;font-size:20px}
.btn.primary{color:#1d1104;background:linear-gradient(#FFC56E,#FF9A2E 45%,#F07A0C);box-shadow:inset 0 1px 0 #fff8,inset 0 -1px 0 #0003,0 4px 0 #9C4A06,0 10px 22px -6px #FF8C1A99;text-shadow:0 1px 0 #ffd9a088}
.btn.secondary{color:var(--text);background:linear-gradient(#3b4331,#283022);box-shadow:inset 0 1px 0 #ffffff1c,inset 0 0 0 1px #56604a,0 4px 0 #11140e}
.btn.disabled{color:#6b6e60;background:repeating-linear-gradient(135deg,#23271e 0 8px,#1f231b 8px 16px);box-shadow:inset 0 0 0 1px #33382c}
.btn.danger{color:#ffd6d7;background:linear-gradient(#7a2427,#561619);box-shadow:inset 0 1px 0 #ffffff22,inset 0 0 0 1px #a33a3e,0 4px 0 #2a0b0c}
.btn.ghost{height:36px;color:var(--quiet);font-size:14px}
.bottom{position:absolute;left:12px;right:12px;bottom:16px;z-index:10}
.bottom.two{display:flex;flex-direction:column;gap:12px}
/* Menu */
.menu-bg{position:absolute;inset:0;opacity:.75}
.menu-shade{position:absolute;inset:0;background:radial-gradient(380px 300px at 50% 32%,#FF8C1A33,transparent 70%),linear-gradient(#0e100c55,#0e100c 72%)}
.logo{position:absolute;top:66px;left:0;right:0;text-align:center}
.logo-k{font:700 11px var(--fd);letter-spacing:.42em;color:var(--accent2);display:flex;gap:10px;justify-content:center;align-items:center}
.logo-k:before,.logo-k:after{content:"";width:34px;height:1px;background:var(--accent2);opacity:.6}
.logo h1{font:italic 900 96px/.86 var(--fd);letter-spacing:.01em;margin-top:8px;transform:skewX(-7deg);background:linear-gradient(#FFF0CC 0%,#FFB347 38%,#FF8C1A 62%,#C55C05 100%);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #3d1c02) drop-shadow(0 0 24px #FF8C1A66)}
.logo-s{margin-top:12px;color:var(--text);font:600 13px var(--fb);opacity:.85}
.op-card{position:absolute;left:16px;right:16px;top:322px;display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:14px;background:linear-gradient(#232a1ccc,#161a12ee);border:1px solid #4a523e;box-shadow:inset 0 1px 0 #ffffff12}
.op-av{width:54px;height:58px;border-radius:10px;background:linear-gradient(#3a3020,#1d1a12);display:grid;place-items:end center;overflow:hidden;border:1px solid #6a5531}
.op-t{display:flex;flex-direction:column;gap:2px}.op-t>b{font:800 18px var(--fd);letter-spacing:.1em}.op-t>span{font-size:11px;color:var(--quiet)}
.run-line{font-size:11.5px;display:flex;align-items:center;gap:5px}.run-line.dim{color:var(--quiet)}.run-line .cr{height:18px}.run-line .cr b{font-size:12px}
.menu-btns{position:absolute;left:16px;right:16px;bottom:74px;display:flex;flex-direction:column;gap:14px}
.gestures{position:absolute;left:0;right:0;bottom:26px;display:flex;justify-content:center;gap:10px;font-size:10.5px;color:var(--quiet)}.gestures span{display:flex;align-items:center;gap:4px}.gestures b{color:var(--text)}
/* Briefing */
.prog{position:absolute;top:44px;left:16px;right:16px;display:flex;align-items:center}
.pg{display:flex;flex-direction:column;align-items:center;gap:3px;width:60px}.pg i{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font:800 13px var(--fd);font-style:normal;background:#22271c;border:2px solid #454d3b;color:var(--quiet)}
.pg span{font:700 10px var(--fd);letter-spacing:.08em;text-transform:uppercase;color:var(--quiet)}
.pg.now i{background:var(--accent);border-color:#FFD08A;color:#1d1104;box-shadow:0 0 0 4px #FF8C1A33}.pg.now span{color:var(--accent2)}
.pg.boss i{border-color:#8a2c2f;color:#ff8a8d;background:#2a1414}
.pl{flex:1;height:3px;background:repeating-linear-gradient(90deg,#454d3b 0 6px,transparent 6px 10px);margin-bottom:14px}
.h1{position:absolute;top:100px;left:16px;font:800 22px var(--fd);letter-spacing:.02em}
.sub{position:absolute;top:127px;left:16px;right:16px;font-size:11.5px;color:var(--quiet)}
.bcards{position:absolute;top:152px;left:12px;right:12px;display:flex;flex-direction:column;gap:10px}
.bcard{display:flex;gap:10px;padding:7px;border-radius:14px;background:linear-gradient(#232a1c,#181c14);border:1px solid #3d4535;box-shadow:inset 0 1px 0 #ffffff10,0 4px 0 #0a0c08;position:relative}
.bcard.sel{border:2px solid var(--accent);padding:6px;box-shadow:0 0 0 4px #FF8C1A22,0 10px 24px -8px #FF8C1A88,inset 0 1px 0 #ffffff18;background:linear-gradient(#33301f,#1b1d14)}
.thumb{border-radius:9px;flex:none}
.bc-b{display:flex;flex-direction:column;gap:5px;flex:1;min-width:0;padding-top:2px}
.bc-t{font:800 17px var(--fd);letter-spacing:.05em;display:flex;align-items:center;gap:8px}
.selmark{width:18px;height:18px;border-radius:50%;background:var(--accent);color:#1d1104;display:grid;place-items:center}
.bc-r{display:flex;gap:4px;align-items:center;flex-wrap:nowrap}.bc-r .k{font:700 9px var(--fd);letter-spacing:.08em;color:var(--mute);width:42px}
.bc-r.ex b{font:700 12px var(--fd);letter-spacing:.04em;color:#ffd7a6}.exf{color:#ffd7a6}
/* Carte */
.turns{position:absolute;top:40px;left:12px;right:12px;height:26px;display:flex;align-items:center;gap:8px}
.tl{font:800 13px var(--fd);letter-spacing:.08em}
.tpips{display:flex;gap:3px;flex:1}.tpips i{flex:1;height:8px;border-radius:2px;background:#2b3123;display:grid;place-items:center}.tpips i.done{background:#6e705f}.tpips i.now{background:var(--accent);box-shadow:0 0 8px #FF8C1A}.tpips i.ex{height:18px;background:#1d2a14;border:1px solid var(--gas);color:var(--gas);flex:1.4}
.gasn .dash{width:14px;height:0;border-top:2px dashed #fff;margin-right:2px}.gasn{display:flex;align-items:center;gap:3px;font:700 10px var(--fd);letter-spacing:.08em;color:var(--gas);text-transform:uppercase}
.mapwrap{position:absolute;top:70px;left:0;width:360px;height:340px}
.zmap{display:block}
.mlabel{font:700 9.5px var(--fd);letter-spacing:.06em;fill:#d9d4c0;text-anchor:middle;paint-order:stroke;stroke:#0b0d09;stroke-width:3px;stroke-linejoin:round}
.mlabel.sel{fill:#FFC56E;font-size:12px}.mlabel.reach{fill:#fff;font-size:10.5px}.mlabel.here{fill:#bdb8a4}.mlabel.ring{fill:#fff;font-size:9px;letter-spacing:.14em;text-anchor:start}.mlabel.exf{fill:#E9F5D0;font-size:10px}.mlabel.me{fill:#1d1104;stroke:none;font-size:9px}.mlabel.left{text-anchor:start}
.legend{position:absolute;left:8px;top:8px;display:flex;flex-direction:column;gap:2px;padding:5px 7px;border-radius:8px;background:#0b0d09c4;border:1px solid #3a4231;font:600 9.5px var(--fd);letter-spacing:.04em;color:var(--quiet);display:none}
.sheet{position:absolute;left:0;right:0;bottom:0;height:236px;padding:6px 12px 16px;border-radius:22px 22px 0 0;background:linear-gradient(#252c1e,#171b13 40%);border-top:1px solid #556048;box-shadow:0 -12px 30px #000a;z-index:5;display:flex;flex-direction:column;gap:6px}
.grab{width:36px;height:4px;border-radius:2px;background:#ffffff30;margin:0 auto 2px}
.sh-h{display:flex;align-items:center;gap:10px}
.ptype{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#12150f;border:3px solid var(--c);box-shadow:0 0 12px color-mix(in srgb,var(--c) 50%,transparent)}
.sh-t{font:800 22px/1 var(--fd);letter-spacing:.06em}.sh-s{font-size:11px;color:var(--quiet)}
.sh-h .chip{margin-left:auto}
.gaswarn{display:flex;align-items:center;gap:6px;font-size:11px;color:#d7f7b0;background:#1e2d12;border:1px solid #4f7a22;border-radius:8px;padding:4px 8px}
.gaswarn .ic{color:var(--gas)}
.sh-cols{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.col{display:flex;flex-direction:column;gap:3px;align-items:flex-start}.col .k{font:700 9.5px var(--fd);letter-spacing:.14em;color:var(--mute)}.col .d{font-size:10.5px;color:var(--quiet);line-height:1.25}.col .d b{color:var(--text)}
.sheet .btn{margin-top:auto}
/* Gilet */
.band{position:absolute;left:8px;right:8px;top:38px;border-radius:14px;overflow:hidden}
.intelband{height:94px;background:linear-gradient(#2a1c18,#1a1411);border:1px solid #5a3a32;box-shadow:inset 0 1px 0 #ffffff12}
.intel{padding:6px 9px;display:flex;flex-direction:column;gap:4px;height:100%}
.intel-h{display:flex;justify-content:space-between;align-items:center}.lbl{font:700 10.5px var(--fd);letter-spacing:.12em;color:#e8b5a8}
.intel-b{display:flex;gap:6px}
.foe{flex:1;display:flex;gap:4px;align-items:center;background:#00000040;border:1px solid #4a2e28;border-radius:8px;padding:2px 4px;min-width:0}
.foe>div{display:flex;flex-direction:column;line-height:1.12;min-width:0}.foe b{font:800 12px var(--fd);letter-spacing:.04em}.foe em{font:700 8.5px var(--fd);font-style:normal;color:#7fd8ff;letter-spacing:.06em}.foe span{font-size:9px;color:var(--quiet);white-space:nowrap}
.intel-f{font-size:10px;color:#d8c9c2}.intel-f .ic{color:#4FC3F7}.intel-f b{color:var(--text)}
.stats{position:absolute;left:8px;right:8px;top:136px;display:grid;grid-template-columns:1.25fr 1fr 1fr 1fr;gap:5px}
.stat{display:flex;flex-direction:column;padding:3px 7px;border-radius:9px;background:linear-gradient(#232a1c,#1a1e15);border:1px solid #3a4231}
.stat .k{font:700 9px var(--fd);letter-spacing:.08em;color:var(--quiet);white-space:nowrap}.stat .v{font:800 19px/1.05 var(--fd);font-variant-numeric:tabular-nums}.stat small{font-size:12px;color:var(--mute);margin:0 1px}.stat .arm{font-style:normal;color:var(--armor)}
.stat.warn{border-color:#8a3a3c;background:linear-gradient(#3a1d1d,#241414)}.stat.warn .v{color:#ff9ea0}
.famrow{position:absolute;left:8px;right:8px;top:180px;display:flex;gap:5px}
.fp{flex:1;display:flex;align-items:center;gap:4px;height:20px;padding:0 6px;border-radius:6px;background:#12150f;border:1px solid #2f3528;color:var(--c);opacity:.7}
.fp.act{opacity:1;border-color:color-mix(in srgb,var(--c) 60%,transparent);background:color-mix(in srgb,var(--c) 12%,#12150f)}
.fp .pips{display:flex;gap:2px;flex:1}.fp .pips i{flex:1;height:5px;border-radius:1px;background:#2e3428}.fp .pips i.on{background:var(--c)}.fp .pips i.tier{margin-right:2px}
.fp b{font:800 10px var(--fd);color:var(--text)}
.gridwrap{position:absolute;left:40px;top:210px;width:280px;height:296px}
.gridwrap.combat{top:244px}
.vest{position:relative}
.cell{position:absolute;width:40px;height:40px;border:1px solid #ffffff0c;display:grid;place-items:center}
.cell.open{background:linear-gradient(135deg,#2b3124,#222719);box-shadow:inset 0 0 0 1px #00000040,inset 1px 1px 0 #ffffff0a;border-radius:3px}
.cell.open.poi{background:linear-gradient(135deg,#34402b,#28321f)}
.cell.open.fla{background:linear-gradient(135deg,#283a40,#1d2c31)}
.cell.open.cei{background:linear-gradient(135deg,#43392a,#33291c)}
.cell.locked{background:repeating-linear-gradient(135deg,#14170f 0 4px,#11130d 4px 8px);color:#33372c}
.zframe{position:absolute;border:1.5px solid #8bbf62;border-radius:6px;box-shadow:0 0 12px #8bbf6233,inset 0 0 12px #8bbf621a;pointer-events:none}
.ztab{position:absolute;height:15px;display:flex;align-items:center;justify-content:center;gap:3px;font:700 9px var(--fd);letter-spacing:.08em;color:#13200b;background:#8bbf62;border-radius:4px;white-space:nowrap;margin-left:-14px;padding:0 6px;z-index:2;box-shadow:0 2px 0 #0008}
.zlabel{position:absolute;font:700 9px var(--fd);letter-spacing:.12em;white-space:nowrap}
.zlabel.l,.zlabel.r{top:84px;color:#7fc4d4;writing-mode:vertical-rl}
.zlabel.l{left:-17px;transform:rotate(180deg)}.zlabel.r{right:-17px}
.zlabel.b{left:0;right:0;top:282px;text-align:center;color:#d8b47a;display:flex;justify-content:center;gap:4px;align-items:center}
.piece{position:absolute;overflow:visible}
.picon{color:#EEE7D0;filter:drop-shadow(0 1.5px 0 #000a)}
.plabel{font:700 9.5px var(--fd);letter-spacing:.04em;fill:#e9e3cc;paint-order:stroke;stroke:#0008;stroke-width:2.5px}
.pcal{font:800 8.5px var(--fd);text-anchor:middle;letter-spacing:.02em}
.link{position:absolute;border-radius:4px;background:var(--c);box-shadow:0 0 6px var(--c),0 0 14px var(--c);z-index:3}
.link.v{width:6px;height:18px}.link.h{width:18px;height:6px}
.rech{position:absolute;z-index:4;font:800 9.5px/1 var(--fd);letter-spacing:.05em;color:#fff;background:linear-gradient(#ff5a5f,#c42f34);padding:3px 5px;border-radius:5px;box-shadow:0 2px 0 #5d1214,0 0 10px #E5484D88;white-space:nowrap}
.drop-ok{position:absolute;border:2px dashed #7ddc86;border-radius:4px;background:#5fbf6a33;box-shadow:0 0 16px #5fbf6a66;z-index:2}
.piece.dragging{transform:translate(4px,-14px) scale(1.12);filter:drop-shadow(0 10px 8px #000c);z-index:6}
.hint{position:absolute;z-index:7;white-space:nowrap;font-size:10.5px;color:#d6f5d9;background:#163019ee;border:1px solid #4a9a52;border-radius:8px;padding:3px 7px;display:flex;gap:4px;align-items:center}
.finger{position:absolute;z-index:8;color:#f3eee0;filter:drop-shadow(0 2px 2px #000)}
.piece.firing{filter:drop-shadow(0 0 8px #FFC46B)}
.cd{position:absolute;width:14px;height:14px;border-radius:50%;background:conic-gradient(#FFC46B var(--p),#0009 0);z-index:4;box-shadow:0 0 0 1.5px #0008}
.reload{position:absolute;height:9px;border-radius:3px;background:#0009;overflow:hidden;z-index:4}.reload i{display:block;height:100%;background:linear-gradient(90deg,#c42f34,#ff6b6b)}.reload span{position:absolute;inset:0;font:800 7.5px/9px var(--fd);text-align:center;letter-spacing:.06em}
.charges{position:absolute;z-index:4;width:14px;height:14px;border-radius:50%;background:#FF8C1A;color:#1d1104;font:800 10px/14px var(--fd);text-align:center;box-shadow:0 0 0 1.5px #1d1104}.charges.used{background:#5e6152;color:#ddd}
.pulse{position:absolute;border-radius:4px;box-shadow:0 0 0 2px #FFB347,0 0 18px #FF8C1A;z-index:3}
.vest.dim .cell{opacity:.8}
/* Réserve */
.tray{position:absolute;left:8px;right:8px;top:508px;height:52px;display:flex;gap:6px}
.tray.dim{opacity:.45}
.gridwrap.combat~.tray{top:532px}
.sell{width:52px;border-radius:10px;border:1.5px dashed #a33a3e;background:#2a1213;color:#ff9ea0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.sell b{font:800 9.5px var(--fd);letter-spacing:.06em;margin-top:2px}.sell span{font:700 8.5px var(--fd);color:#c97a7c}
.res{flex:1;display:flex;flex-direction:column;gap:2px}
.res-h{display:flex;gap:6px;align-items:baseline;font:700 9.5px var(--fd);letter-spacing:.1em}.res-h span{color:var(--mute);letter-spacing:.04em;font-weight:600}
.slots{flex:1;display:grid;grid-template-columns:repeat(6,1fr);gap:4px}
.slot{border-radius:8px;background:#12150f;border:1px solid #2f3528;box-shadow:inset 0 2px 4px #0008;display:grid;place-items:center;position:relative}
.slot.from{border:1.5px dashed #6e705f}
.mini{width:34px;height:34px;border-radius:7px;display:grid;place-items:center;background:linear-gradient(color-mix(in srgb,var(--rc) 30%,#232a1c),#14170f);border:2px solid var(--rc);color:#eee7d0;position:relative}
.mini i{position:absolute;left:1px;top:1px;width:8px;height:8px;clip-path:polygon(0 0,100% 0,0 100%)}
.bottom .go{flex-direction:row}
.log{position:absolute;left:12px;right:12px;top:540px;font-size:10.5px;color:var(--quiet);display:flex;flex-direction:column;gap:1px}.log .o{color:var(--text)}.log .y{color:#FFE38A}.log .r{color:#ff9ea0}.log .old{opacity:.6}
/* Combat */
.combatband{height:196px;top:36px;border:1px solid #5a4230;background:#14120f}
.cb-scene{position:relative;width:360px;height:196px;margin-left:-8px}
.cb-bg{position:absolute;inset:0}
.cb-top{position:absolute;left:14px;right:22px;top:6px;display:flex;align-items:center;gap:8px;z-index:4}
.timer{display:flex;align-items:center;gap:4px;font:800 13px var(--fd);background:#000a;padding:2px 7px;border-radius:7px}
.speed{display:flex;margin-left:auto;background:#000a;border-radius:9px;padding:2px;border:1px solid #ffffff22}.speed b{font:800 12px var(--fd);padding:3px 8px;border-radius:7px;color:var(--quiet)}.speed b.on{background:var(--accent);color:#1d1104}
.skip{font:800 11px var(--fd);letter-spacing:.08em;background:#000a;border:1px solid #ffffff33;border-radius:9px;padding:4px 8px;display:flex;gap:4px;align-items:center}
.me{position:absolute;left:30px;top:82px;z-index:2;filter:drop-shadow(0 0 10px #000)}
.muzzle{position:absolute;left:44px;top:18px;width:16px;height:10px;border-radius:50%;background:radial-gradient(#fff6d8,#FFB347 50%,transparent 70%)}
.foe2{position:absolute;z-index:2;display:flex;flex-direction:column;align-items:center;width:52px;margin-left:-14px}
.foe2.dead{opacity:.5;transform:rotate(-90deg);transform-origin:50% 100%}.foe2.dead .fbar,.foe2.dead .fn{display:none}
.fbar{width:40px;height:5px;border-radius:2px;background:#000b;overflow:hidden;box-shadow:0 0 0 1px #000}.fbar i{display:block;height:100%;background:linear-gradient(#ff7a7d,#d93a3f)}
.fn{font:700 9px var(--fd);letter-spacing:.04em;white-space:nowrap;text-shadow:0 1px 2px #000;display:flex;gap:3px}.fn em{font-style:normal;color:#FFE38A}
.fx{position:absolute;inset:0;z-index:3;pointer-events:none}
.dmg{position:absolute;z-index:5;font:900 20px var(--fd);color:#fff;text-shadow:0 2px 0 #000,0 0 6px #000}
.dmg.crit{font-size:30px;color:#FFE38A;transform:rotate(-8deg);text-shadow:0 2px 0 #7a4a00,0 0 12px #FF8C1A}.dmg.crit small{display:block;font-size:11px;letter-spacing:.14em;margin-top:-4px}
.dmg.miss{font-size:13px;color:#a9ab9a;font-style:italic}
.dmg.hurt{color:#ff6b6b;font-size:18px}
.grenade-l{position:absolute;z-index:5;font:800 10px var(--fd);letter-spacing:.06em;color:#1d1104;background:#FFB347;padding:1px 5px;border-radius:4px}
.cb-hud{position:absolute;left:0;right:0;bottom:0;height:30px;display:flex;align-items:center;gap:8px;padding:0 10px;background:linear-gradient(#0000,#000c 40%)}
.who{display:flex;align-items:center;gap:4px;color:#ff8a8d}.who b{font:800 12px var(--fd);letter-spacing:.1em;color:var(--text)}
.bars{flex:1;display:flex;flex-direction:column;gap:2px}
.bar{position:relative;height:10px;border-radius:3px;background:#000b;box-shadow:0 0 0 1px #ffffff1a;overflow:hidden}.bar i{display:block;height:100%}.bar span{position:absolute;right:4px;top:0;font:800 9px/10px var(--fd)}
.bar.hp i{background:linear-gradient(#8cf095,#3f9e48)}.bar.ar i{background:linear-gradient(#c7d6e0,#7d93a1)}.bar.ar{height:7px}.bar.ar span{font-size:7.5px;line-height:7px}
.vs{font:800 12px var(--fd);background:#3a1414;border:1px solid #8a2c2f;color:#ffb3b5;border-radius:6px;padding:1px 6px}
/* Combat v2 */
.foetag{position:absolute;z-index:5;width:46px;display:flex;flex-direction:column;gap:1.5px}
.ft-n{font:700 9px var(--fd);letter-spacing:.05em;white-space:nowrap;text-shadow:0 1px 2px #000,0 0 4px #000;display:flex;gap:3px}.ft-n em{font-style:normal;color:#FFE38A}
.fb2{height:5px;border-radius:2px;background:#000c;box-shadow:0 0 0 1px #0009;overflow:hidden}.fb2 i{display:block;height:100%}.fb2.hp i{background:linear-gradient(#ff7a7d,#d93a3f)}.fb2.arm{height:3px}.fb2.arm i{background:#b4c6d2}
.dmg.armor{color:#cfe0ec;font-size:18px;display:flex;align-items:center;gap:2px}.dmg.armor .ic{color:#b4c6d2}.dmg.armor.sm{font-size:13px;opacity:.85}
.dmg.hurt.big{font-size:22px}
.bossbar{position:absolute;z-index:5;left:20px;right:20px;top:34px;display:flex;flex-direction:column;gap:2px}
.bb-h{display:flex;align-items:center;gap:5px;color:#ff8a8d}.bb-h b{font:800 12px var(--fd);letter-spacing:.14em;color:#ffd6d7;text-shadow:0 1px 2px #000}.bb-h em{font:700 9.5px var(--fd);font-style:normal;color:#ff8a8d;letter-spacing:.06em;margin-left:auto;background:#000a;padding:0 5px;border-radius:4px}
.bb-hp{position:relative;height:9px;border-radius:3px;background:#000c;box-shadow:0 0 0 1px #8a2c2f;overflow:hidden}.bb-hp i{display:block;height:100%;background:linear-gradient(#ff8a5c,#c4301f)}.bb-hp span,.bb-ar span{position:absolute;right:4px;top:0;font:800 8px/9px var(--fd);display:flex;gap:2px;align-items:center}
.bb-ar{position:relative;height:6px;border-radius:2px;background:#000c;overflow:hidden}.bb-ar i{display:block;height:100%;background:linear-gradient(#d5e2ea,#8fa3b0)}.bb-ar span{font-size:6.5px;line-height:6px;color:#fff;text-shadow:0 0 2px #000}
.combatband.boss{border-color:#3a4a66}
.log .b{color:#cfe0ec}
.bcell.full{grid-column:1/-1}
.best-row{display:flex;gap:12px;flex-wrap:wrap}.bst{display:flex;flex-direction:column;gap:2px;max-width:200px}.bst svg{border-radius:10px;border:1px solid #3a4231}.bst b{font:800 15px var(--fd);letter-spacing:.06em;text-transform:uppercase;margin-top:4px}.bst em{font:700 10.5px var(--fd);font-style:normal;color:var(--accent2);letter-spacing:.06em;text-transform:uppercase}.bst span{font-size:11px;color:var(--quiet)}
/* Superpositions */
.scr.under>*:not(.ov):not(.topbar){filter:blur(1.5px) brightness(.45) saturate(.7)}
.ov{position:absolute;inset:0;z-index:30}
.loot{background:radial-gradient(300px 220px at 50% 22%,#5FBF6A30,transparent)}
.rays{position:absolute;left:50%;top:120px;width:560px;height:560px;margin:-280px 0 0 -280px;background:repeating-conic-gradient(#ffe7a812 0 6deg,transparent 6deg 18deg);mask:radial-gradient(closest-side,#000 30%,transparent);-webkit-mask:radial-gradient(closest-side,#000 30%,transparent)}
.banner{position:absolute;top:54px;left:0;right:0;text-align:center;display:flex;flex-direction:column;align-items:center}
.banner h2{font:italic 900 62px/.95 var(--fd);letter-spacing:.03em;transform:skewX(-6deg);background:linear-gradient(#F3FFE0,#9BE33B 55%,#4E8F1D);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #10240a) drop-shadow(0 0 18px #9BE33B66)}
.banner .bk{font:700 11px var(--fd);letter-spacing:.3em;color:#c9f0a6}
.banner .bs{font-size:11.5px;color:var(--text);display:flex;gap:5px;align-items:center;background:#000a;border-radius:10px;padding:2px 10px;margin-top:4px}
.rewards{position:absolute;top:172px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:4px}
.cr-gain{display:flex;align-items:center;gap:6px;color:var(--brass)}.cr-gain b{font:900 34px var(--fd);color:#FFE7A8;text-shadow:0 2px 0 #5b4210}.cr-gain span{font:700 12px var(--fd);letter-spacing:.12em;color:var(--brass);text-transform:uppercase}
.sur{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--quiet)}
.lootrow{position:absolute;top:252px;left:12px;right:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.lcard{border-radius:12px;padding:6px 6px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;background:linear-gradient(color-mix(in srgb,var(--rc) 35%,#1a1e15),#12150f 75%);border:2px solid var(--rc);box-shadow:0 0 18px color-mix(in srgb,var(--rc) 50%,transparent),inset 0 1px 0 #ffffff30;transform:translateY(0)}
.lcard.r2{transform:translateY(-8px) scale(1.04)}
.lc-ic{height:48px;display:grid;place-items:center;color:#f1ead4;filter:drop-shadow(0 2px 0 #000)}
.lc-n{font:800 12.5px/1.05 var(--fd);letter-spacing:.03em;text-align:center}
.fly{position:absolute;top:404px;left:0;right:0;text-align:center;font:700 10px var(--fd);letter-spacing:.14em;color:var(--quiet);text-transform:uppercase}
.trail{position:absolute;inset:0;pointer-events:none}
.ov-btns{position:absolute;left:12px;right:12px;bottom:16px;display:flex;flex-direction:column-reverse;gap:10px;align-items:center}
.famhint{font-size:11px;color:#bfe9ff;display:flex;gap:5px;align-items:center;background:#0f2430;border:1px solid #2b6a86;border-radius:9px;padding:3px 9px}
.shop{background:#0006}
.modal{position:absolute;left:8px;right:8px;bottom:8px;top:88px;border-radius:24px;padding:12px;background:linear-gradient(#2b2a1d,#191b13 30%);border:1px solid #6b5a33;box-shadow:0 -10px 40px #000,inset 0 1px 0 #ffffff22;display:flex;flex-direction:column;gap:10px}
.mh{display:flex;align-items:center;gap:10px}.mh h3{font:800 22px/1 var(--fd);letter-spacing:.08em}.mh span{font-size:11px;color:var(--quiet)}
.mh-ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(#e7cf8f,#a88a43);color:#2a2008;box-shadow:inset 0 1px 0 #fff8,0 3px 0 #4f3f17}
.mh-cr{margin-left:auto}.iconbtn.x{width:32px;height:32px}
.offers{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.offer{position:relative;border-radius:14px;padding:8px;display:flex;flex-direction:column;gap:3px;background:linear-gradient(color-mix(in srgb,var(--rc) 22%,#1f2419),#14170f 70%);border:1.5px solid color-mix(in srgb,var(--rc) 80%,transparent);box-shadow:inset 0 1px 0 #ffffff18,0 4px 0 #0a0c08;overflow:hidden}
.of-top{display:flex;justify-content:space-between;align-items:center}
.mshape{display:grid;gap:1px}.mshape i{width:8px;height:8px;border-radius:1px;background:#ffffff10}.mshape i.on{background:var(--rc)}
.of-ic{height:40px;display:grid;place-items:center;color:#f1ead4;filter:drop-shadow(0 2px 0 #000)}
.of-n{font:800 14px/1.05 var(--fd);letter-spacing:.03em}
.of-d{font-size:10.5px;color:var(--quiet);min-height:14px}
.price{margin-top:3px;height:34px;border-radius:10px;font:800 16px var(--fd);letter-spacing:.06em;color:#1d1104;background:linear-gradient(#FFE3A3,#E4B95A);box-shadow:inset 0 1px 0 #fff8,0 3px 0 #6b4f12;display:flex;align-items:center;justify-content:center;gap:4px}
.offer.poor .price{background:#2a2d25;color:#ff8a8d;box-shadow:inset 0 0 0 1px #6b2a2c}
.offer.poor .of-ic,.offer.poor .of-n{opacity:.7}
.offer.sold{filter:saturate(.2) brightness(.6)}.offer.sold .price{background:#2a2d25;color:#777;box-shadow:none}
.stamp{position:absolute;top:44px;left:50%;transform:translateX(-50%) rotate(-14deg);font:900 22px var(--fd);letter-spacing:.14em;color:#ff6b6b;border:3px solid #ff6b6b;padding:0 8px;border-radius:6px;opacity:.9}
.shop-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px}.shop-acts .btn{height:46px;font-size:13.5px;padding:0 8px;gap:5px}
.cost{display:inline-flex;align-items:center;gap:2px;color:var(--brass);font-size:13px;margin-left:2px}
.modal .ghost{margin-top:auto}
/* Fin */
.end.win{background:radial-gradient(400px 300px at 50% 20%,#2f3a1c,transparent),var(--bg)}
.end.lose{background:radial-gradient(400px 300px at 50% 20%,#3a1a18,transparent),var(--bg)}
.end-art{position:absolute;top:-46px;left:0;-webkit-mask-image:linear-gradient(#000 55%,transparent 98%);mask-image:linear-gradient(#000 55%,transparent 98%)}
.recap{display:grid!important;grid-template-columns:repeat(3,1fr);gap:6px;padding:0!important;background:none!important;border:0!important;top:258px!important}
.tile{display:flex;flex-direction:column;align-items:center;padding:6px 4px;border-radius:10px;background:linear-gradient(#232a1c,#171b13);border:1px solid #3a4231}
.tile .v{font:800 22px/1 var(--fd);font-variant-numeric:tabular-nums}.tile .k{font:700 9px var(--fd);letter-spacing:.08em;color:var(--quiet);text-transform:uppercase;margin-top:2px}
.recap-l{position:absolute;top:376px;left:16px;right:16px;display:flex;gap:4px;align-items:center;justify-content:center;font-size:10.5px;color:var(--quiet);flex-wrap:wrap}.recap-l .ic{color:var(--good)}.end.lose .recap-l .ic{color:#ff8a8d}.recap-l b{color:var(--text)}
.best{top:404px!important}
.end-t{position:absolute;top:142px;left:0;right:0;text-align:center}
.end-t .ek{font:700 11px var(--fd);letter-spacing:.3em;color:#c9f0a6}
.end.lose .ek{color:#ffb3b5}
.end-t h2{font:italic 900 50px/.9 var(--fd);transform:skewX(-6deg);margin-top:4px;background:linear-gradient(#F3FFE0,#9BE33B 60%,#4E8F1D);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #10240a)}
.end.lose .end-t h2{background:linear-gradient(#FFE0E0,#ff6b6b 55%,#9c2226);-webkit-background-clip:text;filter:drop-shadow(0 3px 0 #2a0a0b)}
.recap{position:absolute;top:278px;left:16px;right:16px;border-radius:14px;background:linear-gradient(#20261a,#171b13);border:1px solid #3a4231;padding:4px 12px}
.rr{display:grid;grid-template-columns:1fr auto;align-items:center;padding:5px 0;border-bottom:1px solid #2c3224}.rr:last-child{border:0}
.rr .k{font-size:12px;color:var(--quiet)}.rr .v{font:800 17px var(--fd);text-align:right}.rr .d{grid-column:1/3;font-size:10px;color:var(--mute);display:flex;gap:3px;align-items:center;margin-top:-2px}.rr .d .ic{color:var(--good)}
.best{position:absolute;left:16px;right:16px;top:476px;display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;background:linear-gradient(90deg,#3a3014,#1b1c13);border:1px solid #7a6526;flex-wrap:wrap}
.best .k{width:100%;font:700 9.5px var(--fd);letter-spacing:.14em;color:#e9cf7f;margin-bottom:-4px}
.best .bi{width:46px;height:34px;border-radius:8px;border:2px solid var(--rc);display:grid;place-items:center;background:#2a2410;color:#fff4d0;box-shadow:0 0 12px #F2C94C88}
.best b{font:800 14px var(--fd);letter-spacing:.03em;display:block}.best span{display:flex;gap:4px;margin-top:2px;font-size:11px;color:var(--quiet)}
.best.lose{background:linear-gradient(90deg,#2a1515,#1b1913);border-color:#7a3436}.best.lose .k{color:#ffb3b5}.best.lose span{display:block}
.end .bottom.two{bottom:14px}
.end.win .bottom .secondary,.end.lose .bottom .secondary{height:42px}
.end .recap .rr:nth-child(n+7){display:none}
`;

const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HOT DROP · maquettes UI</title><style>${CSS}</style></head><body>
<svg width="0" height="0" style="position:absolute"><defs>${sym}
${RAR.map((r, i) => `<linearGradient id="rg${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(r.c, '#252b1f', 0.38)}"/><stop offset="1" stop-color="${mix(r.c, '#14170f', 0.12)}"/></linearGradient>`).join('')}
<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="vign" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
<radialGradient id="redglow" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#E5484D" stop-opacity=".35"/><stop offset="1" stop-color="#E5484D" stop-opacity="0"/></radialGradient>
${FIG_DEFS}<linearGradient id="bstbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f24"/><stop offset="1" stop-color="#14170f"/></linearGradient>
<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="8" fill="#9BE33B" fill-opacity=".16"/></pattern>
</defs></svg>
${styleBoard()}
<section class="phones">
${PHONES.map(([n, t, s, notes]) => `<div class="ph"><div class="ph-h"><i>${n}</i><b>${t}</b></div><div class="bezel">${s}</div><ul>${notes.filter(Boolean).map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join('\n')}
</section>
</body></html>`;

writeFileSync(OUT, html);
console.log('ok', html.length);
