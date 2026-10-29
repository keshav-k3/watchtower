import { describe, expect, it } from "vitest"
import { cachedUsageToStates } from "@/lib/cached-usage"

describe("cachedUsageToStates", () => {
  it("returns nothing for a payload that is not a list", () => {
    expect(cachedUsageToStates(null)).toEqual({})
    expect(cachedUsageToStates({})).toEqual({})
  })

  it("skips entries that are missing an id or lines", () => {
    expect(
      cachedUsageToStates([
        null,
        "nope",
        { providerId: "", lines: [] },
        { providerId: "codex" },
        { lines: [] },
      ])
    ).toEqual({})
  })

  it("maps a saved snapshot into panel state", () => {
    const states = cachedUsageToStates([
      {
        providerId: "codex",
        displayName: "Codex",
        plan: "Pro",
        lines: [{ type: "text", label: "Usage", value: "10%" }],
        fetchedAt: "2026-03-26T08:15:30.000Z",
      },
      {
        providerId: "gemini",
        displayName: "",
        plan: "",
        lines: [],
        fetchedAt: "not-a-date",
      },
      {
        providerId: "cursor",
        lines: [],
        fetchedAt: null,
      },
    ])

    expect(states.codex?.data).toMatchObject({
      providerId: "codex",
      displayName: "Codex",
      plan: "Pro",
      iconUrl: "",
    })
    expect(states.codex?.lastUpdatedAt).toBe(Date.parse("2026-03-26T08:15:30.000Z"))
    expect(states.codex?.loading).toBe(false)
    expect(states.gemini?.data?.displayName).toBe("gemini")
    expect(states.gemini?.data?.plan).toBeUndefined()
    expect(states.gemini?.lastUpdatedAt).toBeNull()
    expect(states.cursor?.lastUpdatedAt).toBeNull()
  })
})
