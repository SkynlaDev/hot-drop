// Personnages et scènes de combat de la maquette HOT DROP.
// Figures en SVG construites par « squelette » : articulations calculées (cinématique inverse
// à deux segments), membres en traits épais effilés, équipement superposé. Proportions ≈ 8 têtes.
// Repère d'une figure : pieds à l'origine, x vers l'avant (la figure regarde à droite), y vers le bas.

const r1 = (n) => Math.round(n * 100) / 100;
const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;

// ---------- Palettes par type ----------
export const KINDS = {
  op: {
    name: 'Viper', role: 'Opérateur (toi)',
    pal: { uni: '#7d7356', uni2: '#5b5440', pants: '#6c6450', rig: '#4b5236', rig2: '#363b27', helm: '#6e684e', skin: '#a77d5d', glove: '#2a2a24', boot: '#2b2620' },
    head: 'helmet', rig: 'plate', weapon: 'carbine', bulk: 1, armband: false,
    cue: 'Casque à rail et casque audio, porte-plaques vert, carabine à optique',
  },
  mil: {
    name: 'Milicien', role: 'Ennemi de base',
    pal: { uni: '#6a5644', uni2: '#4a3d31', pants: '#3a4554', rig: '#4a4836', rig2: '#302f24', helm: '#1d1d1c', skin: '#8f6c51', glove: '#1f1f1d', boot: '#1f1c19' },
    head: 'balaclava', rig: 'chest', weapon: 'ak', bulk: 1, armband: true,
    cue: 'Cagoule, veste civile, jean, gilet de chargeurs léger, AK à crosse bois',
  },
  mitr: {
    name: 'Mitrailleur', role: 'Tient la ligne · armure 10',
    pal: { uni: '#4c4a3c', uni2: '#36352b', pants: '#3b3a30', rig: '#2f3128', rig2: '#22241d', helm: '#2e302a', skin: '#8f6c51', glove: '#1f1f1d', boot: '#1f1c19' },
    head: 'helmetPlain', rig: 'heavy', weapon: 'lmg', bulk: 1.18, armband: true, belt: true, hold: 'hip',
    cue: 'Silhouette massive, mitrailleuse à la hanche, bande de cartouches en bandoulière',
  },
  tir: {
    name: 'Tireur', role: 'Tire en premier',
    pal: { uni: '#4f4d36', uni2: '#3a3928', pants: '#46442f', rig: '#3a3a28', rig2: '#2b2b1e', helm: '#4f4d36', skin: '#8f6c51', glove: '#1f1f1d', boot: '#1f1c19' },
    head: 'hood', rig: 'chest', weapon: 'sniper', bulk: 1, armband: true,
    cue: 'Couché, capuche camouflée effilochée, long fusil à lunette sur bipied',
  },
  lt: {
    name: 'Lieutenant', role: 'Gardien de zone · armure 12',
    pal: { uni: '#3f4a4c', uni2: '#2d3537', pants: '#394244', rig: '#2a2f2c', rig2: '#1e2220', helm: '#2a302f', skin: '#8f6c51', glove: '#1f1f1d', boot: '#1f1c19' },
    head: 'helmet', rig: 'plate', weapon: 'carbine', bulk: 1.05, armband: true, radio: true,
    cue: 'Casque complet, porte-plaques, radio dorsale à antenne : il commande',
  },
  kesh: {
    name: 'Cdt Kesh', role: 'Boss final · armure 40',
    pal: { uni: '#3a3d40', uni2: '#2a2c2f', pants: '#34373a', rig: '#4d5154', rig2: '#2e3133', helm: '#4d5154', skin: '#7d5d46', glove: '#151515', boot: '#151515' },
    head: 'kesh', rig: 'juggernaut', weapon: 'shotgun', bulk: 1.3, armband: true, hold: 'hip', scale: 1.1,
    cue: 'Blindage lourd, épaulières, casque à visière fendue rouge, fusil à pompe à tambour',
  },
};

