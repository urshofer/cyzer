// Browser host for the Human Invaders wasm module (see src/web.rs).
"use strict";

const VSYNC_HZ = 70.086;
const KEYS = {
  ArrowUp: 1, ArrowDown: 2, ArrowLeft: 3, ArrowRight: 4, Space: 5, Enter: 6, NumpadEnter: 6,
  Escape: 7, ShiftLeft: 8,
};
for (let i = 0; i < 26; i++) KEYS["Key" + String.fromCharCode(65 + i)] = 100 + i;
for (let d = 0; d < 10; d++) { KEYS["Digit" + d] = 200 + d; KEYS["Numpad" + d] = 300 + d; }
// Fallback by e.key / e.keyCode for events whose e.code is empty or unknown
// (seen in Safari on key releases while another key is held).
const KEYS_BY_KEY = {
  ArrowUp: 1, Up: 1, ArrowDown: 2, Down: 2, ArrowLeft: 3, Left: 3, ArrowRight: 4, Right: 4,
  " ": 5, Spacebar: 5, Enter: 6, Escape: 7, Esc: 7,
};
const KEYS_BY_KEYCODE = { 38: 1, 40: 2, 37: 3, 39: 4, 32: 5, 13: 6, 27: 7 };
function keyCode(e) {
  return KEYS[e.code] || KEYS_BY_KEY[e.key] || KEYS_BY_KEYCODE[e.keyCode] || 0;
}

// Gamepad (standard mapping): d-pad or left stick move, A/X/RT fire, B smartbomb, Y/Start confirm.
const PAD_UP = 1, PAD_DOWN = 2, PAD_LEFT = 4, PAD_RIGHT = 8, PAD_FIRE = 16, PAD_START = 32, PAD_BOMB = 64;
function padBits() {
  let bits = 0;
  for (const gp of navigator.getGamepads ? navigator.getGamepads() : []) {
    if (!gp) continue;
    const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
    const x = gp.axes[0] || 0, y = gp.axes[1] || 0;
    if (b(12) || y < -0.5) bits |= PAD_UP;
    if (b(13) || y > 0.5) bits |= PAD_DOWN;
    if (b(14) || x < -0.5) bits |= PAD_LEFT;
    if (b(15) || x > 0.5) bits |= PAD_RIGHT;
    if (b(0) || b(2) || b(7)) bits |= PAD_FIRE;
    if (b(3) || b(9)) bits |= PAD_START;
    if (b(1)) bits |= PAD_BOMB;
  }
  return bits;
}

