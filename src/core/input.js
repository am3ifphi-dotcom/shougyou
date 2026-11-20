/**
 * Input.
 *
 * Keyboard, gamepad and pointer are normalised into one action vocabulary so
 * every screen is playable with keys alone.  The last used device is tracked
 * so HUD/menu prompts can swap their glyphs between keyboard and pad.
 */
const KEYMAP = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  KeyJ: 'attack',
  KeyZ: 'attack',
  KeyK: 'cast',
  KeyX: 'cast',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyC: 'dash',
  Escape: 'pause',
  KeyP: 'pause',
  KeyE: 'interact',
  KeyM: 'map',
  Tab: 'map',
};

const PADMAP = {
  0: 'confirm', // A
  1: 'cancel', // B
  2: 'attack', // X
  3: 'cast', // Y
  4: 'pause', // LB
  5: 'dash', // RB
  6: 'pause', // LT
  7: 'dash', // RT
  8: 'map', // back
  9: 'pause', // start
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};

export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.axis = { x: 0, y: 0 };
    this.device = 'keyboard';
    this.anyPressed = false;
    this.pointer = { x: 0, y: 0, moved: false, down: false, clicked: false };
    this.onAnyInput = null;
    this.gpIndex = null;
    this.padHeld = new Set();
    this.keyHeld = new Set();

    window.addEventListener('keydown', (e) => {
      const action = KEYMAP[e.code];
      if (action) {
        e.preventDefault();
        if (!this.held.has(action)) this.pressed.add(action);
        this.held.add(action);
        this.keyHeld.add(action);
        this.device = 'keyboard';
        this._any();
      }
      // Suppress browser-level shortcuts that would break the "it's a game" feel.
      if (['F1', 'F3', 'F5', 'F7', 'Tab'].includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (action) {
        this.held.delete(action);
        this.keyHeld.delete(action);
        this.released.add(action);
      }
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.keyHeld.clear();
      this.padHeld.clear();
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('pointermove', (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointer.moved = true;
      this.device = 'pointer';
    });
    window.addEventListener('pointerdown', (e) => {
      this.pointer.down = true;
      this.pointer.clicked = true;
      this._any();
      if (e.pointerType === 'touch') this.device = 'pointer';
    });
    window.addEventListener('pointerup', () => {
      this.pointer.down = false;
    });
    window.addEventListener('gamepadconnected', (e) => {
      this.gpIndex = e.gamepad.index;
      this.device = 'gamepad';
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gpIndex = null;
    });
  }

  _any() {
    this.anyPressed = true;
    this.onAnyInput?.();
  }

  /**
   * Snapshot the frame.  Edge flags (pressed / released / anyPressed) are
   * *not* cleared here - they are cleared by `endFrame()` once every consumer
   * has looked at them, otherwise an input that lands between two frames can
   * be swallowed.
   */
  poll() {
    this.axis.x = 0;
    this.axis.y = 0;

    if (this.held.has('left')) this.axis.x -= 1;
    if (this.held.has('right')) this.axis.x += 1;
    if (this.held.has('up')) this.axis.y -= 1;
    if (this.held.has('down')) this.axis.y += 1;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const fresh = new Set();
    for (const pad of pads) {
      if (!pad) continue;
      for (const [idx, action] of Object.entries(PADMAP)) {
        if (pad.buttons[Number(idx)]?.pressed) fresh.add(action);
      }
      if (pad.axes.length >= 2) {
        const [lx, ly] = pad.axes;
        if (Math.abs(lx) > 0.22) {
          this.axis.x += lx;
          fresh.add(lx > 0 ? 'right' : 'left');
          this.device = 'gamepad';
        }
        if (Math.abs(ly) > 0.22) {
          this.axis.y += ly;
          fresh.add(ly > 0 ? 'down' : 'up');
          this.device = 'gamepad';
        }
      }
    }
    for (const action of fresh) {
      if (!this.padHeld.has(action)) {
        this.pressed.add(action);
        this.device = 'gamepad';
        this.anyPressed = true;
        this.onAnyInput?.();
      }
      if (!this.held.has(action)) this.held.add(action);
    }
    for (const action of this.padHeld) {
      if (!fresh.has(action) && !this.keyHeld.has(action)) this.held.delete(action);
    }
    this.padHeld = fresh;

    // clamp analogue to a unit vector but keep digital snappy
    const mag = Math.hypot(this.axis.x, this.axis.y);
    if (mag > 1) {
      this.axis.x /= mag;
      this.axis.y /= mag;
    }
  }

  /** Clear one-shot flags; called at the very end of the frame. */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.anyPressed = false;
    this.pointer.clicked = false;
    this.pointer.moved = false;
  }

  isDown(action) {
    return this.held.has(action);
  }

  wasPressed(action) {
    return this.pressed.has(action);
  }

  deviceLabel() {
    return this.device === 'gamepad' ? 'pad' : this.device === 'pointer' ? 'mouse' : 'keyboard';
  }

  /** Human readable prompt for the active device, e.g. "[SPACE] JUMP". */
  prompt(action, label) {
    const glyph = this.device === 'gamepad' ? GLYPH.pad[action] : GLYPH.key[action];
    return glyph ? `[${glyph}] ${label}` : label;
  }
}

export const GLYPH = {
  key: {
    up: 'W',
    down: 'S',
    left: 'A',
    right: 'D',
    confirm: 'ENTER',
    cancel: 'ESC',
    attack: 'J',
    cast: 'K',
    dash: 'SHIFT',
    pause: 'ESC',
    interact: 'E',
    map: 'TAB',
  },
  pad: {
    up: 'UP',
    down: 'DOWN',
    left: 'LEFT',
    right: 'RIGHT',
    confirm: 'A',
    cancel: 'B',
    attack: 'X',
    cast: 'Y',
    dash: 'RB',
    pause: 'START',
    interact: 'Y',
    map: 'BACK',
  },
};

export const input = new Input();
