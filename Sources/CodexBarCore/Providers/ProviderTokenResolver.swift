import Foundation

public enum ProviderTokenSource: String, Sendable {
    case environment
    case authFile
}

public struct ProviderTokenResolution: Sendable {
    public let token: String
    public let source: ProviderTokenSource

    public init(token: String, source: ProviderTokenSource) {
        self.token = token
        self.source = source
    }
}

public enum ProviderTokenResolver {
    public static func claudeAdminAPIToken(
        environment: [String: String] = ProcessInfo.processInfo.environment) -> String?
    {
        self.claudeAdminAPIResolution(environment: environment)?.token
    }

    public static func claudeAdminAPIResolution(
        environment: [String: String] = ProcessInfo.processInfo.environment) -> ProviderTokenResolution?
    {
        self.resolveEnv(ClaudeAdminAPISettingsReader.apiKey(environment: environment))
    }

    private static func resolveEnv(_ token: String?) -> ProviderTokenResolution? {
        guard let token else { return nil }
        return ProviderTokenResolution(token: token, source: .environment)
    }
}