// ---------- Armes (origine = talon de crosse, x vers la bouche) ----------
const MET = '#1b1c1a';
const WEAPONS = {
  carbine: { trig: 14, sup: 31, muzzle: 45, body: `
    <path d="M0 -2.2 L9 -3 L9 2.6 L1.5 4.4 L0 3.6 Z"/><rect x="9" y="-1.6" width="5" height="2.6"/>
    <path d="M14 -3.2 H29 V1.8 H14 Z"/><path d="M19.6 1.8 H23.6 L24.8 9.6 L21 10.2 Z"/>
    <path d="M14.6 1.8 H17.8 L16.3 8.2 L13.2 7.8 Z"/><path d="M29 -2.9 H39.5 V1.6 H29 Z" fill="#262826"/>
    <rect x="39.5" y="-1.2" width="5.5" height="1.7"/><path d="M17.5 -3.2 V-6.9 H25.6 V-3.2 Z"/>
    <rect x="25" y="-6.3" width="0.9" height="2.7" fill="#7fd8ff" opacity=".75"/>
    <path d="M1 -2.1 L9 -2.9 H29 M29.3 -2.7 H39.3" stroke="#6d6f68" stroke-width=".55" fill="none"/>` },
  ak: { trig: 14, sup: 30, muzzle: 44, body: `
    <path d="M0 -1.6 L11.5 -2.6 L13.5 1 L1.5 5.6 L0 4.6 Z" fill="#6a4426"/>
    <path d="M12.5 -3.2 H27.5 V1.6 H12.5 Z"/>
    <path d="M18.5 1.6 L22.8 1.6 Q24.2 6 27.4 9.8 L23.8 11.4 Q20.2 7.2 18.5 1.6 Z"/>
    <path d="M13.6 1.6 H16.6 L15.2 7.8 L12.2 7.4 Z"/><path d="M27.5 -2.7 H34.5 V1.4 H27.5 Z" fill="#6a4426"/>
    <rect x="34.5" y="-1.7" width="9.5" height="1.4"/><rect x="40.6" y="-3.6" width="0.9" height="2"/>
    <path d="M12.5 -3 H27.5" stroke="#6d6f68" stroke-width=".55"/>` },
  sniper: { trig: 15, sup: 7, muzzle: 58, body: `
    <path d="M0 -2 L13 -3.2 L14.5 2 L2 5 L0 4 Z"/><path d="M13 -3.2 H31 V1.6 H13 Z"/>
    <path d="M14.5 -4.2 H31 V-8 H14.5 Z"/><path d="M12.5 -8.6 H15.5 V-3.6 H12.5 Z M30 -8.8 H33.4 V-3.4 H30 Z"/>
    <rect x="33" y="-8.2" width=".9" height="4.2" fill="#9ee6ff" opacity=".8"/>
    <path d="M15 1.6 H18 L16.6 7.5 L13.7 7.1 Z"/><rect x="21" y="1.6" width="4" height="4"/>
    <rect x="31" y="-1.5" width="27" height="1.8"/>
    <path d="M42 0.5 L46 10 M42 0.5 L38.5 10" stroke="${MET}" stroke-width="1.2" fill="none"/>
    <path d="M13 -3 H31 M15 -7.7 H30" stroke="#6d6f68" stroke-width=".5" fill="none"/>` },
  lmg: { trig: 14, sup: 29, muzzle: 50, body: `
    <path d="M0 -2.6 L10 -3.8 L10 3.2 L0 5 Z"/><path d="M10 -4.2 H29 V2.6 H10 Z"/>
    <rect x="14" y="2.6" width="8.5" height="8" rx="1" fill="#2c2f2a"/>
    <path d="M17 -4.2 V-6.8 H25 V-4.2" stroke="${MET}" stroke-width="1.3" fill="none"/>
    <path d="M14.6 2.6 H17.6 L16.2 8.6 L13.2 8.2 Z"/><rect x="29" y="-2.6" width="21" height="3"/>
    <rect x="29" y="-3.4" width="11" height="4.6" fill="#262826"/>
    <path d="M22.5 6 Q26 14 20 18" stroke="#b08a3c" stroke-width="2.2" stroke-dasharray="1.1 .6" fill="none"/>
    <path d="M10 -4 H29" stroke="#6d6f68" stroke-width=".55"/>` },
  shotgun: { trig: 13, sup: 27, muzzle: 42, body: `
    <path d="M0 -2.4 L10 -3.4 L10 3 L0 5 Z"/><path d="M10 -3.8 H27 V2.4 H10 Z"/>
    <circle cx="19.5" cy="7.4" r="5.4" fill="#2a2c2a" stroke="${MET}" stroke-width="1"/><circle cx="19.5" cy="7.4" r="1.6" fill="#111"/>
    <path d="M10.6 2.4 H13.6 L12.2 8.4 L9.2 8 Z"/><rect x="27" y="-3" width="15" height="4"/>
    <rect x="27" y="1" width="12" height="2" fill="#262826"/>
    <path d="M10 -3.6 H27" stroke="#6d6f68" stroke-width=".55"/>` },
};