async function main() {
  const { instance } = await WebAssembly.instantiateStreaming(fetch("huminvad.wasm"), {});
  const wasm = instance.exports;
  const canvas = document.getElementById("screen");
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(320, 200);
  const hint = document.getElementById("sound");
  wasm.hi_init(new URLSearchParams(location.search).has("center") ? 1 : 0);

  // Browsers only allow sound after a user gesture: the game starts right
  // away and audio is switched on by the first key, click or tap.
  let ac = null;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    wasm.hi_audio_rate(ac.sampleRate);
    const node = ac.createScriptProcessor(2048, 0, 2);
    node.onaudioprocess = (e) => {
      const n = e.outputBuffer.length;
      const ptr = wasm.hi_audio(n);
      const src = new Float32Array(wasm.memory.buffer, ptr, n);
      e.outputBuffer.getChannelData(0).set(src);
      e.outputBuffer.getChannelData(1).set(src);
    };
    node.connect(ac.destination);
    ac.onstatechange = () => { if (ac.state === "running") hint.hidden = true; };
    ac.resume().catch(() => {});
    hint.hidden = ac.state === "running";
  } catch (err) {
    console.warn("no audio:", err);
    hint.hidden = true;
  }
  /** Switch sound on; true if this gesture was used up for that. */
  function unlockAudio() {
    if (!ac || ac.state === "running") return false;
    ac.resume().catch(() => {});
    return true;
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += (now - last) / 1000;
    last = now;
    const bits = padBits();
    if (bits) unlockAudio();
    wasm.hi_pad(bits);
    let n = 0;
    while (acc >= 1 / VSYNC_HZ && n < 8) {
      wasm.hi_vsync();
      acc -= 1 / VSYNC_HZ;
      n++;
    }
    if (n === 8) acc = 0;
    const ptr = wasm.hi_frame(); // may grow memory: take the buffer afterwards
    image.data.set(new Uint8Array(wasm.memory.buffer, ptr, 320 * 200 * 4));
    ctx.putImageData(image, 0, 0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Fullscreen: the whole page goes fullscreen (most reliable in Safari),
  // standard or webkit-prefixed API. The layout is switched with the "max"
  // class; where no fullscreen API exists (iPhone Safari) that class alone
  // maximizes the picture inside the browser window.
  const root = document.documentElement;
  const requestFs = root.requestFullscreen || root.webkitRequestFullscreen || root.webkitRequestFullScreen;
  const exitFs = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement;
  const setMax = (on) => document.body.classList.toggle("max", on);
  function toggleFullscreen() {
    if (fsElement()) {
      try { const p = exitFs.call(document); if (p && p.catch) p.catch(() => {}); } catch (err) {}
      setMax(false);
      return;
    }
    if (document.body.classList.contains("max")) { setMax(false); return; }
    setMax(true);
    if (requestFs) {
      try {
        const p = requestFs.call(root);
        if (p && p.catch) p.catch(() => {}); // refused: stay maximized in the window
      } catch (err) {}
    }
  }
  const onFsChange = () => { if (!fsElement()) setMax(false); };
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);
  document.getElementById("fs").addEventListener("click", (e) => {
    e.preventDefault();
    toggleFullscreen();
    e.currentTarget.blur();
  });
  canvas.addEventListener("dblclick", (e) => { e.preventDefault(); toggleFullscreen(); });

  window.addEventListener("pointerdown", unlockAudio);
  // Keys held as far as the game knows, by event code. Releases are matched
  // against this, so a key always comes up as the game code it went down as,
  // and everything is released when the page loses the keyboard (keyup
  // events are not delivered then).
  const held = new Map();
  function press(id, code) {
    if (!held.has(id)) held.set(id, code);
    wasm.hi_key(code, 1);
  }
  function release(id) {
    const code = held.get(id);
    if (code === undefined) return;
    held.delete(id);
    // the same game key may still be held under another id (Enter / NumpadEnter)
    for (const c of held.values()) if (c === code) return;
    wasm.hi_key(code, 0);
  }
  function releaseAll() {
    for (const code of new Set(held.values())) wasm.hi_key(code, 0);
    held.clear();
  }
  const eventId = (e) => e.code || e.key || String(e.keyCode);
  // ?keylog: trace key events in the console, to diagnose browser quirks
  if (new URLSearchParams(location.search).has("keylog")) {
    const log = (e) => console.log(e.type, JSON.stringify({ code: e.code, key: e.key, keyCode: e.keyCode, repeat: e.repeat }),
      "held:", [...held.keys()].join(" "));
    window.addEventListener("keydown", log, true);
    window.addEventListener("keyup", log, true);
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Enter" && e.altKey) { toggleFullscreen(); e.preventDefault(); return; }
    // Esc leaves the in-window fallback (real fullscreen is left by the browser)
    if (e.code === "Escape" && !fsElement() && document.body.classList.contains("max")) {
      setMax(false); e.preventDefault(); return;
    }
    // with Cmd held macOS delivers no keyup for the other keys
    if (e.metaKey) { releaseAll(); return; }
    const code = keyCode(e);
    if (code) e.preventDefault();
    // the key that switches sound on is not passed on, so it doesn't skip the intro
    if (unlockAudio()) return;
    if (code) press(eventId(e), code);
  });
  window.addEventListener("keyup", (e) => {
    const id = eventId(e);
    if (held.has(id)) {
      release(id);
    } else {
      // unknown id: release whatever was pressed as this game key
      const code = keyCode(e);
      for (const [k, c] of held) if (c === code) release(k);
    }
    if (keyCode(e)) e.preventDefault();
    if (e.key === "Meta") releaseAll();
  });
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAll(); });
  window.addEventListener("pagehide", releaseAll);
}

main();
