# Grok Bot

> Local files only. The plugin never touches the network, never reads `sand-secrets.json`, cookies, or the keychain.

## Overview

- **Product:** Grok Bot desktop app
- **Data source:** `~/Library/Application Support/Grok Bot/sand-client-persistence/`
- **Auth:** none — the directory only exists after signing in to the Grok Bot app
- **Quota:** weekly usage percentage with a reset time
- **Plan label:** `grokPlanLabel` from the cached reading (e.g. `SuperGrok`)

## Plugin Metrics

| Metric | Source | Scope | Format | Notes |
| --- | --- | --- | --- | --- |
| Weekly Usage | `usage.percentUsed` | overview | percent | Resets at `usage.nextResetMs`, one-week period |
| Status | stale check | overview | badge | "Open Grok Bot to refresh" when the cache is stale |

## Local Source

Each entry in the persistence directory is named `<base32>.blob`, where the base32 is RFC 4648, lowercase, unpadded. The plugin uppercases it, pads with `=` to a multiple of 8, and decodes it with a small pure-JS decoder (QuickJS has no Node APIs).

Only decoded keys ending in `.weekly-usage.cache` are used:

```text
sand.client.slice.account.<urlencoded account id>.weekly-usage.cache
```

Any decoded name containing `secret` or `cookie` is skipped **before** the file is opened, and anything else in the directory is ignored.

Each kept file is JSON:

```json
{
  "schemaVersion": 2,
  "value": {
    "kind": "present",
    "reading": {
      "readAtMs": 1761000000000,
      "usage": {
        "percentUsed": 58,
        "nextResetMs": 1761609600000,
        "isSandTrial": false,
        "hasNonZeroIncludedLimit": true,
        "isTeamSeat": false,
        "onDemand": null,
        "grokPlanLabel": "SuperGrok"
      }
    }
  },
  "expiresAtMs": 1761000900000
}
```

`expiresAtMs` may sit at the top level or inside `value`; both are accepted. Files with other kinds (`absent`, …), unreadable files, and bad JSON are skipped. When several accounts are present, the reading with the newest `readAtMs` wins.

## Stale Handling

The numbers are always shown. A "Open Grok Bot to refresh" badge is added when:

- `expiresAtMs` is in the past, or
- `readAtMs` is more than 60 minutes old.

## Privacy

- Reads only `*.blob` cache files under the directory above.
- Never reads `sand-secrets.json`, cookie stores, or the keychain; names containing `secret` or `cookie` are skipped without being opened.
- No network requests.

## Not Logged In

If the directory is missing, cannot be listed, or has no usable weekly-usage cache, the plugin reports: **"Sign in to the Grok Bot app"**.
