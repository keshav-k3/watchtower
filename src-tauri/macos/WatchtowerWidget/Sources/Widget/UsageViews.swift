import SwiftUI
import WidgetKit

struct UsageWidgetView: View {
    @Environment(\.widgetFamily) private var family
    var entry: UsageEntry

    var body: some View {
        Group {
            switch family {
            case .systemSmall:
                SmallUsageView(entry: entry)
            case .systemMedium:
                MediumUsageView(entry: entry)
            default:
                LargeUsageView(entry: entry)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct WidgetChromeBackground: View {
    @Environment(\.colorScheme) private var scheme
    var tint: Color

    var body: some View {
        ZStack {
            (scheme == .dark ? Color.black : Color.white)
                .opacity(scheme == .dark ? 0.42 : 0.74)
            LinearGradient(
                colors: [tint.opacity(scheme == .dark ? 0.30 : 0.20), .clear],
                startPoint: .topLeading,
                endPoint: .center
            )
        }
    }
}

private struct SmallUsageView: View {
    @Environment(\.widgetRenderingMode) private var renderingMode
    var entry: UsageEntry

    var body: some View {
        Group {
            if let provider = smallProvider(snapshot: entry.snapshot, intent: entry.intent) {
                providerBody(provider)
            } else {
                EmptyUsageView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private func providerBody(_ provider: WidgetProvider) -> some View {
        let line = primaryLine(of: provider)
        let stale = isStale(provider, now: entry.date)
        let ink = meterInk(provider, rendering: renderingMode, stale: stale)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                ProviderMark(provider: provider, size: 16)
                Text(provider.name)
                    .font(.system(size: 13, weight: .medium))
                    .lineLimit(1)
                Spacer(minLength: 4)
                if stale {
                    Text("Stale")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.tertiary)
                }
            }
            Spacer(minLength: 8)
            if let line {
                HStack(alignment: .center, spacing: 8) {
                    VStack(alignment: .leading, spacing: 1) {
                        HStack(alignment: .firstTextBaseline, spacing: 1) {
                            Text(percentString(line.percent))
                                .font(.system(size: 40, weight: .light, design: .rounded))
                                .monospacedDigit()
                                .minimumScaleFactor(0.6)
                                .lineLimit(1)
                                .widgetAccentable()
                            Text("%")
                                .font(.system(size: 14, weight: .medium, design: .rounded))
                                .foregroundStyle(.secondary)
                        }
                        Text(line.label)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    UsageRing(percent: line.percent, ink: ink)
                        .frame(width: 34, height: 34)
                }
                Spacer(minLength: 6)
                Text(resetPhrase(for: line, now: entry.date, sentence: true) ?? " ")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
            } else {
                Spacer(minLength: 0)
                Text("No data")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct MediumUsageView: View {
    var entry: UsageEntry

    var body: some View {
        let page = mediumPage(snapshot: entry.snapshot, intent: entry.intent)
        if page.providers.isEmpty {
            EmptyUsageView()
        } else {
            VStack(alignment: .leading, spacing: 8) {
                UsageHeader(
                    trailing: upcomingResets(providers: page.providers, now: entry.date, limit: 1).first?.phrase
                )
                VStack(alignment: .leading, spacing: 7) {
                    ForEach(page.providers) { provider in
                        MediumRow(provider: provider, now: entry.date)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

private struct MediumRow: View {
    @Environment(\.widgetRenderingMode) private var renderingMode
    var provider: WidgetProvider
    var now: Date

    var body: some View {
        let line = primaryLine(of: provider)
        let stale = isStale(provider, now: now)
        let ink = meterInk(provider, rendering: renderingMode, stale: stale)
        HStack(spacing: 8) {
            ProviderMark(provider: provider, size: 14)
            Text(provider.name)
                .font(.system(size: 12, weight: .medium))
                .lineLimit(1)
                .frame(width: 72, alignment: .leading)
            UsageBar(percent: line?.percent ?? 0, ink: ink)
            Text(line.map { percentString($0.percent) } ?? "—")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .monospacedDigit()
                .frame(width: 32, alignment: .trailing)
                .widgetAccentable()
        }
        .accessibilityElement(children: .combine)
    }
}

private struct LargeUsageView: View {
    var entry: UsageEntry

    var body: some View {
        let page = largePage(snapshot: entry.snapshot, intent: entry.intent)
        if page.providers.isEmpty {
            EmptyUsageView()
        } else {
            let upcoming = upcomingResets(providers: page.providers, now: entry.date, limit: 2)
            VStack(alignment: .leading, spacing: 0) {
                UsageHeader(trailing: upcoming.first?.phrase)
                VStack(alignment: .leading, spacing: 9) {
                    ForEach(page.providers) { provider in
                        LargeRow(provider: provider, now: entry.date)
                    }
                    if page.hidden > 0 {
                        Text("+\(page.hidden) more")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.tertiary)
                    }
                }
                .padding(.top, 10)
                Spacer(minLength: 8)
                if !upcoming.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Next Reset")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.tertiary)
                        ForEach(upcoming) { item in
                            HStack(spacing: 6) {
                                Text(item.name)
                                Text(item.label)
                                    .foregroundStyle(.secondary)
                                Spacer(minLength: 4)
                                Text(item.phrase)
                                    .monospacedDigit()
                                    .foregroundStyle(.secondary)
                            }
                            .font(.system(size: 11))
                            .lineLimit(1)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

private struct LargeRow: View {
    @Environment(\.widgetRenderingMode) private var renderingMode
    var provider: WidgetProvider
    var now: Date

    var body: some View {
        let line = primaryLine(of: provider)
        let stale = isStale(provider, now: now)
        let ink = meterInk(provider, rendering: renderingMode, stale: stale)
        let extra = provider.lines.first { $0.label != line?.label }
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                ProviderMark(provider: provider, size: 13)
                Text(provider.name)
                    .font(.system(size: 13, weight: .medium))
                    .lineLimit(1)
                if stale {
                    Text("Stale")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.tertiary)
                }
                Spacer(minLength: 4)
                Text(line.map { percentString($0.percent) } ?? "—")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .monospacedDigit()
                    .widgetAccentable()
                Text("%")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
            }
            UsageBar(percent: line?.percent ?? 0, ink: ink)
            HStack(spacing: 4) {
                Text(subtitle(line: line, extra: extra))
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text(resetPhrase(for: line, now: now, sentence: false) ?? "")
                    .monospacedDigit()
            }
            .font(.system(size: 11))
            .foregroundStyle(.tertiary)
        }
        .accessibilityElement(children: .combine)
    }

    private func subtitle(line: WidgetLine?, extra: WidgetLine?) -> String {
        var parts: [String] = []
        if let line {
            parts.append(line.label)
        }
        if let extra {
            parts.append("\(extra.label) \(percentString(extra.percent))%")
        }
        return parts.joined(separator: " · ")
    }
}

private struct UsageHeader: View {
    var trailing: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("Usage")
                .font(.system(size: 13, weight: .semibold))
            Spacer(minLength: 8)
            if let trailing {
                Text(trailing)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
    }
}

private struct EmptyUsageView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Usage")
                .font(.system(size: 13, weight: .semibold))
            Spacer(minLength: 0)
            Text("Open Watchtower")
                .font(.system(size: 15, weight: .medium))
            Text("Usage shows up after a refresh.")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct UsageRing: View {
    var percent: Double
    var ink: Color

    var body: some View {
        let progress = min(max(percent / 100.0, 0), 1)
        ZStack {
            Circle()
                .stroke(Color.primary.opacity(0.12), lineWidth: 2)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(ink, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .widgetAccentable()
        }
    }
}

private struct UsageBar: View {
    var percent: Double
    var ink: Color

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width * min(max(percent / 100.0, 0), 1)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.primary.opacity(0.10))
                Capsule()
                    .fill(ink)
                    .frame(width: max(width, percent > 0 ? 3 : 0))
                    .widgetAccentable()
            }
        }
        .frame(height: 3)
    }
}
