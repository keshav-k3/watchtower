import CodexBarCore
import SweetCookieKit
import Testing

struct ProviderSupportTypesTests {
    @Test
    func providerCookieSourceExposesStableIdentifiersNamesAndEnabledState() {
        let expectations: [(ProviderCookieSource, String, String, Bool)] = [
            (.auto, "auto", "Auto", true),
            (.manual, "manual", "Manual", true),
            (.off, "off", "Off", false),
        ]

        for (source, id, displayName, isEnabled) in expectations {
            #expect(source.id == id)
            #expect(source.displayName == displayName)
            #expect(source.isEnabled == isEnabled)
        }
    }

    @Test
    func cursorRequestUsageComputesPercentagesAndClampsOverages() {
        let usage = CursorRequestUsage(used: 125, limit: 500)
        #expect(usage.usedPercent == 25)
        #expect(usage.remainingPercent == 75)

        let overLimitUsage = CursorRequestUsage(used: 750, limit: 500)
        #expect(overLimitUsage.usedPercent == 150)
        #expect(overLimitUsage.remainingPercent == 0)
    }

    @Test
    func cursorRequestUsageUsesZeroPercentWhenLimitIsNonPositive() {
        let zeroLimitUsage = CursorRequestUsage(used: 10, limit: 0)
        #expect(zeroLimitUsage.usedPercent == 0)
        #expect(zeroLimitUsage.remainingPercent == 100)
    }

    @Test
    func providerDefaultsMirrorDescriptorRegistryMetadata() {
        let defaults = ProviderDefaults.metadata
        let registry = ProviderDescriptorRegistry.metadata

        #expect(Set(defaults.keys) == Set(registry.keys))
        for provider in UsageProvider.allCases {
            let defaultMetadata = defaults[provider]
            let registryMetadata = registry[provider]

            #expect(defaultMetadata?.id == registryMetadata?.id)
            #expect(defaultMetadata?.cliName == registryMetadata?.cliName)
            #expect(defaultMetadata?.displayName == registryMetadata?.displayName)
        }
    }

    @Test
    func providerMetadataInitializerStoresEveryField() {
        let metadata = ProviderMetadata(
            id: .codex,
            displayName: "Codex",
            sessionLabel: "Session",
            weeklyLabel: "Week",
            opusLabel: "Opus",
            supportsOpus: true,
            supportsCredits: true,
            creditsHint: "Hint",
            toggleTitle: "Toggle",
            cliName: "codex",
            defaultEnabled: true,
            isPrimaryProvider: true,
            usesAccountFallback: true,
            browserCookieOrder: [.chrome, .safari],
            dashboardURL: "https://example.com/dashboard",
            subscriptionDashboardURL: "https://example.com/subscription",
            changelogURL: "https://example.com/changelog",
            statusPageURL: "https://example.com/status",
            statusLinkURL: "https://example.com/link",
            statusWorkspaceProductID: "workspace-product")

        #expect(metadata.id == .codex)
        #expect(metadata.displayName == "Codex")
        #expect(metadata.sessionLabel == "Session")
        #expect(metadata.weeklyLabel == "Week")
        #expect(metadata.opusLabel == "Opus")
        #expect(metadata.supportsOpus)
        #expect(metadata.supportsCredits)
        #expect(metadata.creditsHint == "Hint")
        #expect(metadata.toggleTitle == "Toggle")
        #expect(metadata.cliName == "codex")
        #expect(metadata.defaultEnabled)
        #expect(metadata.isPrimaryProvider)
        #expect(metadata.usesAccountFallback)
        #expect(metadata.browserCookieOrder == [.chrome, .safari])
        #expect(metadata.dashboardURL == "https://example.com/dashboard")
        #expect(metadata.subscriptionDashboardURL == "https://example.com/subscription")
        #expect(metadata.changelogURL == "https://example.com/changelog")
        #expect(metadata.statusPageURL == "https://example.com/status")
        #expect(metadata.statusLinkURL == "https://example.com/link")
        #expect(metadata.statusWorkspaceProductID == "workspace-product")
    }

    @Test
    func providerBrowserCookieDefaultsPreserveExpectedOrdering() throws {
        let defaultOrder = try #require(ProviderBrowserCookieDefaults.defaultImportOrder)
        #expect(defaultOrder == Browser.defaultImportOrder)

        let cursorOrder = try #require(ProviderBrowserCookieDefaults.cursorCookieImportOrder)
        #expect(cursorOrder.first == .safari)
        #expect(Set(cursorOrder) == Set(Browser.defaultImportOrder))

        let codexOrder = try #require(ProviderBrowserCookieDefaults.codexCookieImportOrder)
        #expect(Array(codexOrder.prefix(3)) == [.safari, .chrome, .firefox])
        #expect(Set(codexOrder) == Set(Browser.defaultImportOrder))
    }
}
