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

## Fixed Preferences

Watchtower currently runs with fixed defaults instead of a user-facing Settings page:

- Auto refresh: 5 minutes
- Usage mode: Left
- Reset timers: Relative
- Time format: Auto
- Menubar icon style: Watchtower
- Menubar metric: Default
- Theme: Dark by default, with a header toggle for Light
- Global shortcut: `CommandOrControl+W`
- Start on login: enabled
- Providers: bundled providers use a fixed order: Cursor, Codex, Claude, OpenCode, Gemini
- Provider visibility: the small provider menu can hide or show bundled providers

## Guardrails
- Keep source-of-truth state in dedicated stores (`app-ui-store`, `app-plugin-store`, `app-preferences-store`).
- Keep derived values computed in domain hooks and passed directly to composition components.
- Avoid effect-based mirroring of derived values into a separate store.
- Keep derivations pure and colocated with domain hooks.
