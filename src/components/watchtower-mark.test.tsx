import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { WatchtowerMark } from "@/components/watchtower-mark"

describe("WatchtowerMark", () => {
  it("renders the brand mark svg with inherited color", () => {
    const { container } = render(<WatchtowerMark className="size-4" />)

    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute("viewBox", "0 0 1024 1024")
    expect(svg).toHaveAttribute("fill", "currentColor")
    expect(svg).toHaveAttribute("aria-hidden", "true")
    expect(svg).toHaveClass("size-4")
    expect(container.querySelector("mask#watchtower-mark-cutouts")).not.toBeNull()
  })
})
