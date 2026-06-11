# Watchtower UI/UX Audit

Audit date: 2026-06-11

Scope: menu bar status item, menu card/dashboard, provider switcher, Settings tabs, provider/account settings, empty/error states, copy and interaction patterns.

Note: I packaged and launched the current app bundle successfully, but the Mac was on the lock screen during visual inspection. The findings below are based on source-level review plus the packaged app launch path. Items marked "needs live check" should be confirmed visually after the screen is unlocked.

## Highest-Impact Improvements

### 1. Resolve product naming inconsistency

The running bundle and repo present as Watchtower, but multiple user-facing strings still say CodexBar, including "About CodexBar", "CodexBar could not...", "CodexBar will ask...", "Refresh CodexBar", and managed-account messages.

Why it matters: this weakens trust, especially around account/auth, Keychain, browser cookies, and deletion prompts.

Recommended direction:
- Use "Watchtower" consistently for the app brand.
- Use "Codex" only for the OpenAI Codex provider/account.
- Audit all Localizable strings for CodexBar references and update prompt copy.
- Consider a migration note only if existing users recognize CodexBar.

Priority: P0

### 2. Add a real first-run/setup experience

The app has provider settings and login actions, but there is no obvious guided path for a new user to answer: "What do I need to connect?", "Which providers are supported?", "Why is there no usage yet?", and "What permissions will this require?"

Current likely outcome: the menu says "No usage yet" or "Not fetched yet", while Settings exposes many low-level toggles before the user has established one working provider.

Recommended direction:
- First launch should open a compact setup sheet or Settings Providers tab.
- Show detected providers, missing CLIs/accounts, and one primary CTA per provider.
- Separate "Connect Codex", "Connect Claude", "Enable Cursor", "Enable Gemini" from tuning settings.
- Use clear states: Connected, Needs sign-in, CLI not found, Permission needed, Disabled.
- Keep advanced token/cookie/manual paths behind "Advanced connection options".

Priority: P0

### 3. Make provider errors actionable, not just copyable

Errors can appear as menu-card subtitles, provider detail error sections, and copied text. The UI supports copying, but the user still has to infer the fix.

Recommended direction:
- Convert common errors into structured recovery cards:
  - "Sign in to Codex"
  - "Grant browser cookie access"
  - "Install or update CLI"
  - "Open provider dashboard"
  - "Retry"
- Keep raw error copy behind a disclosure or "Copy details".
- In the menu, show one-line problem plus CTA in the action section.
- In Settings, show the full diagnostic after the user expands "Details".

Priority: P0

### 4. Reduce provider settings overload

Provider detail currently stacks header, info grid, usage, error, settings, account management, quota warnings, and options in one scroll view. This is powerful, but it makes the main job hard: understand whether the provider works and what to do next.

Recommended direction:
- Make the top of each provider page a status summary: state, account, latest usage, last refresh, current problem.
- Group lower content into clear sections: Connection, Usage Display, Notifications, Advanced.
- Collapse rarely used sections by default: quota override, token accounts, raw cookie/API key fields, diagnostics.
- Use a sticky provider header so enable/refresh/account remain accessible while scrolling.
- Replace "Settings" and "Options" section titles with more specific names.

Priority: P1

### 5. Clarify "Active" vs "System" account concepts

The Codex accounts section distinguishes the account Watchtower follows from the default Codex account on the Mac. That is technically important, but "Active" and "System" are not self-explanatory enough.

Recommended direction:
- Rename "Active" to "Tracked by Watchtower".
- Rename "System" to "Default Codex CLI account".
- Add concise helper text explaining consequences before changing system account.
- Replace "Re-auth" with "Sign in again".
- Add badges such as "Tracked", "Default CLI", "Needs sign-in".

Priority: P1

### 6. Improve the menu card information hierarchy

The menu card is the daily-use surface. It currently uses compact stacked sections with identical visual weight for provider, account, freshness, progress bars, credits, cost, and error text.

Recommended direction:
- Make the primary usage value the strongest element, not just a progress row.
- Use a consistent row formula: label, progress, value, reset.
- Separate "how much left" from "when resets" more clearly.
- Put account/plan in a quieter header line or tooltip unless it is changing the interpretation of usage.
- Consider a "good/warning/critical" summary state at the top.
- Avoid letting long emails, plan names, or errors dominate the card.

Priority: P1

### 7. Add explicit empty states with next actions

Several placeholders are passive: "No usage yet", "Not fetched yet", "Limits not available", "No token accounts yet", "No matching providers".

Recommended direction:
- Pair every empty state with an action or reason:
  - "No usage yet. Refresh after using Codex."
  - "Not connected. Sign in to Codex."
  - "No matching providers. Clear search."
  - "Limits unavailable for this plan."
