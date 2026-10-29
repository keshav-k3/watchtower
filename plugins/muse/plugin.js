(function () {
  // Muse Code (Meta) subscription allowance.
  //
  // Source: the official `muse usage --json` command (Muse Code 1.4.13+), which shows the
  // 5-hour window, the weekly block, reset times and tier without running a model turn.
  // The host runs that one fixed command for this plugin only (ctx.host.muse.usage); the
  // plugin never reads Muse's auth file or calls Meta's endpoints itself.
  const LOGIN_HINT = "Not logged in. Run `muse login` to sign in."
  const INSTALL_HINT = "Muse Code CLI not found. Install it from dev.meta.ai/docs/muse-code."
  const FIVE_HOURS_MS = 5 * 60 * 60 * 1000
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000

  function readNumber(value) {
    if (typeof value !== "number" && typeof value !== "string") return null
    if (typeof value === "string" && !value.trim()) return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }

  function pick(obj, keys) {
    if (!obj || typeof obj !== "object") return undefined
    for (let i = 0; i < keys.length; i += 1) {
      if (obj[keys[i]] !== undefined && obj[keys[i]] !== null) return obj[keys[i]]
    }
    return undefined
  }

  // Epoch ms from `resetsAtMs`, or `resetsAt` as epoch seconds/ms or an ISO string.
  function readResetMs(block) {
    const ms = readNumber(pick(block, ["resetsAtMs", "resets_at_ms"]))
    if (ms !== null) return ms
    const raw = pick(block, ["resetsAt", "resets_at"])
    const n = readNumber(raw)
    if (n !== null) return n < 1e12 ? n * 1000 : n
    if (typeof raw === "string") {
      const parsed = Date.parse(raw)
      if (Number.isFinite(parsed)) return parsed
    }
    return null
  }

  function readBlock(block) {
    if (!block || typeof block !== "object") return null
    const usedPercent = readNumber(pick(block, ["usedPercent", "used_percent"]))
    if (usedPercent === null) return null
    const durationMins = readNumber(pick(block, ["windowDurationMins", "window_duration_mins"]))
    return {
      usedPercent: Math.min(100, Math.max(0, usedPercent)),
      resetsAtMs: readResetMs(block),
      durationMs: durationMins !== null && durationMins > 0 ? durationMins * 60 * 1000 : null,
    }
  }

  // `muse usage --json` prints one object. Accept the protocol's camelCase usage shape
  // ({window, weekly, tier, observedAtMs}), optionally wrapped in `usage`, and the
  // server's snake_case `subs_usage` shape.
  function parseUsage(text) {
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      return null
    }
    if (!parsed || typeof parsed !== "object") return null
    const usage = pick(parsed, ["usage", "subs_usage", "subsUsage", "allowance"]) || parsed
    const windowBlock = readBlock(usage.window)
    const weeklyBlock = readBlock(usage.weekly)
    const tier = pick(parsed, ["tierName", "tier_name", "subs_tier_name"]) || pick(usage, ["tierName", "tier"])
    const status = pick(parsed, ["status", "reason"])
    return {
      windowBlock,
      weeklyBlock,
      tier: typeof tier === "string" && tier.trim() ? tier.trim() : null,
      status: typeof status === "string" ? status : null,
    }
  }

  function runUsage(ctx) {
    if (!ctx.host.muse || typeof ctx.host.muse.usage !== "function") {
      throw "Muse usage is not available in this Watchtower build."
    }
    let envelope
    try {
      envelope = JSON.parse(ctx.host.muse.usage())
    } catch (e) {
      ctx.host.log.warn("muse usage envelope invalid: " + String(e))
      throw "Muse usage request failed. Try again."
    }
    const status = envelope && envelope.status
    if (status === "ok") return String(envelope.stdout || "")
    if (status === "not_installed") throw INSTALL_HINT
    if (status === "not_logged_in") throw LOGIN_HINT
    if (status === "timed_out") throw "Muse Code did not answer in time. Try again."
    ctx.host.log.warn("muse usage failed: " + String((envelope && envelope.message) || status))
    throw "Muse usage request failed. Check your connection and try again."
  }

  function progressLine(ctx, label, block, fallbackDurationMs) {
    return ctx.line.progress({
      label,
      used: block.usedPercent,
      limit: 100,
      format: { kind: "percent" },
      resetsAt: block.resetsAtMs !== null ? new Date(block.resetsAtMs).toISOString() : undefined,
      periodDurationMs: block.durationMs || fallbackDurationMs,
    })
  }

  function probe(ctx) {
    const usage = parseUsage(runUsage(ctx))
    if (!usage) throw "Muse usage response invalid. Update Muse Code and try again."

    if (!usage.windowBlock && !usage.weeklyBlock) {
      if (usage.status === "api_key") {
        throw "Muse Code is signed in with an API key. Allowance is shown for subscription logins only."
      }
      throw "No Muse Code subscription allowance found for this account."
    }

    const lines = []
    if (usage.windowBlock) lines.push(progressLine(ctx, "Session", usage.windowBlock, FIVE_HOURS_MS))
    if (usage.weeklyBlock) lines.push(progressLine(ctx, "Weekly", usage.weeklyBlock, WEEK_MS))
    return { plan: usage.tier ? ctx.fmt.planLabel(usage.tier) : null, lines }
  }

  globalThis.__watchtower_plugin = { id: "muse", probe }
})()
