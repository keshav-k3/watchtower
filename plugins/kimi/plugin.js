(function () {
  // Kimi Code CLI (current) keeps its login under ~/.kimi-code (or
  // $KIMI_CODE_HOME): credentials/kimi-code.json for the official slot, or
  // credentials/kimi-code-env-<id>.json for a scoped environment. The older
  // CLI used ~/.kimi/credentials/kimi-code.json.
  const KIMI_CODE_HOME_DEFAULT = "~/.kimi-code"
  const LEGACY_CRED_PATH = "~/.kimi/credentials/kimi-code.json"
  const DEFAULT_API_BASE = "https://api.kimi.com/coding/v1"
  const DEFAULT_OAUTH_HOST = "https://auth.kimi.com"
  const CLIENT_ID = "17e5f671-d194-4dfb-9706-5516cb48c098"
  // Refresh only once the token has actually expired. The Kimi CLI refreshes
  // early on its own; refreshing ahead of it could race the CLI over the
  // same refresh token.
  const REFRESH_BUFFER_SEC = 0
  const FIVE_HOURS_MS = 5 * 60 * 60 * 1000
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

  function readNumber(value) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }

  function titleCaseWords(value) {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/\b[a-z]/g, function (c) {
        return c.toUpperCase()
      })
  }

  function parsePlanLabel(data) {
    const level =
      data &&
      data.user &&
      data.user.membership &&
      typeof data.user.membership.level === "string"
        ? data.user.membership.level
        : null
    if (!level) return null

    const cleaned = level.replace(/^LEVEL_/, "").replace(/_/g, " ")
    const label = titleCaseWords(cleaned)
    return label || null
  }

  function kimiCodeHome(ctx) {
    try {
      if (ctx.host.env && typeof ctx.host.env.get === "function") {
        const value = ctx.host.env.get("KIMI_CODE_HOME")
        if (typeof value === "string" && value.trim()) return value.trim().replace(/\/+$/, "")
      }
    } catch (e) {
      ctx.host.log.warn("KIMI_CODE_HOME lookup failed: " + String(e))
    }
    return KIMI_CODE_HOME_DEFAULT
  }

  function readConfigValue(text, key) {
    const match = new RegExp("^\\s*" + key + "\\s*=\\s*\"([^\"]+)\"", "m").exec(text)
    return match ? match[1].trim().replace(/\/+$/, "") : null
  }

  // Endpoints come from the CLI's config.toml when it names them
  // (e.g. api.kimi.ai / auth.kimi.ai); otherwise use the defaults.
  function loadEndpoints(ctx, home) {
    const endpoints = { apiBase: DEFAULT_API_BASE, oauthHost: DEFAULT_OAUTH_HOST }
    if (!home) return endpoints
    const configPath = home + "/config.toml"
    try {
      if (!ctx.host.fs.exists(configPath)) return endpoints
      const text = ctx.host.fs.readText(configPath)
      const sectionStart = text.indexOf('[providers."managed:kimi-code"')
      const scoped = sectionStart === -1 ? text : text.slice(sectionStart)
      const baseUrl = readConfigValue(scoped, "base_url")
      const oauthHost = readConfigValue(scoped, "oauth_host")
      if (baseUrl && /^https:\/\//.test(baseUrl)) endpoints.apiBase = baseUrl
      if (oauthHost && /^https:\/\//.test(oauthHost)) endpoints.oauthHost = oauthHost
    } catch (e) {
      ctx.host.log.warn("kimi config read failed: " + String(e))
    }
    return endpoints
  }

  function readCredentialFile(ctx, path) {
    try {
      if (!ctx.host.fs.exists(path)) return null
      const parsed = ctx.util.tryParseJson(ctx.host.fs.readText(path))
      if (!parsed || typeof parsed !== "object") {
        ctx.host.log.warn("credentials file is not valid json: " + path)
        return null
      }
      if (!parsed.access_token && !parsed.refresh_token) {
        ctx.host.log.warn("credentials missing access_token and refresh_token: " + path)
        return null
      }
      return parsed
    } catch (e) {
      ctx.host.log.warn("credentials read failed: " + String(e))
      return null
    }
  }

  function credentialCandidates(ctx, home) {
    const dir = home + "/credentials"
    const paths = [dir + "/kimi-code.json"]
    let names = []
    try {
      if (ctx.host.fs.exists(dir)) names = ctx.host.fs.listDir(dir)
    } catch (e) {
      ctx.host.log.warn("kimi credentials dir unreadable: " + String(e))
    }
    names
      .filter(function (name) {
        return /^kimi-code-env-[A-Za-z0-9_-]+\.json$/.test(name)
      })
      .sort()
      .forEach(function (name) {
        paths.push(dir + "/" + name)
      })
    return paths
  }

  function loadCredentials(ctx) {
    const home = kimiCodeHome(ctx)
    let best = null
    const paths = credentialCandidates(ctx, home)
    for (let i = 0; i < paths.length; i += 1) {
      const creds = readCredentialFile(ctx, paths[i])
      if (!creds) continue
      const expiresAt = readNumber(creds.expires_at) || 0
      if (!best || expiresAt > best.expiresAt) {
        best = { creds, path: paths[i], home, expiresAt }
      }
    }
    if (best) {
      return { creds: best.creds, path: best.path, endpoints: loadEndpoints(ctx, best.home) }
    }

    const legacy = readCredentialFile(ctx, LEGACY_CRED_PATH)
    if (legacy) {
      return { creds: legacy, path: LEGACY_CRED_PATH, endpoints: loadEndpoints(ctx, null) }
    }

    ctx.host.log.warn("credentials file not found in " + home + "/credentials or " + LEGACY_CRED_PATH)
    return null
  }

  function saveCredentials(ctx, path, creds) {
    try {
      ctx.host.fs.writeText(path, JSON.stringify(creds))
    } catch (e) {
      ctx.host.log.warn("failed to persist credentials: " + String(e))
    }
  }

  function needsRefresh(creds, nowSec) {
    if (!creds.access_token) return true
    const expiresAt = readNumber(creds.expires_at)
    if (expiresAt === null) return true
    return nowSec + REFRESH_BUFFER_SEC >= expiresAt
  }

  function refreshToken(ctx, session) {
    const creds = session.creds
    if (!creds.refresh_token) {
      ctx.host.log.warn("refresh skipped: no refresh token")
      return null
    }

    ctx.host.log.info("attempting token refresh")
    let resp
    try {
      resp = ctx.util.request({
        method: "POST",
        url: session.endpoints.oauthHost + "/api/oauth/token",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        bodyText:
          "client_id=" +
          encodeURIComponent(CLIENT_ID) +
          "&grant_type=refresh_token" +
          "&refresh_token=" +
          encodeURIComponent(creds.refresh_token),
        timeoutMs: 15000,
      })
    } catch (e) {
      ctx.host.log.error("refresh exception: " + String(e))
      return null
    }

    if (ctx.util.isAuthStatus(resp.status)) {
      throw "Session expired. Run `kimi login` to authenticate."
    }

    if (resp.status < 200 || resp.status >= 300) {
      ctx.host.log.warn("refresh returned unexpected status: " + resp.status)
      return null
    }

    const body = ctx.util.tryParseJson(resp.bodyText)
    if (!body || !body.access_token) {
      ctx.host.log.warn("refresh response missing access_token")
      return null
    }

    creds.access_token = body.access_token
    if (body.refresh_token) creds.refresh_token = body.refresh_token
    if (typeof body.expires_in === "number") {
      creds.expires_at = Date.now() / 1000 + body.expires_in
    }
    if (typeof body.scope === "string") creds.scope = body.scope
    if (typeof body.token_type === "string") creds.token_type = body.token_type

    saveCredentials(ctx, session.path, creds)
    return creds.access_token
  }

  function fetchUsage(ctx, endpoints, accessToken) {
    return ctx.util.request({
      method: "GET",
      url: endpoints.apiBase + "/usages",
      headers: {
        Authorization: "Bearer " + accessToken,
        Accept: "application/json",
        "User-Agent": "Watchtower",
      },
      timeoutMs: 10000,
    })
  }

  function parseWindowPeriodMs(window) {
    if (!window || typeof window !== "object") return null
    const duration = readNumber(window.duration)
    if (duration === null || duration <= 0) return null

    const unit = String(window.timeUnit || window.time_unit || "").toUpperCase()
    if (unit.indexOf("MINUTE") !== -1) return duration * 60 * 1000
    if (unit.indexOf("HOUR") !== -1) return duration * 60 * 60 * 1000
    if (unit.indexOf("DAY") !== -1) return duration * 24 * 60 * 60 * 1000
    if (unit.indexOf("SECOND") !== -1) return duration * 1000
    return null
  }

  function parseQuota(row, ctx) {
    if (!row || typeof row !== "object") return null

    const limit = readNumber(row.limit)
    if (limit === null || limit <= 0) return null

    let used = readNumber(row.used)
    if (used === null) {
      const remaining = readNumber(row.remaining)
      if (remaining !== null) {
        used = limit - remaining
      }
    }
    if (used === null) return null

    return {
      used,
      limit,
      resetsAt: ctx.util.toIso(row.resetTime || row.reset_at || row.resetAt || row.reset_time),
    }
  }

  function toPercentUsage(quota) {
    const usedPercent = (quota.used / quota.limit) * 100
    return {
      used: Math.round(Math.max(0, usedPercent) * 10) / 10,
      limit: 100,
      resetsAt: quota.resetsAt,
    }
  }

  function collectLimitCandidates(ctx, data) {
    const limits = Array.isArray(data && data.limits) ? data.limits : []
    const out = []

    for (let i = 0; i < limits.length; i += 1) {
      const item = limits[i]
      const detail = item && typeof item.detail === "object" ? item.detail : item
      const quota = parseQuota(detail, ctx)
      if (!quota) continue

      const periodMs = parseWindowPeriodMs(item && item.window)
      out.push({ quota, periodMs })
    }

    return out
  }

  function pickSessionCandidate(candidates) {
    if (!candidates.length) return null
    const sorted = candidates.slice().sort(function (a, b) {
      const aKnown = typeof a.periodMs === "number"
      const bKnown = typeof b.periodMs === "number"
      if (aKnown && bKnown) return a.periodMs - b.periodMs
      if (aKnown) return -1
      if (bKnown) return 1
      return 0
    })
    return sorted[0]
  }

  function longerWindowLabel(candidate) {
    if (candidate && candidate.fromUsageBlock) return "Monthly"
    const ms = candidate && candidate.periodMs
    if (typeof ms !== "number") return "Limit"
    const day = 24 * 60 * 60 * 1000
    if (ms >= 28 * day) return "Monthly"
    if (ms >= 6 * day) return "Weekly"
    if (ms >= 20 * 60 * 60 * 1000) return "Daily"
    return "Limit"
  }

  function pickLargestByPeriod(candidates) {
    if (!candidates.length) return null
    let best = candidates[0]
    for (let i = 1; i < candidates.length; i += 1) {
      const cur = candidates[i]
      const curMs = typeof cur.periodMs === "number" ? cur.periodMs : -1
      const bestMs = typeof best.periodMs === "number" ? best.periodMs : -1
      if (curMs > bestMs) best = cur
    }
    return best
  }

  function sameQuota(a, b) {
    if (!a || !b) return false
    return (
      a.quota.used === b.quota.used &&
      a.quota.limit === b.quota.limit &&
      (a.quota.resetsAt || null) === (b.quota.resetsAt || null)
    )
  }

  function readRatioQuota(ctx, raw) {
    if (!raw || typeof raw !== "object") return null
    const ratio = readNumber(raw.used_ratio !== undefined ? raw.used_ratio : raw.usedRatio)
    if (ratio === null) return null
    return {
      used: Math.round(Math.max(0, ratio) * 1000) / 10,
      resetsAt: ctx.util.toIso(raw.reset_time || raw.resetTime || raw.reset_at || raw.resetAt),
    }
  }

  // Current Kimi Code API: `usages` holds ratio-based windows, the same ones
  // the CLI's /usage shows (5h limit, Monthly limit = limit_month_total).
  function ratioUsageLines(ctx, data) {
    const usages = data && typeof data.usages === "object" ? data.usages : null
    if (!usages) return []
    const rows = [
      { key: "limit_5h", label: "Session", periodMs: FIVE_HOURS_MS },
      { key: "limit_month_total", label: "Monthly", periodMs: undefined },
      { key: "limit_7d", label: "Weekly", periodMs: SEVEN_DAYS_MS },
    ]
    const lines = []
    for (let i = 0; i < rows.length; i += 1) {
      const quota = readRatioQuota(ctx, usages[rows[i].key])
      if (!quota) continue
      lines.push(
        ctx.line.progress({
          label: rows[i].label,
          used: quota.used,
          limit: 100,
          format: { kind: "percent" },
          resetsAt: quota.resetsAt || undefined,
          periodDurationMs: rows[i].periodMs,
        })
      )
    }
    return lines
  }

  function probe(ctx) {
    const session = loadCredentials(ctx)
    if (!session) {
      throw "Not logged in. Run `kimi login` to authenticate."
    }
    const creds = session.creds

    const nowSec = Date.now() / 1000
    let accessToken = creds.access_token || ""

    if (needsRefresh(creds, nowSec)) {
      const refreshed = refreshToken(ctx, session)
      if (refreshed) {
        accessToken = refreshed
      } else if (!accessToken) {
        throw "Not logged in. Run `kimi login` to authenticate."
      }
    }

    let didRefresh = false
    let resp
    try {
      resp = ctx.util.retryOnceOnAuth({
        request: function (token) {
          return fetchUsage(ctx, session.endpoints, token || accessToken)
        },
        refresh: function () {
          didRefresh = true
          const refreshed = refreshToken(ctx, session)
          if (refreshed) accessToken = refreshed
          return refreshed
        },
      })
    } catch (e) {
      if (typeof e === "string") throw e
      if (didRefresh) {
        throw "Usage request failed after refresh. Try again."
      }
      throw "Usage request failed. Check your connection."
    }

    if (ctx.util.isAuthStatus(resp.status)) {
      throw "Token expired. Run `kimi login` to authenticate."
    }
    if (resp.status < 200 || resp.status >= 300) {
      throw "Usage request failed (HTTP " + String(resp.status) + "). Try again later."
    }

    const data = ctx.util.tryParseJson(resp.bodyText)
    if (!data || typeof data !== "object") {
      throw "Usage response invalid. Try again later."
    }

    const ratioLines = ratioUsageLines(ctx, data)
    if (ratioLines.length > 0) {
      return { plan: parsePlanLabel(data), lines: ratioLines }
    }

    const lines = []
    const candidates = collectLimitCandidates(ctx, data)
    const sessionCandidate = pickSessionCandidate(candidates)

    let longerCandidate = null
    const usageQuota = parseQuota(data.usage, ctx)
    if (usageQuota) {
      // Kimi Code's /usage command shows this top-level bucket as the monthly
      // limit. The payload itself does not name the period.
      longerCandidate = { quota: usageQuota, periodMs: null, fromUsageBlock: true }
    } else {
      const withoutSession = candidates.filter(function (candidate) {
        return candidate !== sessionCandidate
      })
      longerCandidate = pickLargestByPeriod(withoutSession)
    }

    if (sessionCandidate) {
      const sessionPercent = toPercentUsage(sessionCandidate.quota)
      lines.push(
        ctx.line.progress({
          label: "Session",
          used: sessionPercent.used,
          limit: sessionPercent.limit,
          format: { kind: "percent" },
          resetsAt: sessionPercent.resetsAt || undefined,
          periodDurationMs:
            typeof sessionCandidate.periodMs === "number"
              ? sessionCandidate.periodMs
              : undefined,
        })
      )
    }

    if (longerCandidate && !sameQuota(longerCandidate, sessionCandidate)) {
      const longerPercent = toPercentUsage(longerCandidate.quota)
      lines.push(
        ctx.line.progress({
          label: longerWindowLabel(longerCandidate),
          used: longerPercent.used,
          limit: longerPercent.limit,
          format: { kind: "percent" },
          resetsAt: longerPercent.resetsAt || undefined,
          periodDurationMs:
            typeof longerCandidate.periodMs === "number"
              ? longerCandidate.periodMs
              : undefined,
        })
      )
    }

    if (lines.length === 0) {
      lines.push(ctx.line.badge({ label: "Status", text: "No usage data", color: "#a3a3a3" }))
    }

    return {
      plan: parsePlanLabel(data),
      lines,
    }
  }

  globalThis.__watchtower_plugin = { id: "kimi", probe }
})()
