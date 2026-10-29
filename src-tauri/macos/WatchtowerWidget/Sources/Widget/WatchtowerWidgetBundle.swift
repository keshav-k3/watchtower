import SwiftUI
import WidgetKit

struct UsageEntry: TimelineEntry {
    var date: Date
    var snapshot: WidgetSnapshot
    var intent: WatchtowerWidgetIntent
}

struct UsageTimelineProvider: AppIntentTimelineProvider {
    func placeholder(in _: Context) -> UsageEntry {
        let now = Date()
        return UsageEntry(date: now, snapshot: .sample(now: now), intent: WatchtowerWidgetIntent())
    }

    func snapshot(for configuration: WatchtowerWidgetIntent, in _: Context) async -> UsageEntry {
        UsageEntry(date: Date(), snapshot: WidgetSnapshot.load(), intent: configuration)
    }

    func timeline(for configuration: WatchtowerWidgetIntent, in _: Context) async -> Timeline<UsageEntry> {
        let now = Date()
        let snapshot = WidgetSnapshot.load()
        let minutes = WidgetContract.timelineMinutes
        var entries: [UsageEntry] = []
        entries.reserveCapacity(minutes)
        for minute in 0..<minutes {
            let date = now.addingTimeInterval(TimeInterval(minute * 60))
            entries.append(UsageEntry(date: date, snapshot: snapshot, intent: configuration))
        }
        let next = now.addingTimeInterval(TimeInterval(minutes * 60))
        return Timeline(entries: entries, policy: .after(next))
    }
}

struct UsageWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: WidgetContract.kind,
            intent: WatchtowerWidgetIntent.self,
            provider: UsageTimelineProvider()
        ) { entry in
            UsageWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    WidgetChromeBackground(tint: washColor(for: entry))
                }
        }
        .configurationDisplayName("Usage")
        .description("How full each plan is, and when it resets.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

@main
struct WatchtowerWidgetBundle: WidgetBundle {
    var body: some Widget {
        UsageWidget()
    }
}
