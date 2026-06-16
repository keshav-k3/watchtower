import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

const dndState = vi.hoisted(() => ({
  onDragEnd: null as ((event: { active: { id: string }; over: { id: string } | null }) => void) | null,
}))

const { invokeMock, menuItemNewMock, menuNewMock, menuPopupMock, predefinedMenuItemNewMock } = vi.hoisted(() => {
  const popup = vi.fn().mockResolvedValue(undefined)
  const close = vi.fn().mockResolvedValue(undefined)
  const action = vi.fn()

  const menuItemNew = vi.fn(async ({ action: itemAction }: { action?: () => void }) => {
    if (itemAction) action.mockImplementation(itemAction)
    return { close, popup, action: itemAction }
  })
  const menuNew = vi.fn(async () => ({ popup, close }))
  const predefinedMenuItemNew = vi.fn(async () => ({ close }))

  return {
    invokeMock: vi.fn(() => Promise.resolve()),
    menuItemNewMock: menuItemNew,
    menuNewMock: menuNew,
    menuPopupMock: popup,
    predefinedMenuItemNewMock: predefinedMenuItemNew,
  }
})

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}))

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: { new: menuNewMock },
  MenuItem: { new: menuItemNewMock },
  PredefinedMenuItem: { new: predefinedMenuItemNewMock },
}))

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core")
  return {
    ...actual,
    DndContext: ({
      children,
      onDragEnd,
    }: {
      children: React.ReactNode
      onDragEnd: (event: { active: { id: string }; over: { id: string } | null }) => void
    }) => {
      dndState.onDragEnd = onDragEnd
      return <div data-testid="dnd-context">{children}</div>
    },
  }
})

vi.mock("@dnd-kit/sortable", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/sortable")>("@dnd-kit/sortable")
  return {
    ...actual,
    useSortable: (args: { id: string }) => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: args.id === "dragging",
    }),
  }
})

import { SideNav } from "@/components/side-nav"

