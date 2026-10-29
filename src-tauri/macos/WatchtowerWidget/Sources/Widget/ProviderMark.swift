import AppKit
import SwiftUI
import WidgetKit

func providerInk(_ provider: WidgetProvider) -> Color {
    switch provider.id {
    case "claude":
        return Color(red: 217.0 / 255.0, green: 119.0 / 255.0, blue: 87.0 / 255.0)
    case "gemini":
        return Color(red: 66.0 / 255.0, green: 133.0 / 255.0, blue: 244.0 / 255.0)
    case "cursor", "codex", "opencode", "kimi", "devin", "grok-bot":
        return .primary
    default:
        if let hex = provider.brandColor, let color = Color(hex: hex) {
            return color
        }
        return .primary
    }
}

func providerWash(_ provider: WidgetProvider?) -> Color {
    guard let provider else { return .gray }
    switch provider.id {
    case "cursor", "codex", "opencode", "kimi", "devin", "grok-bot":
        return .gray
    default:
        if let hex = provider.brandColor, hexIsDark(hex) {
            return .gray
        }
        return providerInk(provider)
    }
}

func washColor(for entry: UsageEntry) -> Color {
    let provider = smallProvider(snapshot: entry.snapshot, intent: entry.intent)
        ?? entry.snapshot.providers.first
    return providerWash(provider)
}

func meterInk(
    _ provider: WidgetProvider,
    rendering: WidgetRenderingMode,
    stale: Bool
) -> Color {
    if stale || rendering != .fullColor {
        return .primary
    }
    return providerInk(provider)
}

struct ProviderMark: View {
    @Environment(\.widgetRenderingMode) private var renderingMode
    var provider: WidgetProvider
    var size: CGFloat

    var body: some View {
        let asset = "provider-\(provider.id)"
        Group {
            if NSImage(named: NSImage.Name(asset)) != nil {
                branded(Image(asset).resizable().scaledToFit().renderingMode(.template))
            } else {
                monogram
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel(provider.name)
    }

    private var monogram: some View {
        Text(monogramLetter)
            .font(.system(size: size * 0.58, weight: .medium, design: .rounded))
            .foregroundStyle(providerInk(provider))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background {
                if renderingMode == .fullColor {
                    Circle().fill(providerInk(provider).opacity(0.14))
                }
            }
    }

    private var monogramLetter: String {
        let trimmed = provider.name.trimmingCharacters(in: .whitespacesAndNewlines)
        return String(trimmed.prefix(1)).uppercased()
    }

    @ViewBuilder
    private func branded(_ image: some View) -> some View {
        let colored = image.foregroundStyle(markStyle)
        if #available(macOS 15.0, *) {
            colored.widgetAccentedRenderingMode(.fullColor)
        } else {
            colored
        }
    }

    private var markStyle: AnyShapeStyle {
        if provider.id == "gemini" && renderingMode == .fullColor {
            return AnyShapeStyle(
                AngularGradient(
                    colors: [
                        Color(red: 66.0 / 255.0, green: 133.0 / 255.0, blue: 244.0 / 255.0),
                        Color(red: 161.0 / 255.0, green: 66.0 / 255.0, blue: 244.0 / 255.0),
                        Color(red: 234.0 / 255.0, green: 67.0 / 255.0, blue: 53.0 / 255.0),
                        Color(red: 251.0 / 255.0, green: 188.0 / 255.0, blue: 4.0 / 255.0),
                        Color(red: 52.0 / 255.0, green: 168.0 / 255.0, blue: 83.0 / 255.0),
                        Color(red: 66.0 / 255.0, green: 133.0 / 255.0, blue: 244.0 / 255.0),
                    ],
                    center: .center,
                    angle: .degrees(25)
                )
            )
        }
        return AnyShapeStyle(providerInk(provider))
    }
}

private func hexIsDark(_ hex: String) -> Bool {
    guard let channels = rgbChannels(hex) else { return false }
    let luminance = (0.2126 * channels.0) + (0.7152 * channels.1) + (0.0722 * channels.2)
    return luminance < 0.22
}

private func rgbChannels(_ hex: String) -> (Double, Double, Double)? {
    var text = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if text.hasPrefix("#") { text.removeFirst() }
    guard text.count == 6, let value = Int(text, radix: 16) else { return nil }
    return (
        Double((value >> 16) & 0xFF) / 255.0,
        Double((value >> 8) & 0xFF) / 255.0,
        Double(value & 0xFF) / 255.0
    )
}

extension Color {
    init?(hex: String) {
        guard let channels = rgbChannels(hex) else { return nil }
        self.init(red: channels.0, green: channels.1, blue: channels.2)
    }
}
