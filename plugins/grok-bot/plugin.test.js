import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeCtx } from "../test-helpers.js"

const DIR = "~/Library/Application Support/Grok Bot/sand-client-persistence"
const NOW = Date.now()
const HOUR = 60 * 60 * 1000

// Pure-JS RFC 4648 base32 encoder (lowercase, unpadded) for fixture file names.
function base32Encode(str) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567"
  let bits = 0
  let value = 0
  let out = ""
  for (let i = 0; i < str.length; i += 1) {
    value = (value << 8) | str.charCodeAt(i)
    bits += 8
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
      value &= (1 << bits) - 1
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31]
  return out
}

function blobName(key) {
  return base32Encode(key) + ".blob"
}

function cacheFile(overrides = {}) {
  const usage = {
    percentUsed: 42,
    nextResetMs: NOW + 3 * 24 * HOUR,
    isSandTrial: false,
    hasNonZeroIncludedLimit: true,
    isTeamSeat: false,
    onDemand: null,
    grokPlanLabel: "SuperGrok",
    ...(overrides.usage || {}),
  }
  const value = {
    kind: "present",
    reading: { readAtMs: NOW - 5 * 60 * 1000, usage },
    ...(overrides.value || {}),
  }
  if (overrides.valueExpiresAtMs !== undefined) value.expiresAtMs = overrides.valueExpiresAtMs
  const file = { schemaVersion: 2, value }
  if (overrides.expiresAtMs !== undefined) file.expiresAtMs = overrides.expiresAtMs
  return JSON.stringify(file)
}

function keyFor(account) {
  return "sand.client.slice.account." + encodeURIComponent(account) + ".weekly-usage.cache"
}

const loadPlugin = async () => {
  await import("./plugin.js")
  return globalThis.__watchtower_plugin
}

function seed(ctx, files) {
  for (const [name, text] of Object.entries(files)) {
    ctx.host.fs.writeText(DIR + "/" + name, text)
  }
}

function trackReads(ctx) {
  const reads = []
  const orig = ctx.host.fs.readText
  ctx.host.fs.readText = (path) => {
    reads.push(String(path))
    return orig(path)
  }
  return reads
}

