import CodexBarCore
import Foundation
import Testing

@Suite struct ResetTimeBackfillTests {
    @Test func backfillsMissingResetMetadataFromCachedWindow() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let reset = now.addingTimeInterval(3600)
        let cached = RateWindow(
            usedPercent: 50,
            windowMinutes: 300,
            resetsAt: reset,
            resetDescription: "Resets in 1h",
            nextRegenPercent: 9)
        let fresh = RateWindow(
            usedPercent: 62,
            windowMinutes: nil,
            resetsAt: nil,
            resetDescription: nil,
            nextRegenPercent: 4)

        let result = fresh.backfillingResetTime(from: cached, now: now)

        #expect(result.usedPercent == 62)
        #expect(result.windowMinutes == 300)
        #expect(result.resetsAt == reset)
        #expect(result.resetDescription == "Resets in 1h")
        #expect(result.nextRegenPercent == 4)
    }

    @Test func backfillsZeroWindowDurationFromCachedWindow() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let reset = now.addingTimeInterval(3600)
        let cached = RateWindow(
            usedPercent: 50,
            windowMinutes: 300,
            resetsAt: reset,
            resetDescription: nil)
        let fresh = RateWindow(usedPercent: 62, windowMinutes: 0, resetsAt: nil, resetDescription: nil)

        let result = fresh.backfillingResetTime(from: cached, now: now)

        #expect(result.windowMinutes == 300)
        #expect(result.resetsAt == reset)
    }

    @Test func skipsExpiredCachedReset() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let cached = RateWindow(
            usedPercent: 50,
            windowMinutes: 300,
            resetsAt: now.addingTimeInterval(-60),
            resetDescription: "Expired")
        let fresh = RateWindow(usedPercent: 62, windowMinutes: nil, resetsAt: nil, resetDescription: nil)

        let result = fresh.backfillingResetTime(from: cached, now: now)

        #expect(result.resetsAt == nil)
        #expect(result.windowMinutes == nil)
        #expect(result.resetDescription == nil)
    }

    @Test func snapshotBackfillPreservesCurrentSnapshotFields() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let reset = now.addingTimeInterval(3600)
        let identity = ProviderIdentitySnapshot(
            providerID: .claude,
            accountEmail: "peter@example.com",
            accountOrganization: "Org",
            loginMethod: "OAuth")
        let cached = UsageSnapshot(
            primary: RateWindow(usedPercent: 40, windowMinutes: 300, resetsAt: reset, resetDescription: "Soon"),
            secondary: nil,
            updatedAt: now.addingTimeInterval(-300),
            identity: identity)
        let extra = NamedRateWindow(
            id: "overflow",
            title: "Overflow",
            window: RateWindow(
                usedPercent: 12,
                windowMinutes: nil,
                resetsAt: nil,
                resetDescription: nil,
                nextRegenPercent: 2))
        let fresh = UsageSnapshot(
            primary: RateWindow(
                usedPercent: 66,
                windowMinutes: nil,
                resetsAt: nil,
                resetDescription: nil,
                nextRegenPercent: 7),
            secondary: nil,
            extraRateWindows: [extra],
            cursorRequests: CursorRequestUsage(used: 10, limit: 50),
            subscriptionExpiresAt: reset.addingTimeInterval(86400),
            subscriptionRenewsAt: reset.addingTimeInterval(43200),
            updatedAt: now,
            identity: identity)

        let result = fresh.backfillingResetTimes(from: cached, now: now)

        #expect(result.primary?.resetsAt == reset)
        #expect(result.primary?.usedPercent == 66)
        #expect(result.primary?.nextRegenPercent == 7)
        #expect(result.extraRateWindows?.first?.id == "overflow")
        #expect(result.extraRateWindows?.first?.window.nextRegenPercent == 2)
        #expect(result.cursorRequests?.used == 10)
        #expect(result.subscriptionExpiresAt == reset.addingTimeInterval(86400))
        #expect(result.subscriptionRenewsAt == reset.addingTimeInterval(43200))
        #expect(result.identity?.accountEmail == "peter@example.com")
    }

    @Test func snapshotBackfillSkipsDifferentAccounts() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let cached = UsageSnapshot(
            primary: RateWindow(
                usedPercent: 40,
                windowMinutes: 300,
                resetsAt: now.addingTimeInterval(3600),
                resetDescription: "Soon"),
            secondary: nil,
            updatedAt: now.addingTimeInterval(-300),
            identity: ProviderIdentitySnapshot(
                providerID: .claude,
                accountEmail: "old@example.com",
                accountOrganization: nil,
                loginMethod: nil))
        let fresh = UsageSnapshot(
            primary: RateWindow(usedPercent: 66, windowMinutes: nil, resetsAt: nil, resetDescription: nil),
            secondary: nil,
            updatedAt: now,
            identity: ProviderIdentitySnapshot(
                providerID: .claude,
                accountEmail: "new@example.com",
                accountOrganization: nil,
                loginMethod: nil))

        let result = fresh.backfillingResetTimes(from: cached, now: now)

        #expect(result.primary?.resetsAt == nil)
    }
}