- In provider rows, distinguish "never fetched", "disabled", "not installed", and "signed out".

Priority: P1

### 8. Revisit Settings window sizing and navigation

The Settings view forces fixed content sizes and animates width between tabs, especially Providers at 792 pt vs other tabs at 546 pt.

Risks:
- Window jumps when changing tabs.
- Content may feel cramped on smaller displays.
- Non-resizable Settings makes advanced provider pages harder to inspect.

Recommended direction:
- Use a stable window width, or allow resizing.
- Keep Providers wide by default but do not animate large width shifts.
- Consider a sidebar-style Settings layout instead of toolbar tabs once provider settings dominate the product.

Priority: P1

## Menu Bar And Menu UX

### 9. Menu bar icon settings are conceptually crowded

Display settings include merge icons, switcher icons, highest-usage provider, percent in menu bar, display mode, selected overview providers, multi-account layout, reset-time format, quota markers, credits/extra usage, and changelog links.

Recommended direction:
- Split Display into "Menu Bar Icon" and "Menu Content".
- Add a small live preview for icon modes.
- Disable dependent settings with a visible reason, not opacity alone.
- Move provider ordering and overview provider selection closer together.

Priority: P1

### 10. Provider switcher shortcuts are hidden

The menu supports keyboard navigation and persistent shortcuts, but there is little visible discoverability for arrow navigation, provider number shortcuts, or command actions.

Recommended direction:
- Show standard shortcuts in menu items wherever possible.
- Add tooltips to provider switcher items with provider name and shortcut.
- Optionally show a subtle "Use ←/→ to switch" hint only when multiple providers exist.

Priority: P2

### 11. Progress bars need stronger semantic encoding

Progress bars use provider brand color and warning markers. This looks branded, but quota severity can be less obvious than it should be.

Recommended direction:
- Use brand color for identity but reserve semantic color for warning/critical states.
- Add clearer threshold markers or labels when warnings are enabled.
- Ensure "used" vs "left" mode is unmistakable in both text and accessibility.
- Check contrast of marker strokes in light/dark/highlighted menu states.

Priority: P2

### 12. Cost and credits need confidence/latency cues

Cost is labeled estimated, but users need to know whether it is current, delayed, local, or provider-reported. Credits also use a 1,000-token display scale that may not be obvious.

Recommended direction:
- Show data source and freshness inline: "Local token scan, updated 2m ago" or "Dashboard, updated 2m ago".
- Explain "estimated" once in Settings or a tooltip.
- For credits, use units that match provider language and avoid arbitrary scale labels unless explained.

Priority: P2

### 13. Hosted charts and inline dashboards should not feel bolted on

There are chart menu views and an `InlineUsageDashboardContent` placeholder that currently renders `EmptyView`. If dashboard models are ever supplied, nothing appears.

Recommended direction:
- Either remove/defer the inline dashboard model path or implement it fully.
- Use consistent chart empty states with action/reason.
- Make charts optional secondary views, not hidden surprises in submenus.

Priority: P1 if dashboard data is expected, otherwise P3 cleanup.

## Settings UX

### 14. Control styles are inconsistent

General and Display use checkbox toggles; Providers uses switch toggles for provider enablement and some provider settings; Advanced uses checkbox toggles. Some rows use picker-on-right layouts, others use stacked rows.

Recommended direction:
- Use switches for on/off operational states: provider enabled, background refresh, launch at login.
- Use checkboxes for low-stakes display preferences.
- Normalize row spacing, label font, helper color, and trailing control widths.
- Avoid mixing `secondary` and `tertiary` helper text without a clear hierarchy.

Priority: P2

### 15. Quit app is too prominent in General settings

The Quit button is large and bordered prominent at the bottom of General.

Recommended direction:
- Move Quit to menu only, or make it a quiet secondary button in About/Advanced.
- Reserve prominent buttons for primary setup actions.

Priority: P2

### 16. Quota warning threshold editing is too manual

Thresholds use two small numeric fields plus Apply. There is no percent suffix inside the fields, no immediate validation feedback, and the two-threshold mental model is not obvious.

Recommended direction:
- Use chips/sliders/steppers for common thresholds.
- Label as "Warn at 50% remaining and 20% remaining" or "used", matching the user's display mode.
- Save on change or make Apply visually explain why it is needed.
- Show inherited provider values in a more scannable way.

Priority: P2

### 17. Disabled dependent settings need explanations

Several controls are disabled and dimmed when parent toggles are off, but the UI relies on opacity and proximity.

Recommended direction:
- Add short disabled reason text: "Turn on Merge icons to use this."
- Consider keeping dependent controls hidden until the parent feature is enabled.
- Avoid making whole rows low contrast when only the control is unavailable.

Priority: P2

### 18. Provider search empty state should recover

"No matching providers" is clear but inert.

