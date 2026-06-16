import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { useChangelog, type Release } from "./use-changelog"

describe("useChangelog", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn() as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("fetches release by exact currentVersion tag", async () => {
    const release: Release = {
      id: 1,
      tag_name: "v1.2.3",
      name: "v1.2.3",
      body: "notes",
      published_at: "2024-01-02T00:00:00Z",
      html_url: "https://github.com/keshav-k3/watchtower/releases/tag/v1.2.3",
    }

    const response = {
      ok: true,
      status: 200,
      json: async () => release,
    } as any

    const fetchMock = vi.fn().mockResolvedValue(response)
    globalThis.fetch = fetchMock as any

    const { result } = renderHook(() => useChangelog("v1.2.3"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.releases).toHaveLength(1)
      expect(result.current.releases[0]).toEqual(release)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/keshav-k3/watchtower/releases/tags/v1.2.3",
    )
  })

  it("falls back between v-prefixed and non-prefixed tags", async () => {
    const notFoundResponse = {
      ok: false,
      status: 404,
      json: async () => ({}),
    } as any

    const release: Release = {
      id: 2,
      tag_name: "v1.0.0",
      name: "v1.0.0",
      body: "older",
      published_at: "2023-01-01T00:00:00Z",
      html_url: "https://github.com/keshav-k3/watchtower/releases/tag/v1.0.0",
    }

    const okResponse = {
      ok: true,
      status: 200,
      json: async () => release,
    } as any

    const fetchMock = vi
      .fn()
      // first try without v
      .mockResolvedValueOnce(notFoundResponse)
      // then try with v prefix
      .mockResolvedValueOnce(okResponse)

    globalThis.fetch = fetchMock as any

    const { result } = renderHook(() => useChangelog("1.0.0"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.releases).toHaveLength(1)
      expect(result.current.releases[0]).toEqual(release)
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/repos/keshav-k3/watchtower/releases/tags/v1.0.0",
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/keshav-k3/watchtower/releases/tags/1.0.0",
    )
  })

  it("returns empty releases when tag does not exist for any variant", async () => {
    const notFoundResponse = {
      ok: false,
      status: 404,
      json: async () => ({}),
    } as any

    const fetchMock = vi.fn().mockResolvedValue(notFoundResponse)
    globalThis.fetch = fetchMock as any

    const { result } = renderHook(() => useChangelog("9.9.9"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.releases).toHaveLength(0)
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("sets error when fetch throws a non-Error value", async () => {
    const fetchMock = vi.fn().mockRejectedValue("offline")
    globalThis.fetch = fetchMock as any

    const { result } = renderHook(() => useChangelog("1.0.0"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.releases).toHaveLength(0)
      expect(result.current.error).toBe("Failed to fetch releases")
    })
  })

  it("ignores late responses after unmount", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )
    globalThis.fetch = fetchMock as any

    const { unmount } = renderHook(() => useChangelog("1.0.0"))
    unmount()

    resolveFetch?.({
      ok: true,
      status: 200,
      json: async () => ({
        id: 99,
        tag_name: "v1.0.0",
        name: "v1.0.0",
        body: "late",
        published_at: "2024-01-01T00:00:00.000Z",
        html_url: "https://github.com/keshav-k3/watchtower/releases/tag/v1.0.0",
      }),
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
  })

  it("falls back from v-prefixed tag to tag without v", async () => {
    const notFoundResponse = {
      ok: false,
      status: 404,
      json: async () => ({}),
    } as any

    const release: Release = {
      id: 3,
      tag_name: "1.2.3",
      name: "1.2.3",
      body: "notes",
      published_at: "2024-01-02T00:00:00Z",
      html_url: "https://github.com/keshav-k3/watchtower/releases/tag/1.2.3",
    }

    const okResponse = {
      ok: true,
      status: 200,
      json: async () => release,
    } as any

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(notFoundResponse)
      .mockResolvedValueOnce(okResponse)

    globalThis.fetch = fetchMock as any

    const { result } = renderHook(() => useChangelog("v1.2.3"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.releases).toHaveLength(1)
      expect(result.current.releases[0]).toEqual(release)
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/repos/keshav-k3/watchtower/releases/tags/v1.2.3",
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/keshav-k3/watchtower/releases/tags/1.2.3",
    )
  })

  it("ignores late errors after unmount", async () => {
    let rejectFetch: ((error: unknown) => void) | undefined
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((_, reject) => {
        rejectFetch = reject
      }),
    )
    globalThis.fetch = fetchMock as any

    const { result, unmount } = renderHook(() => useChangelog("1.0.0"))
    const errorAtUnmount = result.current.error
    unmount()

    rejectFetch?.(new Error("network down"))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(errorAtUnmount).toBeNull()
  })

  it("sets error when fetch fails with non-404", async () => {
    const badResponse = {
      ok: false,
      status: 500,
      json: async () => ({}),
    } as any

    const fetchMock = vi.fn().mockResolvedValue(badResponse)
    globalThis.fetch = fetchMock as any

    const { result } = renderHook(() => useChangelog("1.0.0"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.releases).toHaveLength(0)
      expect(result.current.error).toBe("Failed to fetch releases")
    })
  })
})

