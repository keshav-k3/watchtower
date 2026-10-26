import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeCtx } from "../test-helpers.js"

const CRED_PATH = "~/.kimi/credentials/kimi-code.json"

const loadPlugin = async () => {
  await import("./plugin.js")
  return globalThis.__watchtower_plugin
}

describe("kimi plugin", () => {
  beforeEach(() => {
    delete globalThis.__watchtower_plugin
    vi.resetModules()
  })

  it("throws when credentials are missing", async () => {
    const ctx = makeCtx()
    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Not logged in")
  })

  it("refreshes token and renders session + weekly usage", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "old-token",
        refresh_token: "refresh-token",
        expires_at: 1,
      })
    )

    ctx.host.http.request.mockImplementation((opts) => {
      const url = String(opts.url)
      if (url.includes("/api/oauth/token")) {
        return {
          status: 200,
          bodyText: JSON.stringify({
            access_token: "new-token",
            refresh_token: "new-refresh",
            expires_in: 3600,
            scope: "kimi-code",
            token_type: "Bearer",
          }),
        }
      }

      return {
        status: 200,
        bodyText: JSON.stringify({
          usage: {
            limit: "100",
            remaining: "74",
            resetTime: "2099-02-11T17:32:50.757941Z",
          },
          limits: [
            {
              window: { duration: 300, timeUnit: "TIME_UNIT_MINUTE" },
              detail: {
                limit: "100",
                remaining: "85",
                resetTime: "2099-02-07T12:32:50.757941Z",
              },
            },
          ],
          user: {
            membership: {
              level: "LEVEL_INTERMEDIATE",
            },
          },
        }),
      }
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(result.plan).toBe("Intermediate")
    expect(result.lines.find((line) => line.label === "Session")).toBeTruthy()
    expect(result.lines.find((line) => line.label === "Monthly")).toBeTruthy()

    const persisted = JSON.parse(ctx.host.fs.readText(CRED_PATH))
    expect(persisted.access_token).toBe("new-token")
    expect(persisted.refresh_token).toBe("new-refresh")
  })

  it("retries usage once on 401 by refreshing token", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        refresh_token: "refresh-token",
        expires_at: nowSec + 3600,
      })
    )

    let usageCalls = 0
    ctx.host.http.request.mockImplementation((opts) => {
      const url = String(opts.url)
      if (url.includes("/usages")) {
        usageCalls += 1
        if (usageCalls === 1) {
          return { status: 401, bodyText: "" }
        }
        return {
          status: 200,
          bodyText: JSON.stringify({
            usage: { limit: "100", remaining: "100", resetTime: "2099-02-11T00:00:00Z" },
            limits: [
              {
                window: { duration: 300, timeUnit: "TIME_UNIT_MINUTE" },
                detail: { limit: "100", remaining: "100", resetTime: "2099-02-07T00:00:00Z" },
              },
            ],
          }),
        }
      }

      return {
        status: 200,
        bodyText: JSON.stringify({
          access_token: "token-2",
          refresh_token: "refresh-2",
          expires_in: 3600,
        }),
      }
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(usageCalls).toBe(2)
    expect(result.lines.find((line) => line.label === "Session")).toBeTruthy()
  })

  it("throws session expired when refresh is unauthorized", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        refresh_token: "refresh-token",
        expires_at: 1,
      })
    )

    ctx.host.http.request.mockImplementation((opts) => {
      const url = String(opts.url)
      if (url.includes("/api/oauth/token")) {
        return { status: 401, bodyText: JSON.stringify({ error: "unauthorized" }) }
      }
      return { status: 500, bodyText: "" }
    })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Session expired")
  })

  it("throws on invalid usage payload", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        refresh_token: "refresh-token",
        expires_at: nowSec + 3600,
      })
    )

    ctx.host.http.request.mockReturnValue({
      status: 200,
      bodyText: "not-json",
    })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Usage response invalid")
  })

  it("treats malformed credentials file as not logged in", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(CRED_PATH, "{")

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Not logged in")
  })

  it("treats credentials without access and refresh tokens as not logged in", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(CRED_PATH, JSON.stringify({ access_token: "", refresh_token: "" }))

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Not logged in")
  })

  it("keeps existing access token when refresh returns non-2xx", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "old-token",
        refresh_token: "refresh-token",
        expires_at: 1,
      })
    )

    ctx.host.http.request.mockImplementation((opts) => {
      const url = String(opts.url)
      if (url.includes("/api/oauth/token")) {
        return { status: 500, bodyText: JSON.stringify({ error: "server_error" }) }
      }
      if (url.includes("/usages")) {
        return {
          status: 200,
          bodyText: JSON.stringify({
            usage: { limit: "100", remaining: "95", resetTime: "2099-02-11T00:00:00Z" },
            limits: [
              {
                window: { duration: 300, timeUnit: "TIME_UNIT_MINUTE" },
                detail: { limit: "100", remaining: "90", resetTime: "2099-02-07T00:00:00Z" },
              },
            ],
          }),
        }
      }
      return { status: 404, bodyText: "" }
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    const usageCall = ctx.host.http.request.mock.calls.find((call) =>
      String(call[0]?.url).includes("/usages")
    )
    expect(usageCall?.[0]?.headers?.Authorization).toBe("Bearer old-token")
    expect(result.lines.find((line) => line.label === "Session")).toBeTruthy()
  })

  it("throws token expired when usage remains unauthorized", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        expires_at: nowSec + 3600,
      })
    )
    ctx.host.http.request.mockReturnValue({ status: 401, bodyText: "" })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Token expired")
  })

  it("throws usage failed after refresh when second request throws", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        refresh_token: "refresh-token",
        expires_at: nowSec + 3600,
      })
    )

    let usageCalls = 0
    ctx.host.http.request.mockImplementation((opts) => {
      const url = String(opts.url)
      if (url.includes("/api/oauth/token")) {
        return {
          status: 200,
          bodyText: JSON.stringify({ access_token: "token-2", refresh_token: "refresh-2", expires_in: 3600 }),
        }
      }
      if (url.includes("/usages")) {
        usageCalls += 1
        if (usageCalls === 1) return { status: 401, bodyText: "" }
        throw new Error("network down")
      }
      return { status: 404, bodyText: "" }
    })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Usage request failed after refresh")
  })

  it("throws usage failed when first request throws", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        expires_at: nowSec + 3600,
      })
    )
    ctx.host.http.request.mockImplementation(() => {
      throw new Error("offline")
    })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Usage request failed. Check your connection.")
  })

  it("throws not logged in when refresh response is missing access token", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        refresh_token: "refresh-token",
        expires_at: 1,
      })
    )
    ctx.host.http.request.mockImplementation((opts) => {
      const url = String(opts.url)
      if (url.includes("/api/oauth/token")) {
        return { status: 200, bodyText: JSON.stringify({ scope: "kimi-code" }) }
      }
      return { status: 404, bodyText: "" }
    })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Not logged in")
  })

  it("returns badge when no valid quota is available", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        refresh_token: "refresh-token",
        expires_at: nowSec + 3600,
      })
    )
    ctx.host.http.request.mockReturnValue({
      status: 200,
      bodyText: JSON.stringify({
        usage: { limit: "0", remaining: "0", resetTime: "2099-02-11T00:00:00Z" },
        limits: [{ window: { duration: -5, timeUnit: "TIME_UNIT_DAY" }, detail: { limit: "0", used: "0" } }],
        user: { membership: { level: "LEVEL_FREE" } },
      }),
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(result.plan).toBe("Free")
    expect(result.lines).toEqual([{ type: "badge", label: "Status", text: "No usage data", color: "#a3a3a3" }])
  })

  it("omits weekly line when weekly and session quotas are identical", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        refresh_token: "refresh-token",
        expires_at: nowSec + 3600,
      })
    )
    ctx.host.http.request.mockReturnValue({
      status: 200,
      bodyText: JSON.stringify({
        usage: { limit: "100", remaining: "90", resetTime: "2099-02-11T00:00:00Z" },
        limits: [
          {
            window: { duration: 300, timeUnit: "TIME_UNIT_MINUTE" },
            detail: { limit: "100", remaining: "90", resetTime: "2099-02-11T00:00:00Z" },
          },
        ],
      }),
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(result.lines.find((line) => line.label === "Session")).toBeTruthy()
    expect(result.lines.find((line) => line.label === "Monthly")).toBeFalsy()
  })

  it("selects largest remaining period as weekly when usage block is absent", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        refresh_token: "refresh-token",
        expires_at: nowSec + 3600,
      })
    )
    ctx.host.http.request.mockReturnValue({
      status: 200,
      bodyText: JSON.stringify({
        limits: [
          {
            window: { duration: 5, timeUnit: "TIME_UNIT_MINUTE" },
            detail: { limit: "100", remaining: "80", resetTime: "2099-02-07T00:00:00Z" },
          },
          {
            window: { duration: 1, timeUnit: "TIME_UNIT_DAY" },
            detail: { limit: "100", remaining: "40", resetTime: "2099-02-08T00:00:00Z" },
          },
          {
            window: { duration: 1, timeUnit: "TIME_UNIT_HOUR" },
            detail: { limit: "100", remaining: "70", resetTime: "2099-02-07T01:00:00Z" },
          },
        ],
      }),
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(result.lines.find((line) => line.label === "Session")).toBeTruthy()
    const daily = result.lines.find((line) => line.label === "Daily")
    expect(daily).toBeTruthy()
    expect(daily.periodDurationMs).toBe(24 * 60 * 60 * 1000)
  })

  it("throws HTTP status error when usage endpoint returns non-2xx", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        expires_at: nowSec + 3600,
      })
    )
    ctx.host.http.request.mockReturnValue({ status: 500, bodyText: "" })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Usage request failed (HTTP 500)")
  })

  it("handles second and unknown limit units when picking session and weekly", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        expires_at: nowSec + 3600,
      })
    )
    ctx.host.http.request.mockReturnValue({
      status: 200,
      bodyText: JSON.stringify({
        limits: [
          {
            window: { duration: 1, timeUnit: "TIME_UNIT_YEAR" },
            detail: { limit: "100", remaining: "90", resetTime: "2099-02-07T00:00:00Z" },
          },
          {
            window: { duration: 30, timeUnit: "TIME_UNIT_SECOND" },
            detail: { limit: "100", remaining: "80", resetTime: "2099-02-07T00:00:30Z" },
          },
          {
            window: { duration: 2, timeUnit: "TIME_UNIT_UNKNOWN" },
            detail: { limit: "100", remaining: "70", resetTime: "2099-02-07T00:02:00Z" },
          },
        ],
      }),
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    const session = result.lines.find((line) => line.label === "Session")
    expect(session).toBeTruthy()
    expect(session.periodDurationMs).toBe(30 * 1000)
    expect(result.lines.find((line) => line.label === "Limit")).toBeTruthy()
  })

  it("handles all-unknown limit windows without crashing", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        expires_at: nowSec + 3600,
      })
    )
    ctx.host.http.request.mockReturnValue({
      status: 200,
      bodyText: JSON.stringify({
        limits: [
          {
            window: { duration: 1, timeUnit: "TIME_UNIT_UNKNOWN_A" },
            detail: { limit: "100", remaining: "95", resetTime: "2099-02-07T00:00:00Z" },
          },
          {
            window: { duration: 2, timeUnit: "TIME_UNIT_UNKNOWN_B" },
            detail: { limit: "100", remaining: "85", resetTime: "2099-02-08T00:00:00Z" },
          },
        ],
      }),
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(result.lines.find((line) => line.label === "Session")).toBeTruthy()
  })

  it("refreshes with minimal token payload and keeps existing optional fields", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "old-token",
        refresh_token: "refresh-token",
        expires_at: 1,
        scope: "existing-scope",
        token_type: "Bearer",
      })
    )
    ctx.host.http.request.mockImplementation((opts) => {
      const url = String(opts.url)
      if (url.includes("/api/oauth/token")) {
        return { status: 200, bodyText: JSON.stringify({ access_token: "new-token" }) }
      }
      return {
        status: 200,
        bodyText: JSON.stringify({
          limits: [
            {
              window: { duration: 300, timeUnit: "TIME_UNIT_MINUTE" },
              detail: { limit: "100", used: "20", reset_time: "2099-02-07T00:00:00Z" },
            },
          ],
        }),
      }
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines.find((line) => line.label === "Session")).toBeTruthy()
    const persisted = JSON.parse(ctx.host.fs.readText(CRED_PATH))
    expect(persisted.access_token).toBe("new-token")
    expect(persisted.scope).toBe("existing-scope")
    expect(persisted.token_type).toBe("Bearer")
  })

  it("supports root-level limits with snake_case window keys and remaining-based usage", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        expires_at: nowSec + 3600,
      })
    )
    ctx.host.http.request.mockReturnValue({
      status: 200,
      bodyText: JSON.stringify({
        limits: [
          {
            window: { duration: 1, time_unit: "TIME_UNIT_DAY" },
            limit: "200",
            remaining: "150",
            reset_at: "2099-02-08T00:00:00Z",
          },
          {
            // Invalid limit should be skipped.
            window: { duration: 0, time_unit: "TIME_UNIT_DAY" },
            limit: "0",
            remaining: "0",
          },
        ],
        user: { membership: { level: "LEVEL_" } },
      }),
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    const session = result.lines.find((line) => line.label === "Session")
    expect(session).toBeTruthy()
    expect(session.used).toBe(25) // (200-150)/200
    expect(session.periodDurationMs).toBe(24 * 60 * 60 * 1000)
    expect(result.plan).toBeNull()
  })

  it("adds weekly line from usage block when session candidate is unavailable", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({
        access_token: "token",
        expires_at: nowSec + 3600,
      })
    )
    ctx.host.http.request.mockReturnValue({
      status: 200,
      bodyText: JSON.stringify({
        usage: { limit: "500", used: "125", resetAt: "2099-02-11T00:00:00Z" },
        limits: [],
      }),
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines.find((line) => line.label === "Session")).toBeUndefined()
    const monthly = result.lines.find((line) => line.label === "Monthly")
    expect(monthly).toBeTruthy()
    expect(monthly.used).toBe(25)
  })

  it("logs credential and refresh failures without hiding them", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(CRED_PATH, "{")
    const readText = ctx.host.fs.readText
    ctx.host.fs.readText = (path) => {
      if (path === CRED_PATH) throw new Error("disk")
      return readText(path)
    }
    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Not logged in")
    expect(ctx.host.log.warn).toHaveBeenCalledWith(expect.stringContaining("credentials read failed"))

    const ctx2 = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx2.host.fs.writeText(CRED_PATH, JSON.stringify({
      refresh_token: "refresh-token",
      expires_at: nowSec - 10,
    }))
    ctx2.host.http.request.mockImplementation((opts) => {
      if (String(opts.url).includes("oauth/token")) throw new Error("offline")
      return { status: 200, headers: {}, bodyText: JSON.stringify({ usage: { limit: "10", used: "1" } }) }
    })
    expect(() => plugin.probe(ctx2)).toThrow("Not logged in")
    expect(ctx2.host.log.error).toHaveBeenCalledWith(expect.stringContaining("refresh exception"))

    const ctx3 = makeCtx()
    ctx3.host.fs.writeText(CRED_PATH, JSON.stringify({
      refresh_token: "refresh-token",
      expires_at: nowSec - 10,
    }))
    ctx3.host.fs.writeText = () => { throw new Error("readonly") }
    ctx3.host.http.request.mockImplementation((opts) => {
      if (String(opts.url).includes("oauth/token")) {
        return { status: 200, bodyText: JSON.stringify({ access_token: "new-token", expires_in: 3600 }) }
      }
      return { status: 200, bodyText: JSON.stringify({ usage: { limit: "10", used: "1" } }) }
    })
    const saved = plugin.probe(ctx3)
    expect(saved.lines.find((line) => line.label === "Monthly")).toBeTruthy()
    expect(ctx3.host.log.warn).toHaveBeenCalledWith(expect.stringContaining("failed to persist credentials"))
  })

  it("treats missing reset times as the same quota", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(CRED_PATH, JSON.stringify({ access_token: "token", expires_at: nowSec + 3600 }))
    ctx.host.http.request.mockReturnValue({
      status: 200,
      bodyText: JSON.stringify({
        usage: { limit: "10", remaining: "4" },
        limits: [
          {
            window: { duration: 300, timeUnit: "TIME_UNIT_MINUTE" },
            detail: { limit: "10", remaining: "4" },
          },
        ],
      }),
    })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines.filter((line) => line.type === "progress")).toHaveLength(1)
  })

  it("labels longer Kimi windows from their duration", async () => {
    const cases = [
      { duration: 8, unit: "TIME_UNIT_DAY", label: "Weekly" },
      { duration: 40, unit: "TIME_UNIT_DAY", label: "Monthly" },
      { duration: 2, unit: "TIME_UNIT_HOUR", label: "Limit" },
    ]
    for (const item of cases) {
      const ctx = makeCtx()
      const nowSec = Math.floor(Date.now() / 1000)
      ctx.host.fs.writeText(
        CRED_PATH,
        JSON.stringify({ access_token: "token", expires_at: nowSec + 3600 })
      )
      ctx.host.http.request.mockReturnValue({
        status: 200,
        bodyText: JSON.stringify({
          limits: [
            {
              window: { duration: 1, timeUnit: "TIME_UNIT_MINUTE" },
              detail: { limit: "10", remaining: "9", resetTime: "2099-02-07T00:01:00Z" },
            },
            {
              window: { duration: item.duration, timeUnit: item.unit },
              detail: { limit: "10", remaining: "4", resetTime: "2099-03-01T00:00:00Z" },
            },
          ],
        }),
      })
      const plugin = await loadPlugin()
      const result = plugin.probe(ctx)
      expect(result.lines.find((line) => line.label === item.label)).toBeTruthy()
    }
  })

  it("refreshes when the credentials have no expires_at", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({ access_token: "old-token", refresh_token: "refresh-token" })
    )
    ctx.host.http.request.mockImplementation((opts) => {
      const url = String(opts.url)
      if (url.includes("/api/oauth/token")) {
        return { status: 200, bodyText: JSON.stringify({ access_token: "new-token", expires_in: 3600 }) }
      }
      expect(opts.headers.Authorization).toBe("Bearer new-token")
      return {
        status: 200,
        bodyText: JSON.stringify({ usage: { limit: "100", remaining: "90", resetTime: "2099-02-11T00:00:00Z" } }),
      }
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines.find((line) => line.label === "Monthly")).toBeTruthy()
  })

  it("ignores limits with malformed windows", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({ access_token: "token", expires_at: nowSec + 3600 })
    )
    ctx.host.http.request.mockReturnValue({
      status: 200,
      bodyText: JSON.stringify({
        usage: { limit: "100", remaining: "90", resetTime: "2099-02-11T00:00:00Z" },
        limits: [
          { window: "weekly", detail: { limit: "100", remaining: "50" } },
          { window: {}, detail: { limit: "100", remaining: "60" } },
          { window: { duration: 5 }, detail: { limit: "100", remaining: "70" } },
          {
            window: { duration: 300, timeUnit: "TIME_UNIT_MINUTE" },
            detail: { limit: "100", remaining: "80", resetTime: "2099-02-07T00:00:00Z" },
          },
        ],
      }),
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    const session = result.lines.find((line) => line.label === "Session")
    expect(session).toBeTruthy()
    expect(session.periodDurationMs).toBe(300 * 60 * 1000)
    expect(result.lines.find((line) => line.label === "Monthly")).toBeTruthy()
  })

  it("skips limits that have neither used nor remaining values", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({ access_token: "token", expires_at: nowSec + 3600 })
    )
    ctx.host.http.request.mockReturnValue({
      status: 200,
      bodyText: JSON.stringify({
        limits: [
          { window: { duration: 5, timeUnit: "TIME_UNIT_MINUTE" }, detail: { limit: "100" } },
          {
            window: { duration: 300, timeUnit: "TIME_UNIT_MINUTE" },
            detail: { limit: "100", remaining: "75", resetTime: "2099-02-07T00:00:00Z" },
          },
        ],
      }),
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    const session = result.lines.find((line) => line.label === "Session")
    expect(session).toBeTruthy()
    expect(session.used).toBe(25)
  })

  it("picks a later candidate when it has the larger period", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({ access_token: "token", expires_at: nowSec + 3600 })
    )
    ctx.host.http.request.mockReturnValue({
      status: 200,
      bodyText: JSON.stringify({
        limits: [
          {
            window: { duration: 5, timeUnit: "TIME_UNIT_MINUTE" },
            detail: { limit: "100", remaining: "90", resetTime: "2099-02-07T00:00:00Z" },
          },
          {
            window: { duration: 1, timeUnit: "TIME_UNIT_HOUR" },
            detail: { limit: "100", remaining: "60", resetTime: "2099-02-07T01:00:00Z" },
          },
          {
            window: { duration: 7, timeUnit: "TIME_UNIT_DAY" },
            detail: { limit: "100", remaining: "40", resetTime: "2099-02-14T00:00:00Z" },
          },
        ],
      }),
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    const weekly = result.lines.find((line) => line.label === "Weekly")
    expect(weekly).toBeTruthy()
    expect(weekly.periodDurationMs).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it("rethrows the session error when refresh during retry is unauthorized", async () => {
    const ctx = makeCtx()
    const nowSec = Math.floor(Date.now() / 1000)
    ctx.host.fs.writeText(
      CRED_PATH,
      JSON.stringify({ access_token: "token", refresh_token: "refresh-token", expires_at: nowSec + 3600 })
    )
    ctx.host.http.request.mockImplementation((opts) => {
      const url = String(opts.url)
      if (url.includes("/api/oauth/token")) {
        return { status: 401, bodyText: JSON.stringify({ error: "unauthorized" }) }
      }
      return { status: 401, bodyText: "" }
    })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Session expired")
  })
})
