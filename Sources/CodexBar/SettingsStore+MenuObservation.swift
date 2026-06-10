import Foundation

extension SettingsStore {
    var menuObservationToken: Int {
        _ = self.providerOrder
        _ = self.providerEnablement
        _ = self.refreshFrequency
        _ = self.launchAtLogin
        _ = self.debugMenuEnabled
        _ = self.debugDisableKeychainAccess
        _ = self.debugKeepCLISessionsAlive
        _ = self.statusChecksEnabled
        _ = self.sessionQuotaNotificationsEnabled
        _ = self.quotaWarningNotificationsEnabled
        _ = self.quotaWarningThresholds
        _ = self.quotaWarningThresholds(.session)
        _ = self.quotaWarningThresholds(.weekly)
        _ = self.quotaWarningWindowEnabled(.session)
        _ = self.quotaWarningWindowEnabled(.weekly)
        _ = self.quotaWarningSoundEnabled
        _ = self.quotaWarningMarkersVisible
        _ = self.weeklyProgressWorkDays
        _ = self.usageBarsShowUsed
        _ = self.resetTimesShowAbsolute
        _ = self.providerChangelogLinksEnabled
        _ = self.menuBarShowsBrandIconWithPercent
        _ = self.menuBarShowsHighestUsage
        _ = self.menuBarDisplayMode
        _ = self.historicalTrackingEnabled
        _ = self.multiAccountMenuLayout
        _ = self.menuBarMetricPreferencesRaw
        _ = self.costUsageEnabled
        _ = self.costUsageHistoryDays
        _ = self.appLanguage
        _ = self.hidePersonalInfo
        _ = self.randomBlinkEnabled
        _ = self.confettiOnWeeklyLimitResetsEnabled
        _ = self.claudeOAuthKeychainPromptMode
        _ = self.claudeOAuthKeychainReadStrategy
        _ = self.claudeWebExtrasEnabled
        _ = self.showOptionalCreditsAndExtraUsage
        _ = self.openAIWebAccessEnabled
        _ = self.openAIWebBatterySaverEnabled
        _ = self.providerStorageFootprintsEnabled
        _ = self.codexUsageDataSource
        _ = self.codexActiveSource
        _ = self.claudeUsageDataSource
        _ = self.codexCookieSource
        _ = self.claudeCookieSource
        _ = self.cursorCookieSource
        _ = self.mergeIcons
        _ = self.switcherShowsIcons
        _ = self.mergedOverviewSelectedProviders
        _ = self.codexCookieHeader
        _ = self.claudeCookieHeader
        _ = self.cursorCookieHeader
        _ = self.tokenAccountsByProvider
        _ = self.debugLoadingPattern
        _ = self.configRevision
        return 0
    }
}
