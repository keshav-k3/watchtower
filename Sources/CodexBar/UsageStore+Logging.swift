import CodexBarCore

extension UsageStore {
    func logStartupState() {
        let modeSnapshot: [String: String] = [
            "codexUsageSource": self.settings.codexUsageDataSource.rawValue,
            "claudeUsageSource": self.settings.claudeUsageDataSource.rawValue,
            "codexCookieSource": self.settings.codexCookieSource.rawValue,
            "claudeCookieSource": self.settings.claudeCookieSource.rawValue,
            "cursorCookieSource": self.settings.cursorCookieSource.rawValue,
            "claudeWebExtras": self.settings.claudeWebExtrasEnabled ? "1" : "0",
        ]
        ProviderLogging.logStartupState(
            logger: self.providerLogger,
            providers: Array(self.providerMetadata.keys),
            isEnabled: { provider in
                self.settings.isProviderEnabled(
                    provider: provider,
                    metadata: self.providerMetadata[provider]!)
            },
            modeSnapshot: modeSnapshot)
    }
}
