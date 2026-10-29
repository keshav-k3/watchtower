# Muse Code (Meta)

Shows the Muse Code subscription allowance: the 5-hour window (**Session**) and the
rolling **Weekly** block, each with its reset time, plus the plan tier.

## Data source

Watchtower runs the official Muse Code CLI command:

```
muse usage --json
```

`muse usage` was added in Muse Code 1.4.13. It "shows your subscription allowance
(window and weekly use, reset times, tier) without running a model turn"
([changelog](https://dev.meta.ai/docs/muse-code/changelog)). Subscriptions only work
through the CLI and have 5-hour and weekly limits
([subscriptions](https://dev.meta.ai/docs/muse-code/subscriptions)).

- The host exposes one fixed command to this plugin only (`ctx.host.muse.usage()`).
  Arguments are not configurable, so a plugin cannot run anything else through it.
- `muse` is looked up on `PATH` plus `~/.local/bin` (the installer default),
  `/usr/local/bin` and `/opt/homebrew/bin`. Timeout: 20 s, clamped to the probe deadline.
- Watchtower never reads `~/.config/muse/auth.json` or the keychain, and never calls
  Meta's endpoints itself. The CLI uses its own sign-in.
- Nothing is printed to logs except the first line of a CLI error, redacted.

## Output shape

The plugin accepts Muse's protocol usage shape, optionally wrapped in `usage`:

```json
{
  "usage": {
    "window": { "usedPercent": 37.5, "windowDurationMins": 300, "resetsAtMs": 1793000000000 },
    "weekly": { "usedPercent": 12, "resetsAtMs": 1793200000000 },
    "tier": "…",
    "observedAtMs": 1792990000000
  },
  "tierName": "…"
}
```

It also accepts the server's snake_case `subs_usage` block (`used_percent`,
`window_duration_mins`, `resets_at` as ISO or epoch seconds). Percentages are clamped
to 0–100.

## Errors (card shows the message with Retry)

| CLI result | Message |
| --- | --- |
| `muse` not on PATH | Muse Code CLI not found. Install it from dev.meta.ai/docs/muse-code. |
| `not logged in` | Not logged in. Run `muse login` to sign in. |
| Timed out | Muse Code did not answer in time. Try again. |
| API-key login | Muse Code is signed in with an API key. Allowance is shown for subscription logins only. |
| No window/weekly | No Muse Code subscription allowance found for this account. |
| Non-JSON output | Muse usage response invalid. Update Muse Code and try again. |

## Alternatives considered

- `POST https://api.meta.ai/muse-code/key` with the CLI's bearer token returns
  `subs_usage`, but it mints a new key on every call and is undocumented. Not used.
- `muse exec --json` prints a `run.usage` line, but only after a real model turn,
  which spends quota. Not used.
- The pay-as-you-go Model API has only per-minute `x-ratelimit-*` headers and a
  dashboard Usage page; neither covers the subscription allowance.

## Verification status

The not-logged-in path was checked against Muse Code 1.4.14 on Linux. The logged-in
JSON field names come from the protocol types in that build; they have not yet been
checked against a signed-in account.
