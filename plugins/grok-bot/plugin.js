(function () {
  const DIR = "~/Library/Application Support/Grok Bot/sand-client-persistence"
  const LOGIN_HINT = "Sign in to the Grok Bot app"
  const STALE_AGE_MS = 60 * 60 * 1000
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000
  const B32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"

  // RFC 4648 base32, lowercase, unpadded input. Pure JS for QuickJS (no Node APIs).
  function base32Decode(input) {
    const s = String(input).toUpperCase()
    let bits = 0
    let value = 0
    let out = ""
    for (let i = 0; i < s.length; i += 1) {
      const idx = B32_ALPHABET.indexOf(s.charAt(i).toLowerCase())
      if (idx === -1) return null
      value = (value << 5) | idx
      bits += 5
      if (bits >= 8) {
        out += String.fromCharCode((value >>> (bits - 8)) & 0xff)
        bits -= 8
        value &= (1 << bits) - 1
      }
    }
    return out
  }

  function readNumber(value) {
    if (typeof value !== "number" && typeof value !== "string") return null
    if (typeof value === "string" && !value.trim()) return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }

  function isSensitiveName(name) {
    const lower = String(name).toLowerCase()
    return lower.indexOf("secret") !== -1 || lower.indexOf("cookie") !== -1
  }

  function parseCacheFile(text) {
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      return null
    }
    if (!parsed || typeof parsed !== "object") return null
    const value = parsed.value
    if (!value || typeof value !== "object") return null
    if (value.kind !== "present") return null

    const reading = value.reading
    if (!reading || typeof reading !== "object") return null
    const readAtMs = readNumber(reading.readAtMs)
    if (readAtMs === null) return null

    const usage = reading.usage
    if (!usage || typeof usage !== "object") return null
    const percentUsed = readNumber(usage.percentUsed)
    if (percentUsed === null) return null

    const expiresAtMs =
      readNumber(parsed.expiresAtMs) !== null
        ? readNumber(parsed.expiresAtMs)
        : readNumber(value.expiresAtMs)

    return {
      readAtMs,
      expiresAtMs,
      percentUsed: Math.min(100, Math.max(0, percentUsed)),
      nextResetMs: readNumber(usage.nextResetMs),
      plan: typeof usage.grokPlanLabel === "string" && usage.grokPlanLabel.trim()
        ? usage.grokPlanLabel
        : null,
    }
  }

  function probe(ctx) {
    let entries
    try {
      if (!ctx.host.fs.exists(DIR)) throw new Error("missing dir")
      entries = ctx.host.fs.listDir(DIR)
    } catch (e) {
      ctx.host.log.warn("grok bot cache dir unavailable: " + String(e))
      throw LOGIN_HINT
    }

    let newest = null
    for (let i = 0; i < entries.length; i += 1) {
      const entry = String(entries[i])
      if (!entry.endsWith(".blob")) continue
      const decoded = base32Decode(entry.slice(0, -".blob".length))
      if (decoded === null) continue
      if (isSensitiveName(decoded)) continue
      if (!decoded.endsWith(".weekly-usage.cache")) continue

      let text
      try {
        text = ctx.host.fs.readText(DIR + "/" + entry)
      } catch (e) {
        ctx.host.log.warn("failed to read cache file " + entry + ": " + String(e))
        continue
      }
      const record = parseCacheFile(text)
      if (!record) continue
      if (!newest || record.readAtMs > newest.readAtMs) newest = record
    }

    if (!newest) {
      ctx.host.log.warn("no usable weekly usage cache found")
      throw LOGIN_HINT
    }

    const nowMs = Date.now()
    const stale =
      (newest.expiresAtMs !== null && nowMs > newest.expiresAtMs) ||
      nowMs - newest.readAtMs > STALE_AGE_MS

    const lines = [
      ctx.line.progress({
        label: "Weekly Usage",
        used: newest.percentUsed,
        limit: 100,
        format: { kind: "percent" },
        resetsAt: newest.nextResetMs !== null ? new Date(newest.nextResetMs).toISOString() : undefined,
        periodDurationMs: WEEK_MS,
      }),
    ]
    if (stale) {
      lines.push(
        ctx.line.badge({
          label: "Status",
          text: "Open Grok Bot to refresh",
          color: "#f59e0b",
        })
      )
    }

    return { plan: newest.plan, lines }
  }

  globalThis.__watchtower_plugin = { id: "grok-bot", probe }
})()