describe("SideNav", () => {
  it("calls onViewChange for Home and omits Help and Settings", async () => {
    const onViewChange = vi.fn()
    render(<SideNav activeView="home" onViewChange={onViewChange} plugins={[]} />)

    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Help" })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Home" }))
    expect(onViewChange).toHaveBeenCalledWith("home")
  })

  it("renders plugin icon button and uses brand color when appropriate", () => {
    const onViewChange = vi.fn()
    render(
      <SideNav
        activeView="home"
        onViewChange={onViewChange}
        plugins={[
          { id: "p1", name: "Plugin 1", iconUrl: "icon.svg", brandColor: "#ff0000" },
        ]}
      />
    )

    const btn = screen.getByRole("button", { name: "Plugin 1" })
    expect(btn).toBeInTheDocument()

    const icon = screen.getByRole("img", { name: "Plugin 1" })
    expect(icon).toHaveStyle({ backgroundColor: "#ff0000" })
  })

  it("renders Gemini with the branded gradient provider icon", () => {
    const onViewChange = vi.fn()
    render(
      <SideNav
        activeView="home"
        onViewChange={onViewChange}
        plugins={[{ id: "gemini", name: "Gemini", iconUrl: "gemini.svg", brandColor: "#4285f4" }]}
      />
    )

    const icon = screen.getByRole("img", { name: "Gemini" })
    expect(icon.className).toContain("conic-gradient")
    expect(icon.getAttribute("style")).toContain("gemini.svg")
  })

  it("switches to a plugin view when its nav button is clicked", async () => {
    const onViewChange = vi.fn()
    render(
      <SideNav
        activeView="home"
        onViewChange={onViewChange}
        plugins={[{ id: "p1", name: "Plugin 1", iconUrl: "icon.svg" }]}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "Plugin 1" }))
    expect(onViewChange).toHaveBeenCalledWith("p1")
  })

  it("dims a plugin icon while it is being dragged", () => {
    render(
      <SideNav
        activeView="home"
        onViewChange={vi.fn()}
        plugins={[
          { id: "dragging", name: "Dragging", iconUrl: "icon.svg" },
          { id: "p2", name: "Plugin 2", iconUrl: "icon.svg" },
        ]}
      />
    )

    const draggingButton = screen.getByRole("button", { name: "Dragging" }).parentElement
    expect(draggingButton).toHaveStyle({ opacity: "0.5" })
  })

  it("opens the plugin context menu and dispatches reload", async () => {
    const onPluginContextAction = vi.fn()
    render(
      <SideNav
        activeView="home"
        onViewChange={vi.fn()}
        plugins={[{ id: "p1", name: "Plugin 1", iconUrl: "icon.svg" }]}
        onPluginContextAction={onPluginContextAction}
        isPluginRefreshAvailable={() => false}
      />
    )

    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Plugin 1" }) })

    expect(menuItemNewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ctx-reload-p1",
        enabled: false,
      })
    )
    expect(menuPopupMock).toHaveBeenCalled()

    const reloadCall = menuItemNewMock.mock.calls.find(([args]) => args.id === "ctx-reload-p1")
    reloadCall?.[0].action?.()
    expect(onPluginContextAction).toHaveBeenCalledWith("p1", "reload")
  })

  it("invokes devtools from the inspect context menu item", async () => {
    render(
      <SideNav
        activeView="home"
        onViewChange={vi.fn()}
        plugins={[{ id: "p1", name: "Plugin 1", iconUrl: "icon.svg" }]}
        onPluginContextAction={vi.fn()}
      />
    )

    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Plugin 1" }) })

    const inspectCall = menuItemNewMock.mock.calls.find(([args]) => args.id === "ctx-inspect-p1")
    inspectCall?.[0].action?.()

    expect(invokeMock).toHaveBeenCalledWith("open_devtools")
  })

  it("no-ops context menu actions when handler is missing", async () => {
    render(
      <SideNav
        activeView="home"
        onViewChange={vi.fn()}
        plugins={[{ id: "p1", name: "Plugin 1", iconUrl: "icon.svg" }]}
      />
    )

    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Plugin 1" }) })

    expect(menuItemNewMock).not.toHaveBeenCalled()
    expect(menuPopupMock).not.toHaveBeenCalled()
  })

  it("reorders plugins when drag ends on a different item", () => {
    const onReorder = vi.fn()
    render(
      <SideNav
        activeView="home"
        onViewChange={vi.fn()}
        plugins={[
          { id: "p1", name: "Plugin 1", iconUrl: "icon.svg" },
          { id: "p2", name: "Plugin 2", iconUrl: "icon.svg" },
        ]}
        onReorder={onReorder}
      />
    )

    act(() => {
      dndState.onDragEnd?.({ active: { id: "p2" }, over: { id: "p1" } })
    })

    expect(onReorder).toHaveBeenCalledWith(["p2", "p1"])
  })

  it("ignores drag end when reorder callback is missing or indices are invalid", () => {
    const onReorder = vi.fn()
    const plugins = [
      { id: "p1", name: "Plugin 1", iconUrl: "icon.svg" },
      { id: "p2", name: "Plugin 2", iconUrl: "icon.svg" },
    ]

    const { rerender } = render(
      <SideNav activeView="home" onViewChange={vi.fn()} plugins={plugins} />
    )

    act(() => {
      dndState.onDragEnd?.({ active: { id: "p2" }, over: { id: "p1" } })
    })
    expect(onReorder).not.toHaveBeenCalled()

    rerender(
      <SideNav
        activeView="home"
        onViewChange={vi.fn()}
        plugins={plugins}
        onReorder={onReorder}
      />
    )

    act(() => {
      dndState.onDragEnd?.({ active: { id: "p2" }, over: null })
      dndState.onDragEnd?.({ active: { id: "p2" }, over: { id: "p2" } })
      dndState.onDragEnd?.({ active: { id: "missing" }, over: { id: "p1" } })
    })

    expect(onReorder).not.toHaveBeenCalled()
  })
})
