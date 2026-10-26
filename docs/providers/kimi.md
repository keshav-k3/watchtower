# Kimi Code

> Reverse-engineered, undocumented API. May change without notice.

## Overview

- **Protocol:** REST (plain JSON)
- **Base URL:** `https://api.kimi.com/coding/v1`
- **Auth provider:** `https://auth.kimi.com` (OAuth 2.0)
- **Client ID:** `17e5f671-d194-4dfb-9706-5516cb48c098`
- **Token store:** `~/.kimi/credentials/kimi-code.json`

## Endpoints

### GET /usages

Returns overall usage and at least one windowed quota.

#### Headers

| Header | Required | Value |
|---|---|---|
| Authorization | yes | `Bearer <access_token>` |
| Accept | yes | `application/json` |

#### Example Response

```jsonc
{
  "usage": {
    "limit": "100",
    "remaining": "74",
    "resetTime": "2026-02-11T17:32:50.757941Z"
  },
  "limits": [
    {
      "window": {
        "duration": 300,
        "timeUnit": "TIME_UNIT_MINUTE"
      },
      "detail": {
        "limit": "100",
        "remaining": "85",
        "resetTime": "2026-02-07T12:32:50.757941Z"
      }
    }
  ],
  "user": {
    "membership": {
      "level": "LEVEL_INTERMEDIATE"
    }
  }
}
```

### POST https://auth.kimi.com/api/oauth/token

Refreshes `access_token` using `refresh_token`.

#### Request

`application/x-www-form-urlencoded`

```text
client_id=17e5f671-d194-4dfb-9706-5516cb48c098
grant_type=refresh_token
refresh_token=<refresh_token>
```

#### Response

```json
{
  "access_token": "<new_access_token>",
  "refresh_token": "<new_refresh_token>",
  "expires_in": 3600,
  "scope": "kimi-code",
  "token_type": "Bearer"
}
```

## Authentication File

`~/.kimi/credentials/kimi-code.json`

```jsonc
{
  "access_token": "<token>",
  "refresh_token": "<token>",
  "expires_at": 1769861835.261056,
  "scope": "kimi-code",
  "token_type": "Bearer"
}
```

## Notes

- The plugin refreshes tokens when near expiry (5-minute buffer).
- If refresh is rejected (401/403), user must run `kimi login` again.
- `limits[]` entries include a window. `duration: 300` and `TIME_UNIT_MINUTE` is the 5-hour session, shown as **Session**.
- The top-level `usage` object has no period name. Kimi Code's `/usage` command presents that bucket as the monthly limit, so Watchtower labels it **Monthly** and shows `resetTime` only when the payload includes it.
- If `usage` is missing, the longest `limits[]` window is labeled from its duration (`Daily`, `Weekly`, `Monthly`). A window with no recognizable duration is labeled **Limit** rather than guessed.
