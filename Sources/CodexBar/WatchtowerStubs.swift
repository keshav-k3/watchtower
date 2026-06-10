import CodexBarCore
import Foundation

struct HistoricalWeekProfile: Sendable {
    let resetsAt: Date
    let windowMinutes: Int
    let curve: [Double]
}

struct CodexHistoricalDataset: Sendable {
    static let gridPointCount = 169
    let weeks: [HistoricalWeekProfile]

    init(weeks: [HistoricalWeekProfile] = []) {
        self.weeks = weeks
    }
}

actor HistoricalUsageHistoryStore {
    init(fileURL _: URL? = nil) {}

    static func defaultFileURL() -> URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".watchtower/historical-usage.json")
    }

    func loadCodexDataset(accountKey _: String?) -> CodexHistoricalDataset? {
        nil
    }

    func loadCodexDataset(
        canonicalAccountKey _: String?,
        canonicalEmailHashKey _: String?,
        legacyEmailHash _: String?,
        hasAdjacentMultiAccountVeto _: Bool) -> CodexHistoricalDataset?
    {
        nil
    }

    func recordCodexWeekly(
        window _: RateWindow,
        sampledAt _: Date = .init(),
        accountKey _: String?) -> CodexHistoricalDataset?
    {
        nil
    }

    func backfillCodexWeeklyFromUsageBreakdown(
        _: [OpenAIDashboardDailyBreakdown],
        referenceWindow _: RateWindow,
        now _: Date = .init(),
        accountKey _: String?) -> CodexHistoricalDataset?
    {
        nil
    }
}

@MainActor
extension UsageStore {
    func weeklyPace(provider: UsageProvider, window: RateWindow, now: Date = .init()) -> UsagePace? {
        guard window.remainingPercent > 0, window.windowMinutes != nil else { return nil }
        guard let pace = UsagePace.weekly(window: window, now: now, defaultWindowMinutes: 10080) else { return nil }
        guard pace.expectedUsedPercent >= 3 else { return nil }
        return pace
    }

    func refreshHistoricalDatasetIfNeeded() async {}

    func recordCodexHistoricalSampleIfNeeded(snapshot _: UsageSnapshot) {}

    func backfillCodexHistoricalFromDashboardIfNeeded(
        _: OpenAIDashboardSnapshot,
        authorityDecision _: CodexDashboardAuthorityDecision,
        attachedAccountEmail _: String?)
    {}
}