describe("grok-bot plugin", () => {
  beforeEach(() => {
    delete globalThis.__watchtower_plugin
    vi.resetModules()
  })

  it("renders weekly usage from the newest reading", async () => {
    const ctx = makeCtx()
    seed(ctx, {
      [blobName(keyFor("older@example.com"))]: cacheFile({
        usage: { percentUsed: 10, grokPlanLabel: "Free" },
        value: { reading: { readAtMs: NOW - 2 * HOUR, usage: { percentUsed: 10, grokPlanLabel: "Free", nextResetMs: NOW + HOUR } } },
        expiresAtMs: NOW + 10 * HOUR,
      }),
      [blobName(keyFor("newest@example.com"))]: cacheFile({
        usage: { percentUsed: 67, grokPlanLabel: "SuperGrok" },
        expiresAtMs: NOW + 10 * HOUR,
      }),
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(result.plan).toBe("SuperGrok")
    expect(result.lines).toHaveLength(1)
    const line = result.lines[0]
    expect(line.type).toBe("progress")
    expect(line.label).toBe("Weekly Usage")
    expect(line.used).toBe(67)
    expect(line.limit).toBe(100)
    expect(line.periodDurationMs).toBe(7 * 24 * HOUR)
    expect(line.resetsAt).toBe(new Date(NOW + 3 * 24 * HOUR).toISOString())
  })

  it("accepts expiresAtMs nested inside value", async () => {
    const ctx = makeCtx()
    seed(ctx, {
      [blobName(keyFor("a@example.com"))]: cacheFile({ valueExpiresAtMs: NOW + HOUR }),
    })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines.find((line) => line.type === "badge")).toBeUndefined()
  })

  it("skips files that are not weekly-usage cache keys or not .blob entries", async () => {
    const ctx = makeCtx()
    seed(ctx, {
      [blobName("sand.client.slice.account.a%40x.com.settings.cache")]: cacheFile(),
      [blobName("totally-unrelated")]: cacheFile(),
      "readme.txt": cacheFile(),
      [blobName(keyFor("b@example.com"))]: cacheFile({ usage: { percentUsed: 5 } }),
    })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines[0].used).toBe(5)
  })

  it("skips invalid base32 names without reading them", async () => {
    const ctx = makeCtx()
    const reads = trackReads(ctx)
    seed(ctx, {
      "not!valid!base32.blob": cacheFile(),
      [blobName(keyFor("c@example.com"))]: cacheFile({ usage: { percentUsed: 9 } }),
    })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines[0].used).toBe(9)
    expect(reads.some((path) => path.includes("not!valid!base32"))).toBe(false)
  })

  it("never reads files whose decoded name contains secret or cookie", async () => {
    const ctx = makeCtx()
    const reads = trackReads(ctx)
    const secretEntry = blobName("sand.client.slice.account.d%40x.com.weekly-usage.secret.cache")
    const cookieEntry = blobName("sand.client.cookies.weekly-usage.cache")
    seed(ctx, {
      [secretEntry]: cacheFile({ usage: { percentUsed: 99 } }),
      [cookieEntry]: cacheFile({ usage: { percentUsed: 98 } }),
      [blobName(keyFor("d@example.com"))]: cacheFile({ usage: { percentUsed: 3 } }),
    })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines[0].used).toBe(3)
    expect(reads).not.toContain(DIR + "/" + secretEntry)
    expect(reads).not.toContain(DIR + "/" + cookieEntry)
  })

  it("skips bad JSON, non-object payloads, unreadable files, and non-present kinds", async () => {
    const ctx = makeCtx()
    seed(ctx, {
      [blobName(keyFor("bad@example.com"))]: "{not json",
      [blobName(keyFor("null@example.com"))]: "null",
      [blobName(keyFor("scalar@example.com"))]: "5",
      [blobName(keyFor("absent@example.com"))]: cacheFile({ value: { kind: "absent" } }),
      [blobName(keyFor("good@example.com"))]: cacheFile({ usage: { percentUsed: 21 } }),
    })
    // Unreadable file: present in dir listing via another seeded key prefix, but readText throws.
    const unreadable = blobName(keyFor("unreadable@example.com"))
    ctx.host.fs.writeText(DIR + "/" + unreadable + ".marker", "x")
    const origRead = ctx.host.fs.readText
    ctx.host.fs.readText = (path) => {
      if (String(path).endsWith(unreadable)) throw new Error("io error")
      return origRead(path)
    }
    const origList = ctx.host.fs.listDir
    ctx.host.fs.listDir = (path) => origList(path).concat([unreadable])

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines[0].used).toBe(21)
    expect(ctx.host.log.warn).toHaveBeenCalledWith(expect.stringContaining("failed to read cache file"))
  })

  it("skips records with missing reading, readAtMs, usage, or percentUsed", async () => {
    const ctx = makeCtx()
    seed(ctx, {
      [blobName(keyFor("noreading@example.com"))]: cacheFile({ value: { kind: "present", reading: null } }),
      [blobName(keyFor("noreadat@example.com"))]: cacheFile({
        value: { kind: "present", reading: { readAtMs: "abc", usage: { percentUsed: 1 } } },
      }),
      [blobName(keyFor("nousage@example.com"))]: cacheFile({
        value: { kind: "present", reading: { readAtMs: NOW } },
      }),
      [blobName(keyFor("nopercent@example.com"))]: cacheFile({
        usage: { percentUsed: "nope" },
      }),
      [blobName(keyFor("novalue@example.com"))]: JSON.stringify({ schemaVersion: 2 }),
      [blobName(keyFor("blankpercent@example.com"))]: cacheFile({
        usage: { percentUsed: "  " },
      }),
      [blobName(keyFor("ok@example.com"))]: cacheFile({ usage: { percentUsed: 12 } }),
    })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines[0].used).toBe(12)
  })

  it("adds a refresh badge when the cache is expired", async () => {
    const ctx = makeCtx()
    seed(ctx, {
      [blobName(keyFor("e@example.com"))]: cacheFile({ expiresAtMs: NOW - 1000 }),
    })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    const badge = result.lines.find((line) => line.type === "badge")
    expect(badge).toMatchObject({ label: "Status", text: "Open Grok Bot to refresh" })
    expect(result.lines[0].used).toBe(42)
  })

  it("adds a refresh badge when the reading is older than 60 minutes", async () => {
    const ctx = makeCtx()
    seed(ctx, {
      [blobName(keyFor("f@example.com"))]: cacheFile({
        value: { reading: { readAtMs: NOW - 61 * 60 * 1000, usage: { percentUsed: 30, nextResetMs: NOW + HOUR, grokPlanLabel: "SuperGrok" } } },
      }),
    })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines.find((line) => line.type === "badge")).toBeTruthy()
  })

  it("throws a friendly sign-in error when the directory is missing", async () => {
    const ctx = makeCtx()
    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Sign in to the Grok Bot app")
  })

  it("throws a friendly sign-in error when listing the directory fails", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(DIR + "/placeholder.blob", "x")
    ctx.host.fs.listDir = () => {
      throw new Error("permission denied")
    }
    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Sign in to the Grok Bot app")
  })

  it("throws a friendly sign-in error when no usable cache exists", async () => {
    const ctx = makeCtx()
    seed(ctx, { [blobName("unrelated")]: cacheFile() })
    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Sign in to the Grok Bot app")
  })

  it("clamps out-of-range percentages and tolerates missing plan and reset", async () => {
    const ctx = makeCtx()
    seed(ctx, {
      [blobName(keyFor("high@example.com"))]: cacheFile({
        usage: { percentUsed: 250, nextResetMs: null, grokPlanLabel: "" },
      }),
      [blobName(keyFor("low@example.com"))]: cacheFile({
        usage: { percentUsed: -5, nextResetMs: "bad", grokPlanLabel: null },
        value: { reading: { readAtMs: NOW - HOUR, usage: { percentUsed: -5, nextResetMs: "bad", grokPlanLabel: null } } },
      }),
    })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.plan).toBeNull()
    expect(result.lines[0].used).toBe(100)
    expect(result.lines[0].resetsAt).toBeUndefined()
  })
})
