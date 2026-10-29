import Foundation

/// Identifiers shared by the widget extension and the reload bridge.
/// Keep these in sync with `src-tauri/src/widget_snapshot.rs`.
enum WidgetContract {
    static let appGroupID = "group.com.keshavk3.watchtower"
    static let extensionBundleID = "com.keshavk3.watchtower.widget"
    static let kind = "com.keshavk3.watchtower.usage"
    static let snapshotFileName = "widget-snapshot.json"
    static let schemaVersion = 1
    /// Matches `RELOAD_GAP_SECS` in the Rust snapshot writer.
    static let timelineMinutes = 15
    /// A provider with no successful refresh for this long is shown as stale.
    static let staleAfter: TimeInterval = 6 * 60 * 60
    static let logSubsystem = "com.keshavk3.watchtower.widget"
}
