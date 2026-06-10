import Foundation

extension TokenAccountSupportCatalog {
    static let supportByProvider: [UsageProvider: TokenAccountSupport] = [
        .codex: TokenAccountSupport(
            title: "Session tokens",
            subtitle: "Store multiple Codex Cookie headers.",
            placeholder: "Cookie: …",
            injection: .cookieHeader,
            requiresManualCookieSource: true,
            cookieName: nil),
        .claude: TokenAccountSupport(
            title: "Claude credentials",
            subtitle: "Store Claude sessionKey cookies, OAuth tokens, or Anthropic Admin API keys.",
            placeholder: "Paste sessionKey, OAuth token, or sk-ant-admin…",
            injection: .cookieHeader,
            requiresManualCookieSource: true,
            cookieName: "sessionKey"),
        .cursor: TokenAccountSupport(
            title: "Session tokens",
            subtitle: "Store multiple Cursor Cookie headers.",
            placeholder: "Cookie: …",
            injection: .cookieHeader,
            requiresManualCookieSource: true,
            cookieName: nil),
    ]
}
