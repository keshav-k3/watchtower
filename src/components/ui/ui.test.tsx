import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

function relativeLuminance(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16)
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const scaled = channel / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

describe("ui components", () => {
  it("keeps the meter fill dark in light mode and light in dark mode", () => {
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8")
    const light = css.slice(css.indexOf(":root {"), css.indexOf(":root.dark"))
    const dark = css.slice(css.indexOf(":root.dark {"), css.indexOf("@layer base"))
    const fill = (block: string) => block.match(/--meter-fill:\s*(#[0-9a-fA-F]{6})/)?.[1]

    const lightFill = fill(light)
    const darkFill = fill(dark)
    expect(lightFill).toBeTruthy()
    expect(darkFill).toBeTruthy()
    expect(relativeLuminance(lightFill!)).toBeLessThan(0.15)
    expect(relativeLuminance(darkFill!)).toBeGreaterThan(0.85)
    expect(relativeLuminance("#000000")).toBe(0)
    expect(relativeLuminance("#ffffff")).toBeGreaterThan(0.99)
    expect(light).toContain("--meter-track:")
    expect(dark).toContain("--meter-track:")
    expect(lightFill).not.toBe(darkFill)
  })

  it("renders alert variants", () => {
    render(
      <Alert variant="destructive">
        <AlertDescription>Danger</AlertDescription>
      </Alert>
    )
    expect(screen.getByRole("alert")).toHaveTextContent("Danger")
  })

  it("renders badge variants", () => {
    render(
      <>
        <Badge variant="default">Default</Badge>
        <Badge variant="outline">Outline</Badge>
      </>
    )
    expect(screen.getByText("Default")).toBeInTheDocument()
    expect(screen.getByText("Outline")).toBeInTheDocument()
  })

  it("renders button variants", () => {
    render(
      <>
        <Button>Default</Button>
        <Button variant="outline" size="icon-xs">O</Button>
      </>
    )
    expect(screen.getByRole("button", { name: "Default" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "O" })).toBeInTheDocument()
  })

  it("renders checkbox", () => {
    render(<Checkbox checked={false} onCheckedChange={() => {}} />)
    expect(screen.getByRole("checkbox")).toBeInTheDocument()
  })

  it("renders progress with clamp + custom color", () => {
    const { rerender } = render(<Progress value={150} indicatorColor="#fff" />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
    rerender(<Progress value={-5} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
  })

  it("renders and clamps pace marker on progress bars", () => {
    const { container, rerender } = render(
      <Progress value={25} markerValue={120} />
    )
    let marker = container.querySelector<HTMLElement>('[data-slot="progress-marker"]')
    expect(marker).toBeTruthy()
    expect(marker?.style.left).toBe("100%")
    expect(marker?.style.transform).toBe("translateX(-100%)")
    expect(marker).toHaveClass("bg-muted-foreground", "w-px")

    rerender(<Progress value={25} markerValue={-10} />)
    marker = container.querySelector<HTMLElement>('[data-slot="progress-marker"]')
    expect(marker).toBeTruthy()
    expect(marker?.style.left).toBe("0%")
    expect(marker?.style.transform).toBe("translateX(0)")

    rerender(<Progress value={25} markerValue={50} />)
    marker = container.querySelector<HTMLElement>('[data-slot="progress-marker"]')
    expect(marker).toBeTruthy()
    expect(marker?.style.left).toBe("50%")
    expect(marker?.style.transform).toBe("translateX(-50%)")

    rerender(<Progress value={25} markerValue={1} />)
    marker = container.querySelector<HTMLElement>('[data-slot="progress-marker"]')
    expect(marker).toBeTruthy()
    expect(marker?.style.left).toBe("1%")

    rerender(<Progress value={25} markerValue={99} />)
    marker = container.querySelector<HTMLElement>('[data-slot="progress-marker"]')
    expect(marker).toBeTruthy()
    expect(marker?.style.left).toBe("99%")

    rerender(<Progress value={0} markerValue={50} />)
    marker = container.querySelector<HTMLElement>('[data-slot="progress-marker"]')
    expect(marker).toBeNull()

    rerender(<Progress value={100} markerValue={50} />)
    marker = container.querySelector<HTMLElement>('[data-slot="progress-marker"]')
    expect(marker).toBeNull()

    rerender(<Progress value={25} markerValue={Number.NaN} />)
    marker = container.querySelector<HTMLElement>('[data-slot="progress-marker"]')
    expect(marker).toBeNull()
  })

  it("paints the meter fill on the first render", () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: false })
    vi.stubGlobal("matchMedia", matchMedia)

    const { container } = render(<Progress value={73} />)
    const fill = container.querySelector<HTMLElement>("[data-slot=progress-fill]")
    const track = screen.getByRole("progressbar")

    expect(fill).toHaveStyle({ width: "73%", backgroundColor: "var(--meter-fill)" })
    expect(fill?.getAttribute("style")).toContain("transition: width 150ms ease-out")
    expect(track.className).toContain("bg-[var(--meter-track)]")

    vi.unstubAllGlobals()
  })

  it("skips the width transition when reduced motion is requested", () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal("matchMedia", matchMedia)

    const { container } = render(<Progress value={50} />)
    const fill = container.querySelector<HTMLElement>("[data-slot=progress-fill]")
    expect(fill).toHaveStyle({ width: "50%" })
    expect(fill?.getAttribute("style")).not.toContain("transition")

    vi.unstubAllGlobals()
  })

  it("renders shimmer overlay only when refreshing", () => {
    const { container, rerender } = render(<Progress value={40} />)
    expect(container.querySelector('[data-slot="progress-refreshing"]')).toBeNull()

    rerender(<Progress value={40} refreshing />)
    expect(container.querySelector('[data-slot="progress-refreshing"]')).toBeTruthy()

    rerender(<Progress value={40} refreshing={false} />)
    expect(container.querySelector('[data-slot="progress-refreshing"]')).toBeNull()
  })

  it("renders separator orientations", () => {
    const { rerender } = render(<Separator />)
    expect(screen.getByRole("separator")).toBeInTheDocument()
    rerender(<Separator orientation="vertical" />)
    expect(screen.getByRole("separator")).toHaveAttribute("data-orientation", "vertical")
  })

  it("renders skeleton", () => {
    render(<Skeleton data-testid="skeleton" />)
    expect(screen.getByTestId("skeleton")).toBeInTheDocument()
  })

  it("renders tabs + content", () => {
    render(
      <Tabs value="one">
        <TabsList variant="line">
          <TabsTrigger value="one">One</TabsTrigger>
        </TabsList>
        <TabsContent value="one">Tab content</TabsContent>
      </Tabs>
    )
    expect(screen.getByText("One")).toBeInTheDocument()
    expect(screen.getByText("Tab content")).toBeInTheDocument()
  })

  it("renders tooltip content when open", () => {
    render(
      <Tooltip open>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Tip</TooltipContent>
      </Tooltip>
    )
    expect(screen.getByText("Tip")).toBeInTheDocument()
  })
})
