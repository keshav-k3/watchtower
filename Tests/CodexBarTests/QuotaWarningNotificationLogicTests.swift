import Testing
@testable import CodexBar

@Suite(.serialized)
struct QuotaWarningNotificationLogicTests {
    @Test
    func quotaWarningCopyIncludesCurrentRemainingAndThreshold() {
        Self.withAppLanguage("en") {
            let copy = QuotaWarningNotificationLogic.notificationCopy(
                providerName: "Codex",
                window: .session,
                threshold: 20,
                currentRemaining: 12.4)

            #expect(copy.title == "Codex session quota low")
            #expect(copy.body == "12% left. Reached your 20% session warning threshold.")
        }
    }

    @Test
    func quotaWarningCopyClampsCurrentRemaining() {
        Self.withAppLanguage("en") {
            let copy = QuotaWarningNotificationLogic.notificationCopy(
                providerName: "Codex",
                window: .weekly,
                threshold: 50,
                currentRemaining: -3)

            #expect(copy.title == "Codex weekly quota low")
            #expect(copy.body == "0% left. Reached your 50% weekly warning threshold.")
        }
    }

    @Test
    func quotaWarningCopyIncludesAccountWhenProvided() {
        Self.withAppLanguage("en") {
            let copy = QuotaWarningNotificationLogic.notificationCopy(
                providerName: "Codex",
                window: .session,
                threshold: 50,
                currentRemaining: 45,
                accountDisplayName: "person@example.com")

            #expect(copy.title == "Codex session quota low")
            #expect(copy.body == "Account person@example.com. 45% left. Reached your 50% session warning threshold.")
        }
    }

    @Test
    func quotaWarningCopyFollowsTraditionalChineseAppLanguage() {
        Self.withAppLanguage("zh-Hant") {
            let copy = QuotaWarningNotificationLogic.notificationCopy(
                providerName: "Codex",
                window: .session,
                threshold: 50,
                currentRemaining: 45,
                accountDisplayName: "person@example.com")

            #expect(copy.title == "Codex 工作階段配額偏低")
            #expect(copy.body == "帳號 person@example.com。剩餘 45%。已達到 50% 工作階段提醒門檻。")
        }
    }

    @Test
    func doesNothingWithoutCrossing() {
        let crossed = QuotaWarningNotificationLogic.crossedThreshold(
            previousRemaining: 60,
            currentRemaining: 55,
            thresholds: [50, 20],
            alreadyFired: [])

        #expect(crossed == nil)
    }

    @Test
    func detectsDownwardCrossing() {
        let crossed = QuotaWarningNotificationLogic.crossedThreshold(
            previousRemaining: 55,
            currentRemaining: 45,
            thresholds: [50, 20],
            alreadyFired: [])

        #expect(crossed == 50)
    }

    @Test
    func skipsAlreadyFiredThresholds() {
        let crossed = QuotaWarningNotificationLogic.crossedThreshold(
            previousRemaining: 55,
            currentRemaining: 45,
            thresholds: [50, 20],
            alreadyFired: [50])

        #expect(crossed == nil)
    }

    @Test
    func choosesMostSevereThresholdWhenCrossingSeveralAtOnce() {
        let crossed = QuotaWarningNotificationLogic.crossedThreshold(
            previousRemaining: 80,
            currentRemaining: 10,
            thresholds: [50, 20],
            alreadyFired: [])

        #expect(crossed == 20)
    }

    @Test
    func startupBelowThresholdWarnsOnceAtMostSevereThreshold() {
        let crossed = QuotaWarningNotificationLogic.crossedThreshold(
            previousRemaining: nil,
            currentRemaining: 10,
            thresholds: [50, 20],
            alreadyFired: [])

        #expect(crossed == 20)
    }

    @Test
    func warningMarksThresholdAndHigherThresholdsFired() {
        let fired = QuotaWarningNotificationLogic.firedThresholdsAfterWarning(
            threshold: 20,
            thresholds: [50, 20])

        #expect(fired == [50, 20])
    }

    @Test
    func recoveryClearsOnlyThresholdsBelowCurrentRemaining() {
        let cleared = QuotaWarningNotificationLogic.thresholdsToClear(
            currentRemaining: 30,
            alreadyFired: [50, 20])

        #expect(cleared == [20])
    }

    @Test
    func zeroThresholdDoesNotPostQuotaWarning() {
        let crossed = QuotaWarningNotificationLogic.crossedThreshold(
            previousRemaining: 10,
            currentRemaining: 0,
            thresholds: [10, 0],
            alreadyFired: [10])

        #expect(crossed == nil)
        #expect(QuotaWarningNotificationLogic.firedThresholdsAfterWarning(threshold: 10, thresholds: [10, 0]) == [10])
    }

    private static func withAppLanguage(_ language: String, perform body: () -> Void) {
        CodexBarLocalizationOverride.$appLanguage.withValue(language, operation: body)
    }
}
