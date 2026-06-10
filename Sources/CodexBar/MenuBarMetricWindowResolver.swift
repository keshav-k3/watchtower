import CodexBarCore
import Foundation

enum MenuBarMetricWindowResolver {
    private enum Lane {
        case primary
        case secondary
        case tertiary
    }

    static func rateWindow(
        preference: MenuBarMetricPreference,
        provider: UsageProvider,
        snapshot: UsageSnapshot?,
        supportsAverage: Bool)
        -> RateWindow?
    {
        guard let snapshot else { return nil }
        switch preference {
        case .extraUsage:
            return Self.extraUsageWindow(snapshot: snapshot)
        case .tertiary:
            return Self.window(in: snapshot, following: [.tertiary, .secondary, .primary])
        case .primary:
            return Self.window(in: snapshot, following: [.primary, .secondary, .tertiary])
        case .secondary:
            return Self.window(in: snapshot, following: [.secondary, .primary, .tertiary])
        case .average:
            return Self.averageWindow(snapshot: snapshot, supportsAverage: supportsAverage)
        case .automatic:
            return Self.automaticWindow(provider: provider, snapshot: snapshot)
        }
    }

    private static func averageWindow(
        snapshot: UsageSnapshot,
        supportsAverage: Bool)
        -> RateWindow?
    {
        guard supportsAverage,
              let primary = snapshot.primary,
              let secondary = snapshot.secondary
        else {
            return snapshot.primary ?? snapshot.secondary
        }

        let usedPercent = (primary.usedPercent + secondary.usedPercent) / 2
        return RateWindow(usedPercent: usedPercent, windowMinutes: nil, resetsAt: nil, resetDescription: nil)
    }

    private static func automaticWindow(provider: UsageProvider, snapshot: UsageSnapshot) -> RateWindow? {
        if provider == .cursor {
            return self.mostConstrainedWindow(
                primary: snapshot.primary,
                secondary: snapshot.secondary,
                tertiary: snapshot.tertiary)
        }
        if provider == .claude,
           self.shouldUseClaudeSpendLimit(providerCost: snapshot.providerCost, snapshot: snapshot),
           let extraUsage = extraUsageWindow(snapshot: snapshot)
        {
            return extraUsage
        }
        return snapshot.primary ?? snapshot.secondary
    }

    private static func window(in snapshot: UsageSnapshot, following lanes: [Lane]) -> RateWindow? {
        for lane in lanes {
            if let window = self.window(in: snapshot, lane: lane) {
                return window
            }
        }
        return nil
    }

    private static func window(in snapshot: UsageSnapshot, lane: Lane) -> RateWindow? {
        switch lane {
        case .primary:
            snapshot.primary
        case .secondary:
            snapshot.secondary
        case .tertiary:
            snapshot.tertiary
        }
    }

    private static func mostConstrainedWindow(
        primary: RateWindow?,
        secondary: RateWindow?,
        tertiary: RateWindow?)
        -> RateWindow?
    {
        let windows = [primary, secondary, tertiary].compactMap(\.self)
        guard !windows.isEmpty else { return nil }
        return windows.max(by: { $0.usedPercent < $1.usedPercent })
    }

    private static func shouldUseClaudeSpendLimit(
        providerCost: ProviderCostSnapshot?,
        snapshot: UsageSnapshot)
        -> Bool
    {
        guard providerCost?.limit ?? 0 > 0,
              snapshot.secondary == nil,
              snapshot.tertiary == nil
        else { return false }
        guard let primary = snapshot.primary else { return true }
        return primary.usedPercent == 0
            && primary.windowMinutes == 5 * 60
            && primary.resetsAt == nil
            && primary.resetDescription == nil
    }

    private static func extraUsageWindow(snapshot: UsageSnapshot?) -> RateWindow? {
        guard let cost = snapshot?.providerCost, cost.limit > 0 else { return nil }
        let usedPercent = max(0, min(100, (cost.used / cost.limit) * 100))
        return RateWindow(
            usedPercent: usedPercent,
            windowMinutes: nil,
            resetsAt: cost.resetsAt,
            resetDescription: nil)
    }
}