// ---------- Outils géométriques ----------
function ik(S, H, L1, L2, pick) {
  const dx = H[0] - S[0], dy = H[1] - S[1];
  let d = Math.hypot(dx, dy);
  d = Math.max(0.01, Math.min(d, L1 + L2 - 0.01));
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const ux = dx / Math.hypot(dx, dy), uy = dy / Math.hypot(dx, dy);
  const px = S[0] + a * ux, py = S[1] + a * uy;
  const e1 = [px - h * uy, py + h * ux], e2 = [px + h * uy, py - h * ux];
  return pick(e1, e2);
}
const lower = (a, b) => (a[1] > b[1] ? a : b);
const fwd = (a, b) => (a[0] > b[0] ? a : b);
const rotP = (p, deg) => { const t = (deg * Math.PI) / 180; return [p[0] * Math.cos(t) - p[1] * Math.sin(t), p[0] * Math.sin(t) + p[1] * Math.cos(t)]; };
const seg = (a, b, w, c) => `<path d="M${pt(a)}L${pt(b)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
function shade(hex, f) {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return '#' + n.map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');
}

// ---------- Têtes ----------
function headGear(k, P) {
  const face = `<rect x="3" y="-35" width="4" height="4.2" fill="${shade(P.skin, 0.8)}"/><circle cx="5.6" cy="-38.6" r="5.2" fill="${P.skin}"/>`;
  switch (k.head) {
    case 'helmet':
      return face + `<path d="M8.4 -39.6 h3.4 v1.9 h-3.4z" fill="#141414"/>
        <path d="M-0.6 -38.6 Q-0.6 -46 6 -46 Q12.2 -46 12.2 -39.6 L11.8 -38 L5 -38.8 L-0.6 -37.4 Z" fill="${P.helm}"/>
        <path d="M0.6 -42.5 Q3 -45.4 7.5 -45.3" stroke="${shade(P.helm, 1.35)}" stroke-width=".8" fill="none"/>
        <rect x="9.6" y="-44.6" width="2.8" height="2.3" rx=".5" fill="#232323"/>
        <circle cx="4.2" cy="-37.4" r="2.3" fill="#262624"/><path d="M5 -38 L8 -33.5" stroke="#262624" stroke-width=".8"/>`;
    case 'helmetPlain':
      return face + `<path d="M8.6 -39.4 h3.2 v1.6 h-3.2z" fill="#141414"/>
        <path d="M-0.8 -38.4 Q-0.8 -46.2 6 -46.2 Q12.4 -46.2 12.4 -39 L12.6 -37.6 L-1 -37.2 Z" fill="${P.helm}"/>
        <path d="M0.5 -42.5 Q3 -45.5 7.5 -45.5" stroke="${shade(P.helm, 1.4)}" stroke-width=".8" fill="none"/>`;
    case 'balaclava':
      return `<rect x="3" y="-35" width="4.2" height="4.4" fill="#1b1b1b"/><circle cx="5.6" cy="-38.6" r="5.3" fill="#1d1d1d"/>
        <rect x="7.4" y="-40.4" width="3.9" height="1.7" rx=".6" fill="${P.skin}"/>
        <path d="M1.2 -42.6 Q4 -44.6 8.4 -43.6" stroke="#333" stroke-width=".7" fill="none"/>`;
    case 'hood': {
      let fr = 'M-2 -33';
      for (let i = 0; i <= 10; i++) { const x = -2 + i * 1.5; fr += ` L${x} ${-44 - (i % 2 ? 2.6 : 0) + Math.abs(5 - i) * 0.5}`; }
      return face + `<path d="M8.6 -39.6 h3 v1.6 h-3z" fill="#141414"/>
        <path d="${fr} L13 -38 L11.8 -34 Q6 -36 3 -31 Z" fill="${P.uni}"/>`;
    }
    case 'kesh':
      return `<rect x="2.5" y="-35" width="5" height="4.5" fill="#1a1a1a"/>
        <path d="M-1.8 -36.6 Q-1.8 -48.6 6 -48.6 Q14 -48.6 14 -38.6 L13.4 -32.4 L-1.4 -32.4 Z" fill="${P.helm}"/>
        <path d="M8 -42.4 H14 V-36.4 H8.6 Z" fill="#0b0b0b"/><path d="M8.8 -39.6 H13.8" stroke="#ff4a4f" stroke-width="1"/>
        <path d="M0 -44 Q4 -47.6 9 -47.2" stroke="${shade(P.helm, 1.45)}" stroke-width=".9" fill="none"/>`;
  }
  return face;
}

// ---------- Torse et équipement ----------
function torso(k, P) {
  const b = k.bulk || 1;
  let s = `<g transform="translate(1 0) scale(${b} 1) translate(-1 0)">`;
  s += `<path d="M-5 1 C-7 -10 -7 -20 -6 -27 Q-4 -32 1 -33 Q7 -32 8 -27 C8.6 -18 7 -8 6 1 Z" fill="${P.uni}"/>`;
  if (k.rig === 'plate') {
    s += `<path d="M-6.6 -27 L9 -27.5 L9.7 -12 L-7 -12 Z" fill="${P.rig}"/>
      <rect x="8.7" y="-24.5" width="2.9" height="10" rx=".8" fill="${P.rig2}"/>
      <path d="M-6 -21 H9 M-6 -17 H9" stroke="${P.rig2}" stroke-width=".7"/>
      <path d="M-2.4 -27 L0.8 -32" stroke="${P.rig}" stroke-width="2.6"/>
      <path d="M-6.4 -26.6 L9 -27.1" stroke="${shade(P.rig, 1.4)}" stroke-width=".6"/>`;
  } else if (k.rig === 'chest') {
    s += `<path d="M-6 -29 Q-1 -31 4 -30" stroke="${shade(P.uni, 0.75)}" stroke-width="2.2" fill="none"/>
      <path d="M2.6 -24 L9.3 -24.4 L9.8 -15 L2.6 -15 Z" fill="${P.rig}"/>
      <path d="M9.2 -23.6 h1.8 v7.6 h-1.8z" fill="${P.rig2}"/><path d="M-3 -30 L5 -16" stroke="${P.rig}" stroke-width="1.4"/>`;
  } else if (k.rig === 'heavy') {
    s += `<path d="M-7.6 -28.4 L10.6 -28.8 L11.6 -8 L-8 -8 Z" fill="${P.rig}"/>
      <path d="M10.6 -25 h2.6 v12 h-2.6z" fill="${P.rig2}"/><path d="M-7 -20 H11 M-7 -15 H11" stroke="${P.rig2}" stroke-width=".8"/>
      <path d="M-7.3 -28 L10.4 -28.4" stroke="${shade(P.rig, 1.45)}" stroke-width=".6"/>`;
  } else if (k.rig === 'juggernaut') {
    s += `<path d="M-8.4 -29 L11.6 -29.4 L12.6 -6 L-8.8 -6 Z" fill="${P.rig}"/>
      <path d="M2 -6 H10 L8.4 1.6 H3.4 Z" fill="${P.rig2}"/>
      <path d="M-8 -22 H12 M-8 -14 H12.4" stroke="${P.rig2}" stroke-width="1"/>
      <path d="M-8 -28.6 L11.4 -29" stroke="${shade(P.rig, 1.5)}" stroke-width=".7"/>
      <rect x="9" y="-26" width="3" height="3" fill="#E5484D" opacity=".85"/>`;
  }
  if (k.belt) s += `<path d="M-6.5 -28 L10 -10" stroke="#b08a3c" stroke-width="2.4" stroke-dasharray="1.2 .7"/>`;
  s += `<rect x="-6" y="-4" width="13.6" height="3.6" fill="#1b1b19"/>`;
  return s + '</g>';
}

// ---------- Haut du corps (repère : bassin à l'origine) ----------
function upperBody(k, P) {
  const W = WEAPONS[k.weapon];
  const hip = k.hold === 'hip';
  const o = hip ? [-1.5, -17] : [2, -28.6];
  const ang = hip ? -4 : -1.5;
  const wp = (x, y) => { const q = rotP([x, y], ang); return [o[0] + q[0], o[1] + q[1]]; };
  const shN = [1.2, -29.5], shF = [4.4, -30.4];
  const hT = wp(W.trig, 3.6), hS = wp(W.sup, 0.9);
  const eN = ik(shN, hT, 13.5, 14, lower), eF = ik(shF, hS, 14.5, 14.5, lower);
  let s = '';
  // bras arrière
  s += seg(shF, eF, 5.6, P.uni2) + seg(eF, hS, 4.6, P.uni2) + `<circle cx="${r1(hS[0])}" cy="${r1(hS[1])}" r="2.4" fill="${shade(P.glove, 0.8)}"/>`;
  if (k.radio) s += `<rect x="-12" y="-29" width="6" height="17" rx="1.2" fill="${P.rig2}"/><path d="M-10 -29 L-14.5 -55" stroke="#111" stroke-width=".8"/><circle cx="-14.5" cy="-55" r=".9" fill="#111"/>`;
  if (k.rig === 'juggernaut') s += `<path d="M-2 -33 Q6 -36.5 9 -28 L-1.5 -25 Z" fill="${P.rig2}"/>`;
  s += torso(k, P) + headGear(k, P);
  s += `<g transform="translate(${pt(o)}) rotate(${ang})" fill="${MET}">${W.body}</g>`;
  // bras avant
  s += seg(shN, eN, 6.2, P.uni) + seg(eN, hT, 5.2, P.uni) + `<circle cx="${r1(hT[0])}" cy="${r1(hT[1])}" r="2.6" fill="${P.glove}"/>`;
  if (k.rig === 'juggernaut') s += `<path d="M-3 -32 Q4 -35.5 7.5 -27.5 Q3 -24 -2.6 -25.5 Z" fill="${P.rig}"/><path d="M-2 -31 Q3 -33.6 6 -28" stroke="${shade(P.rig, 1.5)}" stroke-width=".7" fill="none"/>`;
  if (k.armband) { const a = [shN[0] + (eN[0] - shN[0]) * 0.35, shN[1] + (eN[1] - shN[1]) * 0.35], b = [shN[0] + (eN[0] - shN[0]) * 0.6, shN[1] + (eN[1] - shN[1]) * 0.6]; s += seg(a, b, 6.4, '#a8323a'); }
  return { svg: s, muzzle: wp(W.muzzle, -0.4) };
}

function boot(a, P, back = false) {
  if (back) return `<path d="M${r1(a[0] - 2.8)} ${r1(a[1] - 3)} L${r1(a[0] + 2)} ${r1(a[1] - 3.4)} L${r1(a[0] + 2.4)} ${r1(a[1] + 2.4)} L${r1(a[0] - 3.4)} ${r1(a[1] + 2.4)} Z" fill="${P.boot}"/>`;
  return `<path d="M${r1(a[0] - 2.8)} ${r1(a[1] - 3.2)} L${r1(a[0] + 3)} ${r1(a[1] - 2.8)} L${r1(a[0] + 7.2)} ${r1(a[1] - 0.4)} L${r1(a[0] + 7.2)} ${r1(a[1] + 2.4)} L${r1(a[0] - 3)} ${r1(a[1] + 2.4)} Z" fill="${P.boot}"/>`;
}

/** Figure complète. Retourne le SVG et des points utiles en coordonnées du monde. */
export function figure(kindId, pose, X, Y, s, { flip = false, rim = 'rimW', dim = false } = {}) {
  const k = KINDS[kindId];
  const P = k.pal;
  s *= k.scale || 1;
  const sx = flip ? -s : s;
  const W2 = (p) => [X + sx * p[0], Y + s * p[1]];
  const pantsF = shade(P.pants, 0.72);
  let body = '', muzzle, head, chest;
  if (pose === 'prone') {
    // Couché, appuyé sur les coudes, fusil sur bipied
    body += seg([-21, -4.5], [-38, -3.6], 8, pantsF) + seg([-38, -3.6], [-55, -2.6], 6.4, pantsF) + boot([-57, -3], P, true);
    body += seg([-20, -6], [-37, -6.2], 8.4, P.pants) + seg([-37, -6.2], [-54, -4.8], 6.8, P.pants) + boot([-56, -5.4], P, true);
    body += `<path d="M-24 -1.5 L-21 -11 L9 -15 L12 -6.5 L-22 0 Z" fill="${P.uni}"/>`;
    body += `<path d="M-6 -13.4 L9.4 -15 L11.4 -7.6 L-6 -5.5 Z" fill="${P.rig}"/>`;
    let fr = 'M-24 -10';
    for (let i = 0; i <= 16; i++) fr += ` L${r1(-24 + i * 2.1)} ${r1(-11.5 - (i % 2 ? 1.3 : 0) - i * 0.2)}`;
    body += `<path d="${fr} L9 -15 L8 -10 L-22 -6 Z" fill="${shade(P.uni, 0.88)}"/>`;
    body += seg([3, -12], [9, -1.2], 5.4, P.uni2) + seg([9, -1.2], [22, -9.6], 4.6, P.uni2);
    // tête relevée
    body += `<g transform="translate(12 -16.5)"><circle cx="2.4" cy="-1" r="5.2" fill="${P.skin}"/><path d="M4.4 -2.2 h3 v1.6 h-3z" fill="#141414"/>`;
    body += `<path d="M-4 3 Q-4.6 -7 2.6 -7.4 Q7.6 -7.4 8 -3 L5.4 -2.4 Q3 -4 1 -1 L0 3 Z" fill="${P.uni}"/><path d="M-3 -2 l-1.4 -1.6 M-1 -5.6 l-.8 -1.8 M2 -7 l.2 -1.8" stroke="${P.uni}" stroke-width=".9"/></g>`;
    const o = [13, -12.6];
    body += `<g transform="translate(${pt(o)})" fill="${MET}">${WEAPONS.sniper.body}</g>`;
    body += seg([6, -12], [14, -1.4], 6, P.uni) + seg([14, -1.4], [26, -9.4], 5, P.uni) + `<circle cx="26" cy="-9.4" r="2.5" fill="${P.glove}"/>`;
    if (k.armband) body += seg([8, -9], [10.4, -5.6], 6.4, '#a8323a');
    muzzle = W2([o[0] + 58, o[1] - 0.4]);
    head = W2([14, -26]);
    chest = W2([0, -10]);
  } else {
    let pelvis, lean = 0;
    if (pose === 'kneel') {
      pelvis = [0, -31]; lean = 7;
      body += seg([-1, -31], [-4.5, -3.4], 8.6, pantsF) + seg([-4.5, -3.4], [-20, -4], 6.8, pantsF) + boot([-21.5, -3.2], P, true);
      body += `<circle cx="-4.5" cy="-3.4" r="3.3" fill="${P.rig2}"/>`;
      body += seg([2, -31], [18, -26.5], 9, P.pants) + seg([18, -26.5], [15.5, -3], 7, P.pants) + boot([15.5, -2.4], P);
      body += `<circle cx="18.6" cy="-26.4" r="3.5" fill="${P.rig2}"/>`;
    } else {
      pelvis = [0, -49];
      const aF = [-11, -2.4], aN = [12, -2.4];
      const kF = ik([-1, -49], aF, 24.5, 24, fwd), kN = ik([2, -49], aN, 24.5, 24, fwd);
      const lb = k.bulk || 1;
      body += seg([-1, -49], kF, 8.8 * lb, pantsF) + seg(kF, aF, 6.8 * lb, pantsF) + boot(aF, P);
      body += seg([2, -49], kN, 9.2 * lb, P.pants) + seg(kN, aN, 7.2 * lb, P.pants) + boot(aN, P);
      if (k.rig !== 'chest') body += `<circle cx="${r1(kN[0] + 1.2)}" cy="${r1(kN[1])}" r="3.4" fill="${P.rig2}"/>`;
      if (k.rig === 'juggernaut') body += `<path d="M${r1(kN[0] - 1)} ${r1(kN[1] - 2)} l5 1 l-1 14 l-4.6 0 z" fill="${P.rig}"/>`;
    }
    const ub = upperBody(k, P);
    body += `<g transform="translate(${pt(pelvis)}) rotate(${lean})">${ub.svg}</g>`;
    const m = rotP(ub.muzzle, lean);
    muzzle = W2([pelvis[0] + m[0], pelvis[1] + m[1]]);
    const h = rotP([5.6, -46], lean);
    head = W2([pelvis[0] + h[0], pelvis[1] + h[1]]);
    const c = rotP([2, -20], lean);
    chest = W2([pelvis[0] + c[0], pelvis[1] + c[1]]);
  }
  const shadowW = pose === 'prone' ? 40 : 17;
  const shadow = pose === 'prone' ? '' : `<ellipse cx="${r1(X)}" cy="${r1(Y + 1.2)}" rx="${r1(shadowW * s)}" ry="${r1(2.6 * s)}" fill="#000" opacity=".5" filter="url(#softblur)"/>`;
  let g = `<g transform="translate(${r1(X)} ${r1(Y)}) scale(${r1(sx)} ${r1(s)})">${body}</g>`;
  if (dim) g = `<g opacity=".5" filter="url(#desat)"><g transform="translate(${r1(X)} ${r1(Y)}) rotate(-90) translate(${r1(-X)} ${r1(-Y)})">${g}</g></g>`;
  const svg = `${dim ? '' : shadow}<g filter="url(#${rim})">${g}</g>`;
  return { svg, muzzle, head, chest };
}

// ---------- Effets ----------
export const flash = (p, size = 1, dir = 1) => {
  const [x, y] = p;
  return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${dir * size} ${size})"><circle r="7" fill="#FFB347" opacity=".35" filter="url(#softblur)"/>
  <path d="M0 -2.2 L9 -0.6 L16 0 L9 0.6 L0 2.2 L3 0 Z" fill="#FFE7A8"/><path d="M0 0 L5 -5 L3 -1 Z M0 0 L5 5 L3 1 Z" fill="#FFC56E"/><circle r="2.4" fill="#fff8e0"/></g>`;
};
export const tracer = (a, b, color = '#FFE7A8', w = 1.6, frac = 0.55) => {
  const s = [a[0] + (b[0] - a[0]) * (1 - frac), a[1] + (b[1] - a[1]) * (1 - frac)];
  const dx = b[0] - s[0], dy = b[1] - s[1], L = Math.hypot(dx, dy), nx = -dy / L * w / 2, ny = dx / L * w / 2;
  return `<path d="M${r1(s[0])} ${r1(s[1])} L${r1(b[0] + nx)} ${r1(b[1] + ny)} L${r1(b[0] - nx)} ${r1(b[1] - ny)} Z" fill="${color}" opacity=".9"/><circle cx="${r1(b[0])}" cy="${r1(b[1])}" r="${w * 0.75}" fill="#fff"/>`;
};
export const sparks = (p, color = '#FFE7A8', n = 7) => {
  let s = `<g transform="translate(${r1(p[0])} ${r1(p[1])})">`;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.3; const l = 4 + (i % 3) * 2.2; s += `<line x1="${r1(Math.cos(a) * 1.5)}" y1="${r1(Math.sin(a) * 1.5)}" x2="${r1(Math.cos(a) * l)}" y2="${r1(Math.sin(a) * l)}" stroke="${color}" stroke-width=".9" stroke-linecap="round"/>`; }
  return s + `<circle r="1.8" fill="#fff"/></g>`;
};
export const puff = (p, r = 6, c = '#a9a294') => `<g transform="translate(${r1(p[0])} ${r1(p[1])})" filter="url(#softblur)" fill="${c}" opacity=".55"><circle r="${r}"/><circle cx="${r * 0.8}" cy="${-r * 0.5}" r="${r * 0.7}"/><circle cx="${-r * 0.7}" cy="${-r * 0.3}" r="${r * 0.6}"/></g>`;
export const explosion = (p, s = 1) => `<g transform="translate(${r1(p[0])} ${r1(p[1])}) scale(${s})">
  <circle r="22" fill="#FF8C1A" opacity=".22" filter="url(#softblur)"/><g fill="#5b5248" opacity=".75" filter="url(#softblur)"><circle cx="-8" cy="-10" r="9"/><circle cx="6" cy="-13" r="10"/><circle cx="12" cy="-4" r="7"/></g>
  <path d="M0 -15 4 -5 14 -9 7 0 15 9 3 5 -2 15 -5 5 -15 7 -8 -1 -14 -10 -3 -6z" fill="#FF9A2E"/><path d="M0 -8 2.4 -2.6 8 -4 4 1 7 6 1 3 -1 8 -3 3 -8 4 -4 -1 -7 -5 -1.6 -3z" fill="#FFE7A8"/>
  ${[0, 1, 2, 3, 4, 5, 6].map((i) => { const a = i * 0.9 + 0.2; return `<line x1="${r1(Math.cos(a) * 10)}" y1="${r1(Math.sin(a) * 10)}" x2="${r1(Math.cos(a) * 20)}" y2="${r1(Math.sin(a) * 20)}" stroke="#FFD08A" stroke-width=".8"/>`; }).join('')}</g>`;
