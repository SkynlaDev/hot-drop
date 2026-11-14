// Champ de saisie posé par-dessus le canevas (Phaser n'a pas de champ texte) : un vrai <input> HTML, au style du
// jeu, placé sur la zone (x, y, w, h) en coordonnées du jeu. Il ouvre le clavier sur mobile. Entrée ou perte du
// focus : valide ; Échap : annule. Le champ disparaît ensuite.
import Phaser from 'phaser';
import { TITLE_FONT } from '../config';

export function editText(
  scene: Phaser.Scene,
  box: { x: number; y: number; w: number; h: number },
  value: string,
  opts: { max?: number; size?: number; color?: string; upper?: boolean },
  done: (v: string | null) => void,
): void {
  const canvas = scene.game.canvas;
  const r = canvas.getBoundingClientRect();
  const k = r.width / scene.scale.width;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.maxLength = opts.max ?? 16;
  input.autocomplete = 'off';
  input.spellcheck = false;
  Object.assign(input.style, {
    position: 'fixed',
    left: `${r.left + box.x * k}px`,
    top: `${r.top + box.y * k}px`,
    width: `${box.w * k}px`,
    height: `${box.h * k}px`,
    font: `${(opts.size ?? 40) * k}px ${TITLE_FONT}`,
    color: opts.color ?? '#e8894a',
    background: 'rgba(15, 13, 19, 0.92)',
    border: 'none',
    borderBottom: `${Math.max(2, 3 * k)}px solid ${opts.color ?? '#e8894a'}`,
    outline: 'none',
    padding: `0 ${8 * k}px`,
    boxSizing: 'border-box',
    textTransform: opts.upper ? 'uppercase' : 'none',
    zIndex: '10',
  } satisfies Partial<CSSStyleDeclaration>);
  let closed = false;
  const close = (v: string | null) => {
    if (closed) return;
    closed = true;
    input.remove();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
    done(v);
  };
  const cancel = () => close(null);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') close(input.value);
    else if (e.key === 'Escape') close(null);
  });
  input.addEventListener('blur', () => close(input.value));
  // Changement de scène : on retire le champ sans rien valider.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
  document.body.appendChild(input);
  input.focus();
  input.select();
}
