import CodexBarCore
import Testing
@testable import CodexBar

@Suite("SettingsStore OpenAI web defaults")
struct SettingsStoreOpenAIWebDefaultsTests {
    @Test
    func existingConfigWithoutCodexCookieDoesNotEnableOpenAIWebAccess() {
        let config = CodexBarConfig(providers: [
            ProviderConfig(id: .codex, enabled: true),
            ProviderConfig(id: .claude, enabled: true),
        ])

        #expect(SettingsStore.inferredInitialOpenAIWebAccessEnabled(
            config: config,
            hadExistingConfig: true) == false)
    }

    @Test
    func codexCookieConfigurationEnablesOpenAIWebAccess() {
        let manualCookieConfig = CodexBarConfig(providers: [
            ProviderConfig(id: .codex, enabled: true, cookieSource: .manual),
        ])
        let legacyCookieConfig = CodexBarConfig(providers: [
            ProviderConfig(id: .codex, enabled: true, cookieHeader: "session=abc"),
        ])

        #expect(SettingsStore.inferredInitialOpenAIWebAccessEnabled(
            config: manualCookieConfig,
            hadExistingConfig: true) == true)
        #expect(SettingsStore.inferredInitialOpenAIWebAccessEnabled(
            config: legacyCookieConfig,
            hadExistingConfig: true) == true)
    }

    @Test
    func codexCookieSourceOffKeepsOpenAIWebAccessDisabled() {
        let config = CodexBarConfig(providers: [
            ProviderConfig(id: .codex, enabled: true, cookieSource: .off),
        ])

        #expect(SettingsStore.inferredInitialOpenAIWebAccessEnabled(
            config: config,
            hadExistingConfig: true) == false)
    }
}
