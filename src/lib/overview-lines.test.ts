import { describe, expect, it } from "vitest"
import { isOverviewLine } from "@/lib/overview-lines"

const labels = new Set(["Session", "Weekly"])

describe("isOverviewLine", () => {
  it("matches a manifest label", () => {
    expect(isOverviewLine("Session", labels)).toBe(true)
  })

  it("matches an account prefix in front of a manifest label", () => {
    expect(isOverviewLine("Work · Session", labels)).toBe(true)
  })

  it("hides a label that is not on the overview", () => {
    expect(isOverviewLine("Credits", labels)).toBe(false)
    expect(isOverviewLine("Work · Credits", labels)).toBe(false)
  })
})
