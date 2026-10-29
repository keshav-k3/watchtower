import Foundation
import os

struct WidgetSnapshot: Codable {
    var version: Int
    var updatedAt: String
    var providers: [WidgetProvider]

    static let empty = WidgetSnapshot(version: WidgetContract.schemaVersion, updatedAt: "", providers: [])

    static func load() -> WidgetSnapshot {
        let loaded = candidateURLs().compactMap(read(url:))
        guard let best = loaded.max(by: { stamp($0) < stamp($1) }) else {
            return .empty
        }
        return best
    }

    /// Gallery placeholder only. The real widget reads the snapshot file.
    static func sample(now: Date) -> WidgetSnapshot {
        let iso = ISO8601DateFormatter()
        func stamp(_ seconds: TimeInterval) -> String {
            iso.string(from: now.addingTimeInterval(seconds))
        }
        let updated = stamp(0)
        return WidgetSnapshot(
            version: WidgetContract.schemaVersion,
            updatedAt: updated,
            providers: [
                WidgetProvider(
                    id: "claude",
                    name: "Claude",
                    brandColor: "#D97757",
                    stale: false,
                    updatedAt: updated,
                    lines: [
                        WidgetLine(label: "Session", percent: 72, resetsAt: stamp(3 * 3600), primary: true),
                        WidgetLine(label: "Weekly", percent: 41, resetsAt: stamp(4 * 24 * 3600), primary: false),
                    ]
                ),
                WidgetProvider(
                    id: "codex",
                    name: "Codex",
                    brandColor: "#74AA9C",
                    stale: false,
                    updatedAt: updated,
                    lines: [
                        WidgetLine(label: "Session", percent: 63, resetsAt: stamp(5 * 3600), primary: true),
                        WidgetLine(label: "Weekly", percent: 28, resetsAt: stamp(2 * 24 * 3600), primary: false),
                    ]
                ),
                WidgetProvider(
                    id: "cursor",
                    name: "Cursor",
                    brandColor: "#000000",
                    stale: false,
                    updatedAt: updated,
                    lines: [
                        WidgetLine(label: "Credits", percent: 54, resetsAt: stamp(6 * 3600), primary: true),
                    ]
                ),
                WidgetProvider(
                    id: "gemini",
                    name: "Gemini",
                    brandColor: "#4285F4",
                    stale: false,
                    updatedAt: updated,
                    lines: [
                        WidgetLine(label: "Gemini Pro", percent: 18, resetsAt: stamp(9 * 3600), primary: true),
                        WidgetLine(label: "Gemini Flash", percent: 7, resetsAt: stamp(2 * 24 * 3600), primary: false),
                    ]
                ),
                WidgetProvider(
                    id: "opencode",
                    name: "OpenCode",
                    brandColor: "#000000",
                    stale: false,
                    updatedAt: updated,
                    lines: [
                        WidgetLine(label: "Session", percent: 12, resetsAt: stamp(11 * 3600), primary: true),
                    ]
                ),
            ]
        )
    }

    private static func candidateURLs() -> [URL] {
        var urls: [URL] = []
        let fileManager = FileManager.default
        if let group = fileManager.containerURL(
            forSecurityApplicationGroupIdentifier: WidgetContract.appGroupID
        ) {
            urls.append(group.appendingPathComponent(WidgetContract.snapshotFileName))
        }
        let home = fileManager.homeDirectoryForCurrentUser
        urls.append(home.appendingPathComponent(WidgetContract.snapshotFileName))
        return urls
    }

    private static func read(url: URL) -> WidgetSnapshot? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        do {
            let snapshot = try JSONDecoder().decode(WidgetSnapshot.self, from: data)
            guard snapshot.version == WidgetContract.schemaVersion else {
                snapshotLogger.error("Widget snapshot version is not supported")
                return nil
            }
            return snapshot
        } catch {
            snapshotLogger.error(
                "Widget snapshot could not be read: \(error.localizedDescription, privacy: .public)"
            )
            return nil
        }
    }

    private static func stamp(_ snapshot: WidgetSnapshot) -> Date {
        WidgetDates.parse(snapshot.updatedAt) ?? .distantPast
    }
}

struct WidgetProvider: Codable, Identifiable {
    var id: String
    var name: String
    var brandColor: String?
    var stale: Bool
    var updatedAt: String
    var lines: [WidgetLine]
}

struct WidgetLine: Codable {
    var label: String
    var percent: Double
    var resetsAt: String?
    var primary: Bool
}

enum WidgetDates {
    static func parse(_ value: String) -> Date? {
        guard !value.isEmpty else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) {
            return date
        }
        let basic = ISO8601DateFormatter()
        basic.formatOptions = [.withInternetDateTime]
        return basic.date(from: value)
    }
}

private let snapshotLogger = Logger(subsystem: WidgetContract.logSubsystem, category: "snapshot")
