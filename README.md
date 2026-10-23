# Human Invaders (Cyzer)

Browser version of *Human Invaders* / *Cyzer* (GREEX, 1993/94), a DOS shoot'em up
ported from Turbo Pascal to Rust and compiled to WebAssembly.

Play: https://urshofer.github.io/cyzer/

Arrow keys / numpad: move, Space: fire / select, B: smartbomb, Enter: confirm, Q: give up.
Gamepads are supported (d-pad / stick, A fire, B smartbomb, Y / Start confirm).
Fullscreen: the link below the picture, double-click, or Alt+Enter.
Add `?center` to the URL for the original no-collision cheat.

The game starts on load; sound switches on with the first key press or click.

## Desktop downloads

Native builds for macOS and Windows are on the
[Releases page](https://github.com/urshofer/cyzer/releases/latest):

* `huminvad-macos-universal.zip`: macOS 11 or later, Apple Silicon and Intel.
  Unzip and run `huminvad`. The binary is not notarized, so macOS blocks it on the
  first start. Either right-click it and choose Open, or run
  `xattr -d com.apple.quarantine huminvad` once in Terminal.
* `huminvad-windows-x86_64.zip`: Windows 10 or later, 64-bit. Unzip and run
  `huminvad.exe`. SmartScreen may warn about an unknown publisher: click
  "More info", then "Run anyway".

All game data is built into the binary, so nothing needs installing.
F11 or Alt+Enter toggles fullscreen. Command-line flags: `--fullscreen`, and `--center`
for the cheat.

This repository holds the compiled browser files (`index.html`, `main.js`,
`huminvad.wasm`), a static site with no server side. The desktop binaries are
only attached to releases.
