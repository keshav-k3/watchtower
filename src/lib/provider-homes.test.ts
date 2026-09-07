import { describe, expect, it } from "vitest"
import {
  extraIdsAfterParent,
  homeEnvVar,
  isHomeCapablePluginId,
  makeProviderHomeId,
  parseProviderHomes,
} from "@/lib/provider-homes"

describe("provider homes", () => {
  it("accepts only Claude and Codex as home-capable plugins", () => {
    expect(isHomeCapablePluginId("claude")).toBe(true)
    expect(isHomeCapablePluginId("codex")).toBe(true)
    expect(isHomeCapablePluginId("cursor")).toBe(false)
    expect(homeEnvVar("claude")).toBe("CLAUDE_CONFIG_DIR")
    expect(homeEnvVar("codex")).toBe("CODEX_HOME")
  })

  it("builds a stable extra account id from the provider and name", () => {
    expect(
      makeProviderHomeId({
        pluginId: "claude",
        name: "Work",
        usedIds: ["claude"],
      })
    ).toBe("claude-work")
    expect(
      makeProviderHomeId({
        pluginId: "claude",
        name: "Claude Work",
        usedIds: ["claude"],
      })
    ).toBe("claude-work")
    expect(
      makeProviderHomeId({
        pluginId: "claude",
        name: "Work",
        usedIds: ["claude", "claude-work"],
      })
    ).toBe("claude-work-2")
  })

  it("parses stored extra accounts and drops invalid rows", () => {
    expect(
      parseProviderHomes([
        { id: "claude-work", pluginId: "claude", name: "Claude Work", homePath: "~/.claude-work" },
        { id: "claude", pluginId: "claude", name: "Nope", homePath: "~/.claude-x" },
        { id: "cursor-home", pluginId: "cursor", name: "Cursor", homePath: "~/.cursor" },
        { id: "  ", pluginId: "codex", name: "Blank", homePath: "~/.codex-w" },
        { id: "claude-work", pluginId: "claude", name: "Dup", homePath: "~/.dup" },
      ])
    ).toEqual([
      { id: "claude-work", pluginId: "claude", name: "Claude Work", homePath: "~/.claude-work" },
    ])
  })

  it("keeps extra accounts next to their parent using saved order", () => {
    expect(
      extraIdsAfterParent({
        parentId: "claude",
        extras: [
          { id: "claude-personal", pluginId: "claude", name: "Personal", homePath: "~/.claude-p" },
          { id: "claude-work", pluginId: "claude", name: "Work", homePath: "~/.claude-w" },
          { id: "codex-work", pluginId: "codex", name: "Work", homePath: "~/.codex-w" },
        ],
        preferredOrder: ["claude-work", "claude", "claude-personal"],
      })
    ).toEqual(["claude-work", "claude-personal"])
  })
})
