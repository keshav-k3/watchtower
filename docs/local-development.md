# Local Development

Run Watchtower on a Mac from this repository.

## Prerequisites

- macOS
- Xcode Command Line Tools (`xcode-select --install`)
- [Rust](https://rustup.rs/) stable
- [Bun](https://bun.sh/)

Linux can run the checks and the browser demo. The menu bar icon itself is macOS-only.

## Install

```sh
bun install
```

## Run

```sh
bun run tauri dev
```

The first Rust compile takes a few minutes. Watchtower then appears in the menu bar.

- Left-click the icon to open the usage panel.
- Right-click the icon for Show Stats, About Watchtower, and Quit.

`make up` starts the same dev app in the background. `make down` stops it. `make logs` follows the log.

## Checks

```sh
bun run test
bun run build
cd src-tauri && cargo test
```

`bun run build` type-checks the frontend and builds the web bundle. `cargo test` checks the Rust side, including the tray click rules and the ports parser.

## Browser demo

This does not open the macOS menu bar. It runs the panel in a browser with sample usage, at the same 400px width as the app window:

```sh
WATCHTOWER_DEMO=1 bun x vite --host 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173. The page is 400px wide. A sample Codex reset appears a few seconds after load, and Ports can stop the demo server the page starts.

## Log level

The tray menu no longer has a Debug Level item. The saved level still applies on launch. To change it, quit Watchtower, edit `logLevel` in:

```text
~/Library/Application Support/com.keshavk3.watchtower/settings.json
```

Use `error`, `warn`, `info`, `debug`, or `trace`, then open Watchtower again. See [capture-logs.md](capture-logs.md).
