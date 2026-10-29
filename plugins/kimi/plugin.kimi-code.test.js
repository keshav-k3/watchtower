import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeCtx } from "../test-helpers.js"

const ENV_CRED = "~/.kimi-code/credentials/kimi-code-env-0e4f99c69cc27850.json"
const CONFIG = "~/.kimi-code/config.toml"

// Shape returned by https://api.kimi.com/coding/v1/usages for current
// Kimi Code logins (values match what `kimi` /usage showed on Linux).
const USAGES_BODY = {
  limits: [
    {
      window: { duration: 300, timeUnit: "TIME_UNIT_MINUTE" },
      detail: { limit: "100", remaining: "100", resetTime: "2099-10-29T16:53:37.965149Z" },
    },
  ],
  usages: {
    limit_5h: { used_ratio: 0.42, reset_time: "2099-10-29T16:53:37Z" },
    limit_month_total: { used_ratio: 0.7579, reset_time: "2099-11-16T00:00:00Z" },
    limit_month_code: { used_ratio: 0.7339, reset_time: "2099-11-16T00:00:00Z" },
  },
}

const loadPlugin = async () => {
  await import("./plugin.js")
  return globalThis.__watchtower_plugin
}

const freshCreds = (overrides = {}) =>
  JSON.stringify({
    access_token: "cli-access",
    refresh_token: "cli-refresh",
    expires_at: Date.now() / 1000 + 600,
    scope: "kimi-code",
    token_type: "Bearer",
    expires_in: 900,
    ...overrides,
  })

describe("kimi plugin with the Kimi Code CLI (~/.kimi-code)", () => {
  beforeEach(() => {
    delete globalThis.__watchtower_plugin
    vi.resetModules()
  })

  it("reads a scoped kimi-code-env login and shows 5h + monthly usage with resets", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(ENV_CRED, freshCreds())
    ctx.host.http.request.mockReturnValue({ status: 200, bodyText: JSON.stringify(USAGES_BODY) })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    const session = result.lines.find((line) => line.label === "Session")
    const monthly = result.lines.find((line) => line.label === "Monthly")
    expect(session).toMatchObject({ used: 42, limit: 100, periodDurationMs: 5 * 60 * 60 * 1000 })
    expect(session.resetsAt).toBe("2099-10-29T16:53:37.000Z")
    expect(monthly).toMatchObject({ used: 75.8, limit: 100 })
    expect(monthly.resetsAt).toBe("2099-11-16T00:00:00.000Z")

    const call = ctx.host.http.request.mock.calls[0][0]
    expect(call.url).toBe("https://api.kimi.com/coding/v1/usages")
    expect(call.headers.Authorization).toBe("Bearer cli-access")
  })

  it("uses the API base and OAuth host from the CLI's config.toml", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(ENV_CRED, freshCreds({ expires_at: 1 }))
    ctx.host.fs.writeText(
      CONFIG,
      [
        'default_model = "kimi-code/k3"',
        '[providers."managed:kimi-code"]',
        'type = "kimi"',
        'base_url = "https://api.kimi.ai/coding/v1"',
        '[providers."managed:kimi-code".oauth]',
        'storage = "file"',
        'oauth_host = "https://auth.kimi.ai"',
      ].join("\n")
    )
    ctx.host.http.request.mockImplementation((opts) => {
      if (String(opts.url).endsWith("/api/oauth/token")) {
        return {
          status: 200,
          bodyText: JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 900 }),
        }
      }
      return { status: 200, bodyText: JSON.stringify(USAGES_BODY) }
    })

    const plugin = await loadPlugin()
    plugin.probe(ctx)

    const urls = ctx.host.http.request.mock.calls.map((c) => c[0].url)
    expect(urls).toEqual(["https://auth.kimi.ai/api/oauth/token", "https://api.kimi.ai/coding/v1/usages"])
    // Refreshed tokens go back to the CLI's own file so the CLI stays logged in.
    const saved = JSON.parse(ctx.host.fs.readText(ENV_CRED))
    expect(saved).toMatchObject({ access_token: "new-access", refresh_token: "new-refresh" })
  })

  it("does not refresh a token the CLI still considers valid", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(ENV_CRED, freshCreds({ expires_at: Date.now() / 1000 + 60 }))
    ctx.host.http.request.mockReturnValue({ status: 200, bodyText: JSON.stringify(USAGES_BODY) })

    const plugin = await loadPlugin()
    plugin.probe(ctx)

    const urls = ctx.host.http.request.mock.calls.map((c) => c[0].url)
    expect(urls.some((url) => url.includes("/oauth/token"))).toBe(false)
  })

  it("prefers the official kimi-code.json slot layout and honours KIMI_CODE_HOME", async () => {
    const ctx = makeCtx()
    ctx.host.env.get.mockImplementation((name) => (name === "KIMI_CODE_HOME" ? "/opt/kimi-home" : null))
    ctx.host.fs.writeText("/opt/kimi-home/credentials/kimi-code.json", freshCreds({ access_token: "home-access" }))
    ctx.host.http.request.mockReturnValue({ status: 200, bodyText: JSON.stringify(USAGES_BODY) })

    const plugin = await loadPlugin()
    plugin.probe(ctx)

    expect(ctx.host.http.request.mock.calls[0][0].headers.Authorization).toBe("Bearer home-access")
  })

  it("picks the freshest login when several env slots exist", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(
      "~/.kimi-code/credentials/kimi-code-env-aaaa.json",
      freshCreds({ access_token: "stale", expires_at: Date.now() / 1000 + 10 })
    )
    ctx.host.fs.writeText(ENV_CRED, freshCreds({ access_token: "fresh", expires_at: Date.now() / 1000 + 800 }))
    ctx.host.http.request.mockReturnValue({ status: 200, bodyText: JSON.stringify(USAGES_BODY) })

    const plugin = await loadPlugin()
    plugin.probe(ctx)

    expect(ctx.host.http.request.mock.calls[0][0].headers.Authorization).toBe("Bearer fresh")
  })

  it("still reports not logged in when no Kimi credentials exist anywhere", async () => {
    const ctx = makeCtx()
    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Not logged in")
  })
})
