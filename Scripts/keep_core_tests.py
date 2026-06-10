#!/usr/bin/env python3
"""Keep only Watchtower-relevant tests for Codex, Claude, Cursor, Gemini."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TESTS = ROOT / "Tests/CodexBarTests"

KEEP = {
    "ResetTimeBackfillTests.swift",
    "ProviderRegistryTests.swift",
    "SettingsStoreTests.swift",
    "CodexbarTests.swift",
    "ClaudeUsageTests.swift",
    "ClaudePlanResolverTests.swift",
    "ClaudeAdminAPIUsageTests.swift",
    "ClaudeOAuthTests.swift",
    "CursorMenuCardModelTests.swift",
    "CursorStatusProbeTests.swift",
    "CursorLoginRunnerTests.swift",
    "GeminiMenuCardTests.swift",
    "GeminiStatusProbeTests.swift",
    "GeminiSourceLabelTests.swift",
    "GeminiTestEnvironment.swift",
    "GeminiStatusProbePlanTests.swift",
    "GeminiStatusProbeAPITests.swift",
    "GeminiLoginAlertTests.swift",
    "MenuCardModelTests.swift",
    "MenuCardSubtitleTests.swift",
    "MenuCardQuotaWarningMarkerTests.swift",
    "UsageFormatterTests.swift",
    "UsagePaceTests.swift",
    "UsagePaceTextTests.swift",
    "TextParsingTests.swift",
    "KeychainNoUIQueryTests.swift",
    "CodexPlanFormattingTests.swift",
    "ProviderSettingsDescriptorTests.swift",
    "MenuBarMetricWindowResolverTests.swift",
    "CodexOAuthTests.swift",
    "CodexUsageFetcherFallbackTests.swift",
    "CodexCLILaunchGateTests.swift",
    "CodexLoginRunnerTests.swift",
    "TestStores.swift",
    "LocalizationBundleTests.swift",
    "InstallOriginTests.swift",
    "ProviderHTTPClientTests.swift",
    "SubprocessRunnerTests.swift",
    "ProviderToggleStoreTests.swift",
    "QuotaWarningNotificationLogicTests.swift",
    "SessionQuotaNotificationLogicTests.swift",
    "LoginNotificationLogicTests.swift",
    "PathBuilderTests.swift",
    "LoadingPatternTests.swift",
    "ProviderHTTPTransportStub.swift",
    "ClaudeSourcePlannerTests.swift",
    "ClaudeCredentialRoutingTests.swift",
    "CursorEnterpriseUsageTests.swift",
    "MenuCardModelCodexProjectionTests.swift",
    "CodexConsumerProjectionTests.swift",
}


def main() -> None:
    removed = 0
    for path in sorted(TESTS.glob("*.swift")):
        if path.name not in KEEP:
            path.unlink()
            print(f"deleted {path.name}")
            removed += 1
    print(f"kept {len(KEEP)} files, removed {removed}")


if __name__ == "__main__":
    main()
