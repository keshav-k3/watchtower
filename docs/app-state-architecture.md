# App State Architecture

## Source of truth stores
- `app-ui-store`: UI view state (`activeView`, `showAbout`)
- `app-plugin-store`: plugin metadata + persisted provider visibility
- `app-preferences-store`: fixed runtime preferences used by probes, tray rendering, and display formatting

## Derived values
- `displayPlugins` + `navPlugins` are computed by `useAppPluginViews`.
- `autoUpdateNextAt` is runtime scheduling state from `useProbe`.
- `selectedPlugin` is computed by `useAppPluginViews`.

## Main data flow
1. `App.tsx` composes hooks and owns cross-domain orchestration.
2. Source stores are updated from bootstrap and probe actions.
3. Derived hooks recompute view models from source state.
4. `App.tsx` passes derived values directly to `AppShell` and `AppContent`.
5. `AppShell` and `AppContent` render from those direct props and source stores.

## Preferences

Most preferences still use fixed defaults. Settings exposes the global shortcut, low usage alerts and Codex accounts:

- Auto refresh: every 5 minutes while the panel is open and plugged in. The wait is longer while the panel is closed or the computer is on battery. Opening the panel shows the last saved numbers immediately, then refreshes them when they are older than 5 minutes.
- Usage mode: Left
- Reset timers: Relative
- Time format: Auto
- Menubar icon style: Watchtower
- Menubar metric: Default
- Theme: Dark by default, with a header toggle for Light (Refresh → Theme → Provider Settings)
- Old numbers: when a card's last good refresh is older than two of the slowest normal waits (80 minutes at the 5 minute default), or the latest refresh failed, its numbers fade a little and "Updated 3h ago" turns amber. Fresh cards look the same as before.
- Low usage alerts: off by default. When on, Watchtower sends one notification when a provider drops below the chosen share left (5, 10, 20 or 30%, default 10%). That limit stays quiet until it climbs back above the line, which is what a reset does, and a relaunch does not repeat it.
- Global shortcut: customizable in Settings (default `CommandOrControl+W`; clear to disable)
- Start on login: enabled
- Providers: bundled providers use a fixed order: Cursor, Codex, Claude, OpenCode, Gemini
- Provider visibility: the small provider menu can hide or show bundled providers

## Guardrails
- Keep source-of-truth state in dedicated stores (`app-ui-store`, `app-plugin-store`, `app-preferences-store`).
- Keep derived values computed in domain hooks and passed directly to composition components.
- Avoid effect-based mirroring of derived values into a separate store.
- Keep derivations pure and colocated with domain hooks.
