// Icônes de la maquette (design/mockups/build.mjs), reprises pour le jeu.
export const S = 'stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"';
export const ICONS = {
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

