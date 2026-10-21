# Human Invaders (Cyzer)

Browser version of *Human Invaders* / *Cyzer* (GREEX, 1993/94), a DOS shoot'em up
ported from Turbo Pascal to Rust and compiled to WebAssembly.

Play: https://urshofer.github.io/cyzer/

Arrow keys / numpad: move, Space: fire / select, Enter: confirm, Q: give up.
Gamepads are supported (d-pad / stick, A fire, B / Start confirm).
Add `?center` to the URL for the original no-collision cheat.

The game starts on load; sound switches on with the first key press or click.

This repository only holds the compiled files (`index.html`, `main.js`,
`huminvad.wasm`); it is a static site with no server side.
