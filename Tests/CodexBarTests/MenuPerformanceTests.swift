import AppKit
import CodexBarCore
import Testing
@testable import CodexBar

@MainActor
struct MenuPerformanceTests {
    @Test
    func usageHistorySubmenuUsesNativeMenuRow() throws {
        let settings = Self.makeSettings(suiteName: "usageHistorySubmenuUsesNativeMenuRow")
        let store = Self.makeStore(settings: settings, suiteName: "usageHistorySubmenuUsesNativeMenuRow")
        let fetcher = UsageFetcher(environment: [:])

        try withStatusItemControllerForTesting(store: store, settings: settings, fetcher: fetcher) { controller in
            let menu = NSMenu()

            let added = controller.addUsageHistoryMenuItemIfNeeded(to: menu, provider: .claude, width: 320)

            #expect(added)
            let item = try #require(menu.items.first)
            #expect(item.title == L("Plan Usage History"))
            #expect(item.view == nil)
            #expect(item.submenu != nil)
            #expect(item.representedObject as? String == "usageHistorySubmenu")
        }
    }

    @Test
    func planUtilizationChartPreparesModelsOnce() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let history = PlanUtilizationSeriesHistory(
            name: .session,
            windowMinutes: 300,
            entries: [
                PlanUtilizationHistoryEntry(
                    capturedAt: now.addingTimeInterval(-19000),
                    usedPercent: 20,
                    resetsAt: now.addingTimeInterval(-18000)),
                PlanUtilizationHistoryEntry(
                    capturedAt: now.addingTimeInterval(-1000),
                    usedPercent: 45,
                    resetsAt: now),
            ])

        let prepared = PlanUtilizationHistoryChartPreparation(
            provider: .claude,
            histories: [history],
            snapshot: UsageSnapshot(
                primary: RateWindow(
                    usedPercent: 45,
                    windowMinutes: 300,
                    resetsAt: now,
                    resetDescription: nil),
                secondary: nil,
                updatedAt: now),
            referenceDate: now)

        #expect(prepared.visibleSeriesCount == 1)
        #expect(prepared.modelPointCount(for: prepared.initialSeriesID) == 2)
    }

    private static func makeSettings(suiteName: String) -> SettingsStore {
        let defaultsSuiteName = "watchtower.tests.\(suiteName).\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsSuiteName)!
        defaults.removePersistentDomain(forName: defaultsSuiteName)
        let configStore = testConfigStore(suiteName: suiteName)
        return SettingsStore(
            userDefaults: defaults,
            configStore: configStore,
            codexCookieStore: InMemoryCookieHeaderStore(),
            claudeCookieStore: InMemoryCookieHeaderStore(),
            cursorCookieStore: InMemoryCookieHeaderStore(),
            tokenAccountStore: InMemoryTokenAccountStore())
    }

    private static func makeStore(settings: SettingsStore, suiteName: String) -> UsageStore {
        UsageStore(
            fetcher: UsageFetcher(environment: [:]),
            browserDetection: BrowserDetection(
                homeDirectory: "",
                cacheTTL: 0,
                fileExists: { _ in false },
                directoryContents: { _ in nil }),
            settings: settings,
            planUtilizationHistoryStore: testPlanUtilizationHistoryStore(suiteName: suiteName),
            startupBehavior: .testing,
            environmentBase: [:])
    }
}
