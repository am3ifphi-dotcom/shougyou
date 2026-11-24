// Keyboard + gamepad input.  No mouse-hover UI.  The first input unlocks audio.

const PREVENT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Escape', 'Backspace',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyQ', 'KeyE', 'KeyP', 'KeyF', 'KeyR',
  'Digit1', 'Digit2', 'Digit3', 'Tab', 'F3',
]);

const KEYMAP = {
  ArrowUp: ['up'], KeyW: ['up'],
  ArrowDown: ['down'], KeyS: ['down'],
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  Enter: ['confirm'], Space: ['confirm', 'advance'], KeyZ: ['confirm'],
  Escape: ['cancel'], KeyX: ['cancel'], Backspace: ['cancel'],
  KeyP: ['pause'], KeyQ: ['essence'], KeyE: ['noise'],
  Digit1: ['skill1'], Digit2: ['skill2'], Digit3: ['skill3'],
  KeyF: ['fullscreen'], F3: ['debug'], KeyR: ['restart'],
};

export class Input {
  constructor(audio, onFirst = null) {
    this.audio = audio;
    this.onFirst = onFirst;
    this.queue = [];
    this.keys = new Set();
    this.held = new Set();
    this.lastDevice = 'keyboard';
    this.firstDone = false;
    this.padPrev = [];
    this.padRepeat = 0;
    this.bind();
  }

  first() {
    if (!this.firstDone) {
      this.firstDone = true;
      this.audio.unlock();
      this.onFirst?.();
    }
  }

  push(a) { if (Array.isArray(a)) this.queue.push(...a); else if (a) this.queue.push(a); }

  bind() {
    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      this.lastDevice = 'keyboard';
      this.first();
      const acts = KEYMAP[e.code];
      if (!acts) { this.push('any'); return; }
      if (e.repeat && !acts.some((a) => ['up', 'down', 'left', 'right'].includes(a))) return;
      this.keys.add(e.code);
      for (const a of acts) this.held.add(a);
      this.push(['any', ...acts]);
    }, { passive: false });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const acts = KEYMAP[e.code] || [];
      for (const a of acts) this.held.delete(a);
    });
    window.addEventListener('pointerdown', (e) => { this.lastDevice = 'keyboard'; this.first(); }, { passive: true });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('selectstart', (e) => e.preventDefault());
    window.addEventListener('dragstart', (e) => e.preventDefault());
    window.addEventListener('blur', () => { this.keys.clear(); this.held.clear(); });
  }

  padHold(action, on) { if (on) this.held.add(action); else this.held.delete(action); }

  pollPad(dt) {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const pad = pads && [...pads].find((p) => p && p.connected);
    if (!pad) return;
    const b = (i) => !!pad.buttons[i] && pad.buttons[i].pressed;
    const buttons = [0, 1, 2, 3, 4, 5, 9, 12, 13, 14, 15];
    const active = buttons.filter(b);
    const ax = pad.axes || [];
    const lx = ax[0] || 0, ly = ax[1] || 0;
    const moving = Math.abs(lx) > 0.38 || Math.abs(ly) > 0.38;
    if (active.length || moving) { this.lastDevice = 'pad'; this.first(); }
    // Edge-triggered buttons.
    for (const i of buttons) {
      const now = b(i);
      if (now && !this.padPrev[i]) {
        const map = {
          0: ['confirm', 'advance'], 1: ['cancel', 'pause'], 2: ['essence'], 3: ['noise'],
          4: ['skill1'], 5: ['skill2'], 9: ['pause'], 12: ['up'], 13: ['down'], 14: ['left'], 15: ['right'],
        };
        this.push(['any', ...(map[i] || [])]);
      }
      this.padPrev[i] = now;
    }
    this.padHold('confirm', b(0)); this.padHold('cancel', b(1)); this.padHold('pause', b(9));
    this.padHold('up', b(12) || ly < -0.4); this.padHold('down', b(13) || ly > 0.4);
    this.padHold('left', b(14) || lx < -0.4); this.padHold('right', b(15) || lx > 0.4);
    this.padRepeat -= dt;
    if (this.padRepeat <= 0) {
      let a = null;
      if (ly < -0.4 || b(12)) a = 'up';
      else if (ly > 0.4 || b(13)) a = 'down';
      else if (lx < -0.4 || b(14)) a = 'left';
      else if (lx > 0.4 || b(15)) a = 'right';
      if (a) { this.push(a); this.padRepeat = 0.16; }
    }
  }

  update(dt) { this.pollPad(dt); }
  consume() { const q = this.queue.slice(); this.queue.length = 0; return q; }
  isHeld(a) { return this.held.has(a); }
  prompts() {
    return this.lastDevice === 'pad'
      ? { up: 'prompt-pad-dpad', down: 'prompt-pad-dpad', left: 'prompt-pad-dpad', right: 'prompt-pad-dpad', confirm: 'prompt-pad-a', cancel: 'prompt-pad-b', pause: 'prompt-pad-start' }
      : { up: 'prompt-arrows', down: 'prompt-arrows', left: 'prompt-arrows', right: 'prompt-arrows', confirm: 'prompt-enter', cancel: 'prompt-esc', pause: 'prompt-esc' };
  }
}
