import { afterAll, beforeAll } from "vitest"

// jsdom reports an empty platform. Pin one for tests that assert
// platform-specific shortcut labels.
export function usePlatform(platform: "MacIntel" | "Linux x86_64" | "Win32") {
  let original: PropertyDescriptor | undefined
  beforeAll(() => {
    original = Object.getOwnPropertyDescriptor(window.navigator, "platform")
    Object.defineProperty(window.navigator, "platform", { value: platform, configurable: true })
  })
  afterAll(() => {
    if (original) Object.defineProperty(window.navigator, "platform", original)
    else delete (window.navigator as { platform?: string }).platform
  })
}
