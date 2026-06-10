import CodexBarCore
import SwiftUI

struct InlineUsageDashboardModel: Equatable {
    struct KPI: Equatable {
        let title: String
        let value: String
        let emphasis: Bool
    }

    struct Point: Equatable, Identifiable {
        let id: String
        let label: String
        let value: Double
        let accessibilityValue: String
    }

    enum ValueStyle: Equatable {
        case currencyUSD
        case currency(symbol: String)
        case tokens
    }

    let accessibilityLabel: String
    let valueStyle: ValueStyle
    let kpis: [KPI]
    let points: [Point]
    let detailLines: [String]
}

extension UsageMenuCardView.Model {
    static func apiProviderUsageNotes(input _: Input) -> [String]? {
        nil
    }

    static func inlineUsageDashboard(input _: Input) -> InlineUsageDashboardModel? {
        nil
    }

    static func usesProviderCostHistoryAsPrimaryDashboard(_: UsageProvider) -> Bool {
        false
    }

    static func primaryCostHistorySnapshot(input: Input) -> CostUsageTokenSnapshot? {
        input.tokenSnapshot
    }
}

struct InlineUsageDashboardContent: View {
    let model: InlineUsageDashboardModel

    var body: some View {
        EmptyView()
    }
}
