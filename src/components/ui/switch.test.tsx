import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Switch } from "@/components/ui/switch"

describe("Switch", () => {
  it("reports the next state when clicked", () => {
    const onCheckedChange = vi.fn()
    render(<Switch checked={false} onCheckedChange={onCheckedChange} aria-label="Reset Alerts" />)
    fireEvent.click(screen.getByRole("switch", { name: "Reset Alerts" }))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  // The thumb used to sit at the button's centred static position, so the
  // "on" thumb slid past the right edge of the 28px track and vanished.
  it("anchors the thumb to the left edge and keeps it inside the track when on", () => {
    const { rerender } = render(<Switch checked={false} onCheckedChange={() => {}} />)
    const thumb = () => screen.getByRole("switch").firstElementChild as HTMLElement
    expect(thumb().className).toContain("left-[2px]")
    expect(thumb().className).toContain("translate-x-0")
    rerender(<Switch checked onCheckedChange={() => {}} />)
    expect(thumb().className).toContain("translate-x-3")
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true")
  })
})
