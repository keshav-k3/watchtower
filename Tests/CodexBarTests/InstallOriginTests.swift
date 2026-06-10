import Foundation
import Testing
@testable import CodexBar

struct InstallOriginTests {
    @Test
    func detectsHomebrewCaskroom() {
        #expect(
            InstallOrigin
                .isHomebrewCask(
                    appBundleURL: URL(fileURLWithPath: "/opt/homebrew/Caskroom/watchtower/0.1.0/Watchtower.app")))
        #expect(
            InstallOrigin
                .isHomebrewCask(
                    appBundleURL: URL(fileURLWithPath: "/usr/local/Caskroom/watchtower/0.1.0/Watchtower.app")))
        #expect(!InstallOrigin.isHomebrewCask(appBundleURL: URL(fileURLWithPath: "/Applications/Watchtower.app")))
    }
}
