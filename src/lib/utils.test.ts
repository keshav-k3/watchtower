import { describe, expect, it } from "vitest"
import { clamp01, cn, formatCountNumber, formatFixedPrecisionNumber } from "@/lib/utils"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", undefined, "b")).toBe("a b")
  })

  it("dedupes tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})

describe("formatFixedPrecisionNumber", () => {
  it("formats integers without decimals and non-finite values as zero", () => {
    expect(formatFixedPrecisionNumber(12)).toBe("12")
    expect(formatFixedPrecisionNumber(12.5)).toBe("12.50")
    expect(formatFixedPrecisionNumber(Number.NaN)).toBe("0")
  })
})

describe("formatCountNumber", () => {
  it("formats integers without decimals and non-finite values as zero", () => {
    expect(formatCountNumber(1200)).toBe("1,200")
    expect(formatCountNumber(4.5)).toBe("4.5")
    expect(formatCountNumber(Number.POSITIVE_INFINITY)).toBe("0")
  })
})

describe("clamp01", () => {
  it("clamps non-finite and out-of-range values", () => {
    expect(clamp01(Number.NaN)).toBe(0)
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clamp01(-0.1)).toBe(0)
    expect(clamp01(0)).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(1)).toBe(1)
    expect(clamp01(1.5)).toBe(1)
  })
})
