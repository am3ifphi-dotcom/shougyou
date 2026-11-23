// ---------------------------------------------------------------------------
//  input.js — keyboard + gamepad + pointer, normalised into game actions.
//
//  Every menu and every HUD prompt is driven by *actions* ("confirm", "back",
//  "up", …) so the on-screen button glyphs can switch to the device the player
//  actually touched (keyboard ⇄ pad ⇄ mouse).
// ---------------------------------------------------------------------------

const KEY_MAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Enter: 'confirm', NumpadEnter: 'confirm', Space: 'confirm',
  Escape: 'pause',                     // Esc pauses in-game, cancels in menus
  Backspace: 'back',
  KeyJ: 'confirm', KeyZ: 'confirm',
  KeyK: 'back', KeyX: 'back',
  KeyQ: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyE: 'skill', KeyL: 'skill',
  KeyF: 'fullscreen',
  KeyM: 'mute',
  KeyP: 'pause',
  Tab: 'swap',
};

const KEY_LABEL = {
  up: '↑', down: '↓', left: '←', right: '→',
  confirm: 'ENTER', back: 'ESC', dash: 'SHIFT', skill: 'E',
  fullscreen: 'F', mute: 'M', pause: 'ESC', swap: 'TAB',
};

const PAD_LABEL = {
  up: 'D-PAD ↑', down: 'D-PAD ↓', left: 'D-PAD ←', right: 'D-PAD →',
  confirm: 'Ⓐ', back: 'Ⓑ', dash: 'Ⓧ', skill: 'Ⓨ',
  fullscreen: 'SELECT', mute: 'SELECT', pause: 'START', swap: 'ⓁⒷ',
};

export class InputSystem {
  constructor(target = window) {
    this.handlers = new Map();       // action -> Set<fn>
    this.down = new Set();           // currently held actions
    this.repeat = new Map();         // action -> next repeat time
    this.device = 'keyboard';        // 'keyboard' | 'pad' | 'mouse'
    this.anyKeyWaiters = [];
    this.gamepadIndex = null;
    this.axes = { x: 0, y: 0 };
    this._polling = false;
    this.enabled = true;
    this.lastActivity = performance.now();

    target.addEventListener('keydown', (e) => this._onKey(e, true), { passive: false });
    target.addEventListener('keyup', (e) => this._onKey(e, false));
    target.addEventListener('pointerdown', () => this._setDevice('mouse'));
    window.addEventListener('gamepadconnected', (e) => { this.gamepadIndex = e.gamepad.index; this._setDevice('pad'); });
    window.addEventListener('gamepaddisconnected', () => { this.gamepadIndex = null; });
    window.addEventListener('blur', () => { this.down.clear(); });
  }

  on(action, fn) {
    if (!this.handlers.has(action)) this.handlers.set(action, new Set());
    this.handlers.get(action).add(fn);
    return () => this.handlers.get(action)?.delete(fn);
  }

  /** Register a handler for both "cancel" keys in menus. */
  onCancel(fn) {
    const a = this.on('back', fn);
    const b = this.on('pause', fn);
    return () => { a(); b(); };
  }

  emit(action, detail = {}) {
    const set = this.handlers.get(action);
    if (!set) return;
    for (const fn of set) fn(detail);
  }

  anyKey() {
    return new Promise((res) => this.anyKeyWaiters.push(res));
  }

  label(action) {
    if (this.device === 'pad') return PAD_LABEL[action] || action.toUpperCase();
    if (this.device === 'mouse') return 'CLICK';
    return KEY_LABEL[action] || action.toUpperCase();
  }

  deviceName() {
    return { keyboard: 'KEYBOARD', pad: 'GAMEPAD', mouse: 'MOUSE' }[this.device];
  }

  _setDevice(d) {
    if (this.device === d) return;
    this.device = d;
    this.emit('devicechange', { device: d });
  }

  _onKey(e, isDown) {
    const action = KEY_MAP[e.code];
    this.lastActivity = performance.now();
    if (isDown) {
      this._setDevice('keyboard');
      const waiting = this.anyKeyWaiters;
      this.anyKeyWaiters = [];
      waiting.forEach((fn) => fn(e.code));
    }
    if (!action) return;
    e.preventDefault?.();
    if (isDown) {
      if (!this.down.has(action)) {
        this.down.add(action);
        this.repeat.set(action, performance.now() + 260);
        if (this.enabled) this.emit(action, { source: 'key', code: e.code, repeat: false });
      }
    } else {
      this.down.delete(action);
      this.repeat.delete(action);
    }
  }

  /** Tick from the main loop: handles key repeat, analog stick, pad buttons. */
  update(dtMs, now) {
    if (!this.enabled) return;
    // --- key repeat for navigation
    for (const [action, next] of [...this.repeat]) {
      if (now >= next) {
        this.repeat.set(action, now + 95);
        if (['up', 'down', 'left', 'right'].includes(action)) this.emit(action, { source: 'key', repeat: true });
      }
    }
    // --- gamepad
    const pads = navigator.getGamepads?.() || [];
    const pad = (this.gamepadIndex != null ? pads[this.gamepadIndex] : pads.find((p) => p)) || null;
    if (!pad) return;
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    this.axes.x = Math.abs(ax) > 0.22 ? ax : 0;
    this.axes.y = Math.abs(ay) > 0.22 ? ay : 0;
    this._setDevice('pad');
    // d-pad + analog as digital navigation with repeat
    const nav = {
      up: pad.buttons[12]?.pressed || this.axes.y < -0.5,
      down: pad.buttons[13]?.pressed || this.axes.y > 0.5,
      left: pad.buttons[14]?.pressed || this.axes.x < -0.5,
      right: pad.buttons[15]?.pressed || this.axes.x > 0.5,
    };
    for (const [action, pressed] of Object.entries(nav)) {
      const held = this.down.has('pad:' + action);
      if (pressed && !held) {
        this.down.add('pad:' + action);
        this.repeat.set('pad:' + action, now + 260);
        this.emit(action, { source: 'pad' });
      } else if (pressed && held && now >= (this.repeat.get('pad:' + action) || 0)) {
        this.repeat.set('pad:' + action, now + 95);
        this.emit(action, { source: 'pad', repeat: true });
      } else if (!pressed && held) {
        this.down.delete('pad:' + action);
        this.repeat.delete('pad:' + action);
      }
    }
    const btn = [
      [0, 'confirm'], [1, 'back'], [2, 'dash'], [3, 'skill'],
      [9, 'pause'], [8, 'mute'],
    ];
    for (const [i, action] of btn) {
      const pressed = pad.buttons[i]?.pressed;
      const key = 'padb:' + i;
      if (pressed && !this.down.has(key)) {
        this.down.add(key);
        const waiting = this.anyKeyWaiters; this.anyKeyWaiters = [];
        waiting.forEach((fn) => fn(action));
        this.emit(action, { source: 'pad' });
      } else if (!pressed && this.down.has(key)) this.down.delete(key);
    }
  }

  axis(name) { return this.axes[name] || 0; }
  held(action) { return this.down.has(action); }
}