export const casings = (p) => [0, 1, 2].map((i) => `<rect x="${r1(p[0] - 2 - i * 3)}" y="${r1(p[1] - 6 - i * 4 + i * i * 1.6)}" width="2.2" height="1" rx=".4" fill="#d9b86c" transform="rotate(${30 + i * 40} ${r1(p[0] - 2 - i * 3)} ${r1(p[1] - 6 - i * 4)})"/>`).join('');

// ---------- Décors ----------
export function sandbags(x, y, cols, rows, c = '#6f6650') {
  let s = '';
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols - (r % 2); i++) {
    const bx = x + i * 13 + (r % 2) * 6.5, by = y - r * 7.4;
    s += `<rect x="${bx}" y="${by - 8}" width="13.6" height="8.4" rx="3.6" fill="${shade(c, 1 - r * 0.04)}" stroke="#00000055" stroke-width=".6"/><path d="M${bx + 2} ${by - 6.6} Q${bx + 7} ${by - 8.4} ${bx + 12} ${by - 6.6}" stroke="${shade(c, 1.35)}" stroke-width=".8" fill="none"/>`;
  }
  return s;
}
export function jersey(x, y, w, h, c = '#77746b') {
  return `<path d="M${x} ${y} L${x + w * 0.12} ${y - h * 0.55} L${x + w * 0.3} ${y - h} H${x + w * 0.7} L${x + w * 0.88} ${y - h * 0.55} L${x + w} ${y} Z" fill="${c}"/>
  <path d="M${x + w * 0.3} ${y - h} H${x + w * 0.7}" stroke="${shade(c, 1.4)}" stroke-width="1.2"/><path d="M${x + w * 0.88} ${y - h * 0.55} L${x + w} ${y} L${x + w * 0.7} ${y} Z" fill="#00000030"/>
  <path d="M${x + w * 0.2} ${y - h * 0.5} h${w * 0.2}" stroke="#E8A33D" stroke-width="2" opacity=".55"/>`;
}
export function container(x, y, w, h, c = '#2f4a4f') {
  let s = `<path d="M${x + 6} ${y - h - 6} H${x + w + 6} L${x + w} ${y - h} H${x} Z" fill="${shade(c, 1.35)}"/>`;
  s += `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${c}"/>`;
  for (let i = 4; i < w; i += 5) s += `<path d="M${x + i} ${y - h + 2} V${y - 2}" stroke="${shade(c, 0.7)}" stroke-width="1.6"/>`;
  s += `<path d="M${x + w} ${y - h} L${x + w + 6} ${y - h - 6} V${y - 6} L${x + w} ${y} Z" fill="${shade(c, 0.6)}"/>`;
  s += `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="url(#ctnShade)"/>`;
  s += `<text x="${x + 8}" y="${y - h + 12}" font-family="Arial Narrow, sans-serif" font-weight="700" font-size="7" fill="#ffffff" opacity=".28" letter-spacing="1">VSTR 40 HC</text>`;
  return s;
}
export function drums(x, y, n = 2, c = '#5a2f22') {
  let s = '';
  for (let i = 0; i < n; i++) { const bx = x + i * 13; s += `<rect x="${bx}" y="${y - 20}" width="12" height="20" rx="1.5" fill="${shade(c, 1 - i * 0.1)}"/><path d="M${bx} ${y - 14} h12 M${bx} ${y - 7} h12" stroke="${shade(c, 0.6)}" stroke-width="1"/><ellipse cx="${bx + 6}" cy="${y - 20}" rx="6" ry="1.6" fill="${shade(c, 1.3)}"/>`; }
  return s;
}

