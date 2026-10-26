import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { WatchtowerMark } from "@/components/watchtower-mark"

describe("WatchtowerMark", () => {
  it("renders the lighthouse mark in the current color", () => {
    const { container } = render(<WatchtowerMark className="size-4" />)

    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute("viewBox", "296 106 432 818")
    expect(svg).toHaveAttribute("fill", "currentColor")
    expect(svg).toHaveAttribute("aria-hidden", "true")
    expect(svg).toHaveClass("size-4")

    const paths = [...(svg?.querySelectorAll("path") ?? [])].map((path) => path.getAttribute("d"))
    expect(paths).toHaveLength(2)

    const source = readFileSync(resolve(process.cwd(), "assets/brand/watchtower-mark.svg"), "utf8")
    for (const d of paths) {
      expect(source).toContain(`d="${d}"`)
    }
  })
})
