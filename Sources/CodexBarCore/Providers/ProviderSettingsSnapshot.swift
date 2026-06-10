import Foundation

public struct ProviderSettingsSnapshot: Sendable {
    public static func make(
        debugMenuEnabled: Bool = false,
        debugKeepCLISessionsAlive: Bool = false,
        codex: CodexProviderSettings? = nil,
        claude: ClaudeProviderSettings? = nil,
        cursor: CursorProviderSettings? = nil)
        -> ProviderSettingsSnapshot
    {
        ProviderSettingsSnapshot(
            debugMenuEnabled: debugMenuEnabled,
            debugKeepCLISessionsAlive: debugKeepCLISessionsAlive,
            codex: codex,
            claude: claude,
            cursor: cursor)
    }

    public struct CodexProviderSettings: Sendable {
        public let usageDataSource: CodexUsageDataSource
        public let cookieSource: ProviderCookieSource
        public let manualCookieHeader: String?
        public let managedAccountStoreUnreadable: Bool
        public let managedAccountTargetUnavailable: Bool
        public let dashboardAuthorityKnownOwners: [CodexDashboardKnownOwnerCandidate]

        public init(
            usageDataSource: CodexUsageDataSource,
            cookieSource: ProviderCookieSource,
            manualCookieHeader: String?,
            managedAccountStoreUnreadable: Bool = false,
            managedAccountTargetUnavailable: Bool = false,
            dashboardAuthorityKnownOwners: [CodexDashboardKnownOwnerCandidate] = [])
        {
            self.usageDataSource = usageDataSource
            self.cookieSource = cookieSource
            self.manualCookieHeader = manualCookieHeader
            self.managedAccountStoreUnreadable = managedAccountStoreUnreadable
            self.managedAccountTargetUnavailable = managedAccountTargetUnavailable
            self.dashboardAuthorityKnownOwners = dashboardAuthorityKnownOwners
        }
    }

    public struct ClaudeProviderSettings: Sendable {
        public let usageDataSource: ClaudeUsageDataSource
        public let webExtrasEnabled: Bool
        public let cookieSource: ProviderCookieSource
        public let manualCookieHeader: String?
        public let organizationID: String?

        public init(
            usageDataSource: ClaudeUsageDataSource,
            webExtrasEnabled: Bool,
            cookieSource: ProviderCookieSource,
            manualCookieHeader: String?,
            organizationID: String? = nil)
        {
            self.usageDataSource = usageDataSource
            self.webExtrasEnabled = webExtrasEnabled
            self.cookieSource = cookieSource
            self.manualCookieHeader = manualCookieHeader
            self.organizationID = organizationID
        }
    }

    public struct CursorProviderSettings: Sendable {
        public let cookieSource: ProviderCookieSource
        public let manualCookieHeader: String?

        public init(cookieSource: ProviderCookieSource, manualCookieHeader: String?) {
            self.cookieSource = cookieSource
            self.manualCookieHeader = manualCookieHeader
        }
    }

    public let debugMenuEnabled: Bool
    public let debugKeepCLISessionsAlive: Bool
    public let codex: CodexProviderSettings?
    public let claude: ClaudeProviderSettings?
    public let cursor: CursorProviderSettings?

    public init(
        debugMenuEnabled: Bool,
        debugKeepCLISessionsAlive: Bool,
        codex: CodexProviderSettings?,
        claude: ClaudeProviderSettings?,
        cursor: CursorProviderSettings?)
    {
        self.debugMenuEnabled = debugMenuEnabled
        self.debugKeepCLISessionsAlive = debugKeepCLISessionsAlive
        self.codex = codex
        self.claude = claude
        self.cursor = cursor
    }
}

public enum ProviderSettingsSnapshotContribution: Sendable {
    case codex(ProviderSettingsSnapshot.CodexProviderSettings)
    case claude(ProviderSettingsSnapshot.ClaudeProviderSettings)
    case cursor(ProviderSettingsSnapshot.CursorProviderSettings)
}

public struct ProviderSettingsSnapshotBuilder: Sendable {
    public var debugMenuEnabled: Bool
    public var debugKeepCLISessionsAlive: Bool
    public var codex: ProviderSettingsSnapshot.CodexProviderSettings?
    public var claude: ProviderSettingsSnapshot.ClaudeProviderSettings?
    public var cursor: ProviderSettingsSnapshot.CursorProviderSettings?

    public init(debugMenuEnabled: Bool = false, debugKeepCLISessionsAlive: Bool = false) {
        self.debugMenuEnabled = debugMenuEnabled
        self.debugKeepCLISessionsAlive = debugKeepCLISessionsAlive
    }

    public mutating func apply(_ contribution: ProviderSettingsSnapshotContribution) {
        switch contribution {
        case let .codex(value): self.codex = value
        case let .claude(value): self.claude = value
        case let .cursor(value): self.cursor = value
        }
    }

    public func build() -> ProviderSettingsSnapshot {
        ProviderSettingsSnapshot(
            debugMenuEnabled: self.debugMenuEnabled,
            debugKeepCLISessionsAlive: self.debugKeepCLISessionsAlive,
            codex: self.codex,
            claude: self.claude,
            cursor: self.cursor)
    }
}