/** Filtres et dégradés partagés par les scènes (à insérer dans les <defs> globaux). */
export const FIG_DEFS = `
<filter id="rimW" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
 <feOffset in="SourceAlpha" dx="-1.3" dy="0.7" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out" result="e"/>
 <feFlood flood-color="#FFB46A" flood-opacity=".95"/><feComposite in2="e" operator="in" result="rim"/>
 <feOffset in="SourceAlpha" dx="2.2" dy="-0.6" result="o2"/><feComposite in="SourceAlpha" in2="o2" operator="out" result="e2"/>
 <feFlood flood-color="#000" flood-opacity=".35"/><feComposite in2="e2" operator="in" result="occ"/>
 <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="occ"/><feMergeNode in="rim"/></feMerge></filter>
<filter id="rimC" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
 <feOffset in="SourceAlpha" dx="-1.3" dy="1" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out" result="e"/>
 <feFlood flood-color="#BFD8FF" flood-opacity=".55"/><feComposite in2="e" operator="in" result="rim"/>
 <feOffset in="SourceAlpha" dx="2.2" dy="-0.6" result="o2"/><feComposite in="SourceAlpha" in2="o2" operator="out" result="e2"/>
 <feFlood flood-color="#000" flood-opacity=".4"/><feComposite in2="e2" operator="in" result="occ"/>
 <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="occ"/><feMergeNode in="rim"/></feMerge></filter>
<filter id="softblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4"/></filter>
<filter id="dof" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter>
<filter id="haze"><feGaussianBlur stdDeviation=".6"/></filter>
<filter id="desat"><feColorMatrix type="saturate" values=".15"/></filter>
<linearGradient id="trg" x1="0" x2="1"><stop offset="0" stop-color="#FFE7A8" stop-opacity="0"/><stop offset="1" stop-color="#FFF4D0"/></linearGradient>
<linearGradient id="ctnShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
`;
