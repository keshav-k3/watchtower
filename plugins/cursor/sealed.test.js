import crypto from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeCtx } from "../test-helpers.js"

const PREFIX = "cursor-safe-storage:v1:"
const PASSWORD = "safe-storage-password"

const loadPlugin = async () => {
  await import("./plugin.js")
  return globalThis.__watchtower_plugin
}

function makeJwt(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64").replace(/=+$/g, "")
  return `a.${body}.c`
}

function seal(token, password = PASSWORD) {
  const key = crypto.pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1")
  const cipher = crypto.createCipheriv("aes-128-cbc", key, Buffer.alloc(16, 0x20))
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()])
  return PREFIX + Buffer.concat([Buffer.from("v10"), body]).toString("base64")
}

function open(stored, password = PASSWORD) {
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64")
  const key = crypto.pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1")
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, Buffer.alloc(16, 0x20))
  return Buffer.concat([decipher.update(raw.subarray(3)), decipher.final()]).toString("utf8")
}

function stateDb(ctx, values) {
  ctx.host.sqlite.query.mockImplementation((_db, sql) => {
    for (const [key, value] of Object.entries(values)) {
      if (String(sql).includes(key)) return JSON.stringify([{ value }])
    }
    return "[]"
  })
}

function keychain(ctx, { password = PASSWORD, cli = {} } = {}) {
  ctx.host.keychain.readGenericPassword.mockImplementation((service, account) => {
    if (service === "Cursor Safe Storage") {
      if (password && account === "Cursor Key") return password
      throw new Error("keychain item not found")
    }
    if (service in cli) return cli[service]
    throw new Error("keychain item not found")
  })
}

const USAGE_OK = {
  status: 200,
  bodyText: JSON.stringify({ enabled: true, planUsage: { totalSpend: 1200, limit: 2400 } }),
}

describe("cursor plugin with Cursor 3.27 sealed editor login", () => {
  beforeEach(() => {
    delete globalThis.__watchtower_plugin
    vi.resetModules()
  })

  it("opens the sealed editor token instead of posting ciphertext to the refresh endpoint", async () => {
    const ctx = makeCtx()
    const access = makeJwt({ exp: 9999999999, sub: "auth0|user_1" })
    stateDb(ctx, {
      "cursorAuth/accessToken": seal(access),
      "cursorAuth/refreshToken": seal(makeJwt({ sub: "auth0|user_1" })),
      "cursorAuth/stripeMembershipType": "team",
    })
    keychain(ctx)
    ctx.host.http.request.mockImplementation((opts) => {
      expect(String(opts.url)).not.toContain("/oauth/token")
      expect(opts.headers.Authorization).toBe("Bearer " + access)
      return USAGE_OK
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(result.lines.find((line) => line.label === "Total usage")).toBeTruthy()
    expect(ctx.host.keychain.readGenericPassword).toHaveBeenCalledWith("Cursor Safe Storage", "Cursor Key")
  })

  it("tries the legacy Cursor account name for the Safe Storage key", async () => {
    const ctx = makeCtx()
    const access = makeJwt({ exp: 9999999999 })
    stateDb(ctx, { "cursorAuth/accessToken": seal(access) })
    ctx.host.keychain.readGenericPassword.mockImplementation((service, account) => {
      if (service === "Cursor Safe Storage" && account === "Cursor") return PASSWORD
      if (service === "Cursor Safe Storage") return ""
      throw new Error("keychain item not found")
    })
    ctx.host.http.request.mockReturnValue(USAGE_OK)

    const plugin = await loadPlugin()
    expect(plugin.probe(ctx).lines.length).toBeGreaterThan(0)
  })

  it("writes a refreshed token back sealed, never as plaintext", async () => {
    const ctx = makeCtx()
    const refreshed = makeJwt({ exp: 9999999999, sub: "auth0|user_1" })
    stateDb(ctx, {
      "cursorAuth/accessToken": seal(makeJwt({ exp: 1, sub: "auth0|user_1" })),
      "cursorAuth/refreshToken": seal(makeJwt({ sub: "auth0|user_1" })),
    })
    keychain(ctx)
    ctx.host.http.request.mockImplementation((opts) => {
      if (String(opts.url).includes("/oauth/token")) {
        expect(JSON.parse(opts.bodyText).refresh_token).not.toContain(PREFIX)
        return { status: 200, bodyText: JSON.stringify({ access_token: refreshed }) }
      }
      return USAGE_OK
    })

    const plugin = await loadPlugin()
    plugin.probe(ctx)

    const sql = ctx.host.sqlite.exec.mock.calls[0][1]
    expect(sql).not.toContain(refreshed)
    const written = sql.match(/'(cursor-safe-storage:v1:[^']+)'/)[1]
    expect(open(written)).toBe(refreshed)
  })

  it("falls back to the CLI login when the Safe Storage key is unavailable", async () => {
    const ctx = makeCtx()
    const cli = makeJwt({ exp: 9999999999, sub: "auth0|cli" })
    stateDb(ctx, {
      "cursorAuth/accessToken": seal(makeJwt({ exp: 9999999999 })),
      "cursorAuth/refreshToken": seal(makeJwt({})),
    })
    keychain(ctx, { password: null, cli: { "cursor-access-token": cli, "cursor-refresh-token": "cli-refresh" } })
    ctx.host.http.request.mockImplementation((opts) => {
      expect(opts.headers.Authorization).toBe("Bearer " + cli)
      return USAGE_OK
    })

    const plugin = await loadPlugin()
    expect(plugin.probe(ctx).lines.length).toBeGreaterThan(0)
  })

  it("explains the Keychain prompt instead of 'Session expired' when nothing can be opened", async () => {
    const ctx = makeCtx()
    stateDb(ctx, { "cursorAuth/accessToken": seal(makeJwt({ exp: 9999999999 })) })
    keychain(ctx, { password: "wrong-password" })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Cursor Safe Storage")
    expect(ctx.host.http.request).not.toHaveBeenCalled()
  })

  it("rejects a sealed value that opens to something other than a JWT", async () => {
    const ctx = makeCtx()
    stateDb(ctx, { "cursorAuth/accessToken": seal("not-a-jwt") })
    keychain(ctx)

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Cursor Safe Storage")
  })

  it("treats a missing crypto host API as an unreadable seal", async () => {
    const ctx = makeCtx()
    delete ctx.host.crypto.openSafeStorage
    stateDb(ctx, { "cursorAuth/accessToken": seal(makeJwt({ exp: 9999999999 })) })
    keychain(ctx)

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Cursor Safe Storage")
  })

  it("treats a missing keychain host API as an unreadable seal", async () => {
    const ctx = makeCtx()
    delete ctx.host.keychain
    stateDb(ctx, { "cursorAuth/accessToken": seal(makeJwt({ exp: 9999999999 })) })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Cursor Safe Storage")
  })
})
