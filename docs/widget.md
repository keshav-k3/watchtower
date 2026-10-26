# Mac Widget

Watchtower can show your AI usage in Notification Center and on the desktop. This is the same kind of widget as Weather. It needs macOS 14 (Sonoma) or later, and it is Mac-only.

The widget is not a second app. It lives inside `Watchtower.app`. A browser mock of the three sizes is in `src-tauri/macos/WatchtowerWidget/preview/index.html`. That page is a preview, not a running Mac widget.

## What you do once

1. Install Xcode 16 or newer. Xcode 26 is what you want if you are checking the clear and tinted glass looks.
2. Install the project generator: `brew install xcodegen`.
3. In the repo, generate the Xcode project and open it:

```sh
cd src-tauri/macos/WatchtowerWidget
xcodegen generate
open WatchtowerWidget.xcodeproj
```

4. Select the **WatchtowerWidget** target. Open **Signing & Capabilities**. Set **Team** to your Apple Developer team.
5. Leave the App Group as `group.com.keshavk3.watchtower`. The same id is already in:
   - `src-tauri/Entitlements.plist` (the Watchtower app)
   - `src-tauri/macos/WatchtowerWidget/WatchtowerWidget.entitlements` (the widget)
   - `src-tauri/macos/WatchtowerWidget/Sources/Shared/WidgetContract.swift`
   - `src-tauri/src/widget_snapshot.rs`
6. On [developer.apple.com](https://developer.apple.com), register an App Group with that exact id for your team. Use a Development or Developer ID profile that includes the group when you sign a release.

Do not turn on App Sandbox for the Watchtower app. The widget target is sandboxed. The main app is not.

If you ship with Developer ID and you do not embed a provisioning profile, change that App Group id in the four files above to `YOURTEAMID.com.keshavk3.watchtower` (your 10-character Team ID, a dot, then the rest). macOS only shares the folder without a permission prompt when the id is tied to your team or to a profile. The widget cannot show that prompt. It would just stay empty.

## Build

On a Mac, from the repo:

```sh
bun run bundle:plugins
bun run tauri build
```

Before the app is packed, Tauri runs `src-tauri/macos/WatchtowerWidget/build-widget.sh`. That script generates the Xcode project, compiles the widget and a small bridge library, and signs both.

The signing name is the first one that is set:

- `WIDGET_SIGN_IDENTITY`
- `APPLE_SIGNING_IDENTITY` (this is already what the publish workflow uses)
- ad-hoc (`-`) if neither is set

The packed app is `src-tauri/target/release/bundle/macos/Watchtower.app`. Copy it into `/Applications`, open it once, and let it refresh. Then swipe in from the right edge, or edit the desktop, and add **Usage**.

An ad-hoc build can still show the widget. If the App Group folder is not shared, the widget reads `~/Library/Containers/com.keshavk3.watchtower.widget/Data/widget-snapshot.json` instead.

Linux and Windows builds skip the widget script. Pack the Mac app on a Mac.

## How the numbers get there

Every usage refresh writes `widget-snapshot.json` (version 1). The file has each provider's id, name, brand color, stale flag, updated time, and one entry per usage line: label, percent full, and reset time.

It is written to three places:

- the app's own data folder, so the next launch still has the last good numbers
- `~/Library/Group Containers/group.com.keshavk3.watchtower/`
- the widget container path above, for ad-hoc builds

The bridge then asks macOS to redraw. macOS ignores redraw requests that arrive too often, and Watchtower refreshes about every 5 minutes, so the app asks at most every 15 minutes. The widget also rebuilds itself about every 15 minutes and moves the reset countdown once a minute in between.

You can point the app at a bridge you built by hand with `WATCHTOWER_WIDGET_BRIDGE=/path/to/libWatchtowerWidgetBridge.dylib`.

## Adding a provider mark

When a plugin is added, copy its icon into the widget assets. Do not redraw it.

```sh
cp plugins/<id>/icon.svg \
  src-tauri/macos/WatchtowerWidget/Assets.xcassets/provider-<id>.imageset/icon.svg
```

Copy `Contents.json` from a neighbor imageset as well. Until that file exists, the widget shows the provider's initial.

The marks already in the widget are the plugin icons from this repo, used unchanged:

| Provider | File |
| --- | --- |
| Claude | `plugins/claude/icon.svg` |
| Codex | `plugins/codex/icon.svg` |
| Cursor | `plugins/cursor/icon.svg` |
| Gemini | `plugins/gemini/icon.svg` |
| OpenCode | `plugins/opencode/icon.svg` |

## If the widget is missing or empty

- The app has to be the one in `/Applications`, not a copy still sitting in `target/`.
- Open Watchtower and let one refresh finish. Then remove the widget and add it again.
- Look for `widget-snapshot.json` in the App Group folder or the widget container. `version` should be `1`.
- Widget logs: `log show --last 5m --predicate 'subsystem == "com.keshavk3.watchtower.widget"' --style compact`
