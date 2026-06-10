import CodexBarCore
import Foundation

@MainActor
extension UsageStore {
    func recordPlanUtilizationHistorySample(
        provider _: UsageProvider,
        snapshot _: UsageSnapshot,
        account _: ProviderTokenAccount? = nil,
        shouldUpdatePreferredAccountKey _: Bool = true,
        shouldAdoptUnscopedHistory _: Bool = true,
        now _: Date = .init()) async {}
}
