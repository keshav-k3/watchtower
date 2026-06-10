import AppKit
import CodexBarCore
import SweetCookieKit

private enum KeychainPromptMessage {
    static let browserCookie =
        "CodexBar will ask macOS Keychain for “%@” so it can decrypt browser cookies " +
        "and authenticate your account. Click OK to continue."

    static let claudeOAuth =
        "CodexBar will ask macOS Keychain for the Claude Code OAuth token " +
        "so it can fetch your Claude usage. Click OK to continue."
    static let codexCookie =
        "CodexBar will ask macOS Keychain for your OpenAI cookie header " +
        "so it can fetch Codex dashboard extras. Click OK to continue."
    static let claudeCookie =
        "CodexBar will ask macOS Keychain for your Claude cookie header " +
        "so it can fetch Claude web usage. Click OK to continue."
    static let cursorCookie =
        "CodexBar will ask macOS Keychain for your Cursor cookie header " +
        "so it can fetch usage. Click OK to continue."
}

enum KeychainPromptCoordinator {
    private static let promptLock = NSLock()
    private static let log = CodexBarLog.logger(LogCategories.keychainPrompt)

    static func install() {
        KeychainPromptHandler.handler = { context in
            self.presentKeychainPrompt(context)
        }
        BrowserCookieKeychainPromptHandler.handler = { context in
            self.presentBrowserCookiePrompt(context)
        }
    }

    private static func presentKeychainPrompt(_ context: KeychainPromptContext) {
        let (title, message) = self.keychainCopy(for: context)
        self.log.info("Keychain prompt requested", metadata: ["kind": "\(context.kind)"])
        self.presentAlert(title: title, message: message)
    }

    private static func presentBrowserCookiePrompt(_ context: BrowserCookieKeychainPromptContext) {
        let title = L("Keychain Access Required")
        let message = L(
            KeychainPromptMessage.browserCookie,
            context.label)
        self.log.info("Browser cookie keychain prompt requested", metadata: ["label": context.label])
        self.presentAlert(title: title, message: message)
    }

    private static func keychainCopy(for context: KeychainPromptContext) -> (title: String, message: String) {
        let title = L("Keychain Access Required")
        switch context.kind {
        case .claudeOAuth:
            return (title, L(KeychainPromptMessage.claudeOAuth))
        case .codexCookie:
            return (title, L(KeychainPromptMessage.codexCookie))
        case .claudeCookie:
            return (title, L(KeychainPromptMessage.claudeCookie))
        case .cursorCookie:
            return (title, L(KeychainPromptMessage.cursorCookie))
        }
    }

    private static func presentAlert(title: String, message: String) {
        self.promptLock.lock()
        defer { self.promptLock.unlock() }

        if Thread.isMainThread {
            MainActor.assumeIsolated {
                self.showAlert(title: title, message: message)
            }
            return
        }
        DispatchQueue.main.sync {
            MainActor.assumeIsolated {
                self.showAlert(title: title, message: message)
            }
        }
    }

    @MainActor
    private static func showAlert(title: String, message: String) {
        let alert = NSAlert()
        alert.messageText = L(title)
        alert.informativeText = L(message)
        alert.addButton(withTitle: L("OK"))
        _ = alert.runModal()
    }
}
