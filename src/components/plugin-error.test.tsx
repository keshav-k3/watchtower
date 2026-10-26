import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PluginError } from "@/components/plugin-error"

describe("PluginError", () => {
  it("renders message", () => {
    render(<PluginError message="Boom" />)
    expect(screen.getByText("Boom")).toBeInTheDocument()
  })

  it("formats backtick code in message", () => {
    render(<PluginError message="Check `config.json` file" />)
    expect(screen.getByText("config.json")).toBeInTheDocument()
  })

  it("wraps a long message instead of cutting it off", () => {
    const long = "Usage request failed (HTTP 503) at https://api.example.com/v1/usage/very/long/path"
    render(<PluginError message={long} />)
    const text = screen.getByText(long)
    expect(text.className).toContain("break-words")
    expect(text.className).not.toContain("truncate")
  })
})
