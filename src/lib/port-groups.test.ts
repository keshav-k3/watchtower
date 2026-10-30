import { describe, expect, it } from "vitest"
import { friendlyProcessName, groupPortsByProcess, meaningfulCwd, type ListeningPort } from "@/lib/port-groups"

const base: ListeningPort = {
  port: 3000,
  pid: 1,
  processName: "node",
  user: "keshav",
  cwd: null,
  project: null,
  system: false,
  selfProcess: false,
}

describe("friendlyProcessName", () => {
  it("uses the app bundle name and keeps a different binary name", () => {
    expect(friendlyProcessName("/Applications/Raycast.app/Contents/MacOS/Raycast")).toEqual({
      displayName: "Raycast",
      binaryName: null,
    })
    expect(
      friendlyProcessName(
        "/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Helpers/Google Chrome Helper"
      )
    ).toEqual({ displayName: "Google Chrome", binaryName: "Google Chrome Helper" })
  })

  it("falls back to the binary name for plain paths and names", () => {
    expect(friendlyProcessName("/opt/podman/bin/gvproxy")).toEqual({ displayName: "gvproxy", binaryName: null })
    expect(friendlyProcessName("  node  ")).toEqual({ displayName: "node", binaryName: null })
    expect(friendlyProcessName("/usr/local/bin/")).toEqual({ displayName: "bin", binaryName: null })
    expect(friendlyProcessName("/")).toEqual({ displayName: "/", binaryName: null })
  })
})

describe("meaningfulCwd", () => {
  it("hides missing and root folders", () => {
    expect(meaningfulCwd(null)).toBeNull()
    expect(meaningfulCwd("  ")).toBeNull()
    expect(meaningfulCwd("/")).toBeNull()
    expect(meaningfulCwd(" /Users/keshav/demo ")).toBe("/Users/keshav/demo")
  })
})

describe("groupPortsByProcess", () => {
  it("merges ports per pid, sorts them, and orders processes by lowest port", () => {
    const groups = groupPortsByProcess([
      { ...base, pid: 9, port: 3102, processName: "/opt/podman/bin/gvproxy" },
      { ...base, pid: 9, port: 2300, processName: "/opt/podman/bin/gvproxy" },
      { ...base, pid: 9, port: 2300, processName: "/opt/podman/bin/gvproxy" },
      { ...base, pid: 4, port: 5000 },
      { ...base, pid: 2, port: 5000 },
      { ...base, pid: 3, port: 1420, selfProcess: true },
    ])
    expect(groups.map((group) => [group.pid, group.ports])).toEqual([
      [3, [1420]],
      [9, [2300, 3102]],
      [2, [5000]],
      [4, [5000]],
    ])
    expect(groups[1]).toMatchObject({ displayName: "gvproxy", processName: "/opt/podman/bin/gvproxy" })
    expect(groups[0].selfProcess).toBe(true)
  })
})
