import Foundation

struct ProviderPage {
    var providers: [WidgetProvider]
    var hidden: Int
}

func primaryLine(of provider: WidgetProvider) -> WidgetLine? {
    if let line = provider.lines.first(where: \.primary) {
        return line
    }
    return provider.lines.first
}

func isStale(_ provider: WidgetProvider, now: Date) -> Bool {
    if provider.stale { return true }
    guard let updated = WidgetDates.parse(provider.updatedAt) else { return true }
    return now.timeIntervalSince(updated) > WidgetContract.staleAfter
}

func percentString(_ value: Double) -> String {
    String(Int(value.rounded()))
}

func smallProvider(snapshot: WidgetSnapshot, intent: WatchtowerWidgetIntent) -> WidgetProvider? {
    if let chosen = intent.provider,
       let match = snapshot.providers.first(where: { $0.id == chosen.id }) {
        return match
    }
    let ranked = snapshot.providers.filter { primaryLine(of: $0) != nil }
    return ranked.max { lhs, rhs in
        (primaryLine(of: lhs)?.percent ?? -1) < (primaryLine(of: rhs)?.percent ?? -1)
    }
}

func mediumPage(snapshot: WidgetSnapshot, intent: WatchtowerWidgetIntent) -> ProviderPage {
    page(snapshot: snapshot, intent: intent, limit: 4, ranked: true, requireLine: true)
}

func largePage(snapshot: WidgetSnapshot, intent: WatchtowerWidgetIntent) -> ProviderPage {
    page(snapshot: snapshot, intent: intent, limit: 6, ranked: false, requireLine: true)
}

func resetPhrase(from now: Date, to target: Date, sentence: Bool) -> String {
    let seconds = target.timeIntervalSince(now)
    if seconds <= 60 {
        return sentence ? "Resets soon" : "Soon"
    }
    if seconds < 3600 {
        let minutes = max(Int(seconds / 60), 1)
        return sentence ? "Resets \(minutes)m" : "\(minutes)m"
    }
    if seconds < 48 * 3600 {
        let hours = max(Int(seconds / 3600), 1)
        return sentence ? "Resets \(hours)h" : "\(hours)h"
    }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    if seconds < 7 * 24 * 3600 {
        formatter.setLocalizedDateFormatFromTemplate("EEE")
    } else {
        formatter.setLocalizedDateFormatFromTemplate("MMM d")
    }
    let day = formatter.string(from: target)
    return sentence ? "Resets \(day)" : day
}

func resetPhrase(for line: WidgetLine?, now: Date, sentence: Bool) -> String? {
    guard let raw = line?.resetsAt, let target = WidgetDates.parse(raw) else { return nil }
    return resetPhrase(from: now, to: target, sentence: sentence)
}

struct UpcomingReset: Identifiable {
    var id: String
    var name: String
    var label: String
    var phrase: String
}

func upcomingResets(providers: [WidgetProvider], now: Date, limit: Int) -> [UpcomingReset] {
    var items: [(date: Date, item: UpcomingReset)] = []
    for provider in providers {
        for line in provider.lines {
            guard let raw = line.resetsAt, let date = WidgetDates.parse(raw), date > now else { continue }
            items.append(
                (
                    date,
                    UpcomingReset(
                        id: "\(provider.id)-\(line.label)",
                        name: provider.name,
                        label: line.label,
                        phrase: resetPhrase(from: now, to: date, sentence: false)
                    )
                )
            )
        }
    }
    items.sort { $0.date < $1.date }
    return items.prefix(limit).map(\.item)
}

private func page(
    snapshot: WidgetSnapshot,
    intent: WatchtowerWidgetIntent,
    limit: Int,
    ranked: Bool,
    requireLine: Bool
) -> ProviderPage {
    let chosen = intent.providers ?? []
    var base: [WidgetProvider]
    if chosen.isEmpty {
        base = snapshot.providers
        if requireLine {
            base = base.filter { primaryLine(of: $0) != nil }
        }
        if ranked {
            base.sort { (primaryLine(of: $0)?.percent ?? -1) > (primaryLine(of: $1)?.percent ?? -1) }
        }
    } else {
        base = chosen.compactMap { entity in
            snapshot.providers.first { $0.id == entity.id }
        }
    }
    let hidden = max(base.count - limit, 0)
    return ProviderPage(providers: Array(base.prefix(limit)), hidden: hidden)
}