Recommended direction:
- Add a Clear Search button.
- Keep the search field focused.
- Consider matching common aliases: OpenAI -> Codex, Anthropic -> Claude.

Priority: P3

### 19. Reordering providers is mouse-only and subtle

The reorder handle is a small dot grid with drag behavior.

Recommended direction:
- Add a visible "Edit order" affordance if ordering matters.
- Support keyboard move up/down from context menu or buttons.
- Consider moving provider order to Display/Menu Bar settings if it primarily affects menu display.

Priority: P3

### 20. Advanced settings mix playful, privacy, storage, and Keychain concerns

Advanced contains "Surprise me", confetti, hide personal info, storage usage, debug settings, and Keychain disabling.

Recommended direction:
- Split into "Privacy", "Behavior", and "Diagnostics".
- Move "Hide personal info" to General or Display because it affects everyday visible UI.
- Rename "Surprise me" to a literal behavior, or add a subtitle that says exactly what changes.

Priority: P2

### 21. About tab has hidden interactions

The app icon opens GitHub on click and animates on hover, but there is no visible affordance that it is clickable.

Recommended direction:
- Make GitHub the explicit link, not a hidden icon action.
- Align About copy with Watchtower branding.
- Hide "updates unavailable in this build" from normal users if it only applies to debug/non-release bundles.

Priority: P3

## Copy And Terminology

### 22. Ellipsis style is inconsistent

Strings use both "..." and "…": "Settings...", "Add Account...", "Switch Account...", "Buy Credits…".

Recommended direction:
- Standardize on the macOS convention for menu items that open flows, usually the single ellipsis character.

Priority: P3

### 23. Some copy is too implementation-oriented

Examples include "managed Codex home", "Cookie headers", "OpenAI cookies", "Disable all Keychain reads and writes", "stored in ~/.codexbar/config.json".

Recommended direction:
- Lead with the user outcome, then expose implementation detail under Advanced/Details.
- Use "saved sign-in", "browser session", "local config file", and "default CLI account" where possible.
- Preserve paths and raw terms for diagnostics.

Priority: P1

### 24. Some provider labels are ambiguous

Cursor uses "Total" and "Auto"; Gemini uses "Pro" and "Flash"; Codex/Claude use "Session" and "Weekly". These may be accurate internally but may not map to user mental models without context.

Recommended direction:
- Use provider-specific helper text in Settings and menu detail.
- Where space allows, prefer "Pro usage" / "Flash usage", "Session limit" / "Weekly limit", "Total requests", etc.

Priority: P2

### 25. Localization coverage needs a UX pass

There are many localized resources, but source still contains some raw strings and very long diagnostic strings. Long strings are likely to overflow in fixed-width settings/menu surfaces.

Recommended direction:
- Audit all visible raw strings.
- Test longest supported languages in Settings and menu card.
- Avoid fixed narrow label widths where translated strings can grow.
- Add screenshot-based checks for localization-heavy panes.

Priority: P2

## Accessibility

### 26. Status dots need accessible meaning

Provider status dots are visually colored but hidden from accessibility.

Recommended direction:
- Add accessible labels/values for status.
- Add visible text in provider detail; keep dot as secondary indicator.
- Do not rely on color alone for status severity.

Priority: P1

### 27. Icon-only buttons should have visible labels where the action is important

The provider detail refresh button is icon-only with hover help. In a settings detail page, Refresh is a primary diagnostic action.

Recommended direction:
- Use icon + "Refresh" text in Settings.
- Keep icon-only buttons for dense menu/tool surfaces only.

Priority: P2

### 28. Progress accessibility can be richer

Progress bars expose a percent value, but the accessible value may not include provider, window, used/left mode, reset time, or warning status.

Recommended direction:
- Accessibility label: "Codex weekly usage remaining".
- Accessibility value: "42 percent remaining, resets Friday at 9 AM, warning at 20 percent."

Priority: P2

### 29. Custom AppKit switcher buttons need full keyboard/focus review

The provider switcher has custom NSButton subclasses and shortcut handling. This is probably necessary for menu performance, but it deserves live keyboard verification.

Recommended direction:
- Confirm tab/focus behavior, VoiceOver names, selected state, and arrow navigation.
- Ensure tooltip text is present for every compact icon-only state.

Priority: P2, needs live check.

## Visual Design

### 30. Settings visual style is functional but not yet distinctive

The app uses native controls, which is good for macOS, but the product could feel more deliberate with clearer hierarchy and fewer bordered containers.

Recommended direction:
- Use quieter section bands or spacing rather than many dividers.
- Give provider detail a dashboard-like top summary.
- Reduce repeated captions and make headings more descriptive.
- Use consistent 8 px or smaller radius where cards are needed.

Priority: P3

