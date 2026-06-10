import Foundation

public enum ProviderConfigEnvironment {
    public static func applyAPIKeyOverride(
        base: [String: String],
        provider: UsageProvider,
        config: ProviderConfig?) -> [String: String]
    {
        guard let apiKey = config?.sanitizedAPIKey, !apiKey.isEmpty else { return base }
        var env = base
        if let key = self.directAPIKeyEnvironmentKey(for: provider) {
            env[key] = apiKey
        }
        return env
    }

    public static func supportsAPIKeyOverride(for provider: UsageProvider) -> Bool {
        self.directAPIKeyEnvironmentKey(for: provider) != nil
    }

    private static func directAPIKeyEnvironmentKey(for provider: UsageProvider) -> String? {
        switch provider {
        case .claude:
            ClaudeAdminAPISettingsReader.adminAPIKeyEnvironmentKey
        case .codex, .cursor, .gemini:
            nil
        }
    }

    public static func applyProviderConfigOverrides(
        base: [String: String],
        provider: UsageProvider,
        config: ProviderConfig?) -> [String: String]
    {
        self.applyAPIKeyOverride(base: base, provider: provider, config: config)
    }
}
