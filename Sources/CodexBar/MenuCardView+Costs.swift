import CodexBarCore
import Foundation

extension UsageMenuCardView.Model {
    static func tokenUsageSnapshot(input: Input) -> CostUsageTokenSnapshot? {
        if usesProviderCostHistoryAsPrimaryDashboard(input.provider), input.snapshot != nil {
            return primaryCostHistorySnapshot(input: input)
        }
        return input.tokenSnapshot
    }

    static func creditsLine(
        metadata: ProviderMetadata,
        credits: CreditsSnapshot?,
        error: String?) -> String?
    {
        guard metadata.supportsCredits else { return nil }
        if let credits {
            return UsageFormatter.creditsString(from: credits.remaining)
        }
        if let error, !error.isEmpty {
            return error.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return L(metadata.creditsHint)
    }

    static func tokenUsageSection(
        provider: UsageProvider,
        enabled: Bool,
        snapshot: CostUsageTokenSnapshot?,
        error: String?) -> TokenUsageSection?
    {
        guard ProviderDescriptorRegistry.descriptor(for: provider).tokenCost.supportsTokenCost else {
            return nil
        }
        guard enabled else { return nil }
        guard let snapshot else { return nil }

        let sessionCost = snapshot.sessionCostUSD.map {
            UsageFormatter.currencyString($0, currencyCode: snapshot.currencyCode)
        } ?? "—"
        let sessionTokens = snapshot.sessionTokens.map { UsageFormatter.tokenCountString($0) }
        let sessionLabel = L("Today")
        let sessionLine: String = {
            if let sessionTokens {
                return String(format: L("%@: %@ · %@ tokens"), sessionLabel, sessionCost, sessionTokens)
            }
            return "\(sessionLabel): \(sessionCost)"
        }()

        let monthCost = snapshot.last30DaysCostUSD.map {
            UsageFormatter.currencyString($0, currencyCode: snapshot.currencyCode)
        } ?? "—"
        let fallbackTokens = snapshot.daily.compactMap(\.totalTokens).reduce(0, +)
        let monthTokensValue = snapshot.last30DaysTokens ?? (fallbackTokens > 0 ? fallbackTokens : nil)
        let monthTokens = monthTokensValue.map { UsageFormatter.tokenCountString($0) }
        let windowLabel = snapshot.historyLabel ?? Self.costHistoryWindowLabel(days: snapshot.historyDays)
        let monthLine: String = {
            if let monthTokens {
                return String(format: L("%@: %@ · %@ tokens"), windowLabel, monthCost, monthTokens)
            }
            return "\(windowLabel): \(monthCost)"
        }()
        let err = (error?.isEmpty ?? true) ? nil : error
        return TokenUsageSection(
            sessionLine: sessionLine,
            monthLine: monthLine,
            hintLine: Self.tokenUsageHint(provider: provider),
            errorLine: err,
            errorCopyText: (error?.isEmpty ?? true) ? nil : error)
    }

    static func tokenUsageHint(provider: UsageProvider) -> String? {
        switch provider {
        case .codex:
            L("Estimated from local Codex logs for the selected account.")
        case .claude:
            UsageFormatter.costEstimateHint(provider: provider)
        default:
            nil
        }
    }

    static func costHistoryWindowLabel(days: Int) -> String {
        days == 1 ? L("Today") : String(format: L("Last %d days"), days)
    }

    static func providerCostSection(
        provider: UsageProvider,
        cost: ProviderCostSnapshot?) -> ProviderCostSection?
    {
        guard let cost else { return nil }

        if provider == .claude, cost.limit <= 0 {
            let spend = UsageFormatter.currencyString(cost.used, currencyCode: cost.currencyCode)
            let periodLabel = Self.localizedPeriodLabel(cost.period ?? "Last 30 days")
            return ProviderCostSection(
                title: L("API spend"),
                percentUsed: nil,
                spendLine: "\(periodLabel): \(spend)",
                percentLine: nil)
        }

        guard cost.limit > 0 else { return nil }

        let used: String
        let limit: String
        let title: String

        if cost.currencyCode == "Quota" {
            title = L("Quota usage")
            used = String(format: "%.0f", cost.used)
            limit = String(format: "%.0f", cost.limit)
        } else {
            title = L("Extra usage")
            used = UsageFormatter.currencyString(cost.used, currencyCode: cost.currencyCode)
            limit = UsageFormatter.currencyString(cost.limit, currencyCode: cost.currencyCode)
        }

        let percentUsed = Self.clamped((cost.used / cost.limit) * 100)
        let periodLabel = Self.localizedPeriodLabel(cost.period ?? "This month")

        return ProviderCostSection(
            title: title,
            percentUsed: percentUsed,
            spendLine: "\(periodLabel): \(used) / \(limit)",
            percentLine: String(format: L("%.0f%% used"), min(100, max(0, percentUsed))))
    }

    private static func localizedPeriodLabel(_ label: String) -> String {
        let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
        switch trimmed.lowercased() {
        case "last 30 days":
            return L("Last 30 days")
        case "this month":
            return L("This month")
        case "today":
            return L("Today")
        default:
            return L(trimmed)
        }
    }

    static func clamped(_ value: Double) -> Double {
        min(100, max(0, value))
    }
}
