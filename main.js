// Browser host for the Human Invaders wasm module (see src/web.rs).
"use strict";

const VSYNC_HZ = 70.086;
const KEYS = {
  ArrowUp: 1, ArrowDown: 2, ArrowLeft: 3, ArrowRight: 4, Space: 5, Enter: 6, NumpadEnter: 6,
  Escape: 7, ShiftLeft: 8,
};
for (let i = 0; i < 26; i++) KEYS["Key" + String.fromCharCode(65 + i)] = 100 + i;
for (let d = 0; d < 10; d++) { KEYS["Digit" + d] = 200 + d; KEYS["Numpad" + d] = 300 + d; }

// Gamepad (standard mapping): d-pad or left stick move, A/X/RT fire, B/Y/Start confirm.
const PAD_UP = 1, PAD_DOWN = 2, PAD_LEFT = 4, PAD_RIGHT = 8, PAD_FIRE = 16, PAD_START = 32;
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
    if (b(1) || b(3) || b(9)) bits |= PAD_START;
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

  // fullscreen of the picture: button, double-click, Alt+Enter
  const wrap = document.getElementById("wrap");
  const fsButton = document.getElementById("fs");
  const canFullscreen = !!(wrap.requestFullscreen || wrap.webkitRequestFullscreen);
  function toggleFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else if (canFullscreen) {
      const p = (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap);
      if (p && p.catch) p.catch(() => {});
    }
  }
  if (canFullscreen) {
    fsButton.hidden = false;
    fsButton.addEventListener("click", (e) => { toggleFullscreen(); e.currentTarget.blur(); });
    canvas.addEventListener("dblclick", toggleFullscreen);
  }

  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Enter" && e.altKey) { toggleFullscreen(); e.preventDefault(); return; }
    const code = KEYS[e.code];
    if (code) e.preventDefault();
    // the key that switches sound on is not passed on, so it doesn't skip the intro
    if (unlockAudio()) return;
    if (code) wasm.hi_key(code, 1);
  });
  window.addEventListener("keyup", (e) => {
    const code = KEYS[e.code];
    if (code) { wasm.hi_key(code, 0); e.preventDefault(); }
  });
}

main();