### 31. Sidebar selection and row affordances need live contrast checks

Provider sidebar uses selectedContentBackgroundColor inside a rounded row on a semi-opaque control background. This may look fine in one mode and muddy in another.

Recommended direction:
- Verify light/dark/high-contrast.
- Make selected row and disabled provider state distinguishable without relying only on color/opacity.

Priority: P2, needs live check.

### 32. Menu width may be tight for modern provider/account states

The base menu card width is 310 pt. With multi-account, error messages, cost, credits, long provider names, and reset times, truncation can become frequent.

Recommended direction:
- Increase base width modestly or use adaptive widths by content class.
- Keep menu compact for simple states, but allow wider error/account states.
- Test with long emails, localized strings, and long plan names.

Priority: P2, needs live check.

## Interaction And Safety

### 33. Account removal copy should be more user-centered

"Its managed Codex home will be deleted" is technically precise but may be alarming or unclear.

Recommended direction:
- Explain what is deleted and what is not:
  - "Removes the saved Watchtower sign-in for this account."
  - "This does not delete your OpenAI account."
  - "Local managed Codex files for this account will be removed."

Priority: P1

### 34. Keychain/cookie prompts need a dedicated trust model

The app handles browser cookies, OAuth, CLI auth, and Keychain prompts. Users will be cautious.

Recommended direction:
- Add a privacy/permissions explainer in Settings.
- Explain local-only storage and exactly which providers use which credentials.
- Avoid triggering browser-wide prompts from generic refresh actions.
- Use provider-specific permission CTAs.

Priority: P1

### 35. Refresh behavior should expose state and result

There are refresh actions in menu and settings, plus background refresh cadence. A user should know whether refresh worked, failed, or was skipped.

Recommended direction:
- Show transient "Updated just now" or "Refresh failed" after manual refresh.
- Disable refresh while in-flight with visible progress.
- If a provider is disabled, Refresh should say what it will refresh or be hidden.

Priority: P2

## Technical UX Debt

### 36. Duplicate menu presentation paths can diverge

There is a native NSMenu construction path and a SwiftUI `MenuContent` path using the same descriptor. If both are user-facing in different contexts, they can drift visually and behaviorally.

Recommended direction:
- Define one canonical menu design system.
- Use shared row/action/view models.
- Snapshot test core menu states: empty, connected, stale, error, multi-provider, multi-account, credits/cost.

Priority: P2

### 37. Some UI hooks are present but unimplemented

`InlineUsageDashboardContent` returns `EmptyView`, while model hooks exist for KPI/dashboard data.

Recommended direction:
- Remove unused model hooks until needed, or implement the dashboard.
- Avoid invisible data paths where users expect content.

Priority: P2

### 38. Build output has future SwiftPM warning

Packaging produced a SwiftPM warning about conflicting `swift-syntax` identities. Not a UX issue today, but future build failure can slow UI iteration.

Recommended direction:
- Resolve the dependency identity conflict before SwiftPM escalates it.

Priority: P3 engineering hygiene.

## Suggested Task Backlog

### P0

1. Rename user-facing CodexBar brand strings to Watchtower.
2. Design and implement first-run/setup flow for providers.
3. Convert top provider errors into actionable recovery states.

### P1

1. Redesign Provider detail page information architecture.
2. Clarify Codex account "Tracked" vs "Default CLI" concepts.
3. Improve menu-card hierarchy and empty states.
4. Add permission/privacy explainer for Keychain/browser/OAuth use.
5. Fix account removal confirmation copy.
6. Decide whether inline dashboard is real; implement or remove.
7. Make Settings window sizing/resizing calmer.
8. Add accessible meaning to provider status indicators.

### P2

1. Normalize Settings control styles.
2. Improve quota warning threshold editor.
3. Add visible reasons for disabled dependent settings.
4. Add visible Refresh labels in Settings.
5. Enrich progress-bar accessibility labels/values.
6. Improve shortcut discoverability in the menu/provider switcher.
7. Add data-source freshness labels for cost/credits.
8. Test menu width against long content/localization.

### P3

1. Standardize ellipsis and capitalization.
2. Improve provider search empty state.
3. Add keyboard-friendly provider reordering.
4. Simplify About tab interactions.
5. Split Advanced into Privacy, Behavior, Diagnostics.
6. Resolve SwiftPM dependency warning.

## Live Checks Still Needed

After the Mac is unlocked, verify:
- Actual menu bar icon visibility, percent readability, and status indicator contrast.
- Menu card layout in light/dark mode with real connected, empty, error, and refreshing states.
- Provider switcher interaction: mouse, arrow keys, number shortcuts, VoiceOver names.
- Settings tab resizing animation and sidebar contrast.
- Long localized strings and long account emails.
- Keychain/cookie prompt sequencing, but only with explicit permission.
