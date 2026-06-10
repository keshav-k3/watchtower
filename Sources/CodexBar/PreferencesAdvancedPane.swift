import SwiftUI

@MainActor
struct AdvancedPane: View {
    @Bindable var settings: SettingsStore

    var body: some View {
        ScrollView(.vertical, showsIndicators: true) {
            VStack(alignment: .leading, spacing: 16) {
                SettingsSection(contentSpacing: 10) {
                    PreferenceToggleRow(
                        title: L("show_debug_settings_title"),
                        subtitle: L("show_debug_settings_subtitle"),
                        binding: self.$settings.debugMenuEnabled)
                    PreferenceToggleRow(
                        title: L("surprise_me_title"),
                        subtitle: L("surprise_me_subtitle"),
                        binding: self.$settings.randomBlinkEnabled)
                    PreferenceToggleRow(
                        title: L("weekly_limit_confetti_title"),
                        subtitle: L("weekly_limit_confetti_subtitle"),
                        binding: self.$settings.confettiOnWeeklyLimitResetsEnabled)
                }

                Divider()

                SettingsSection(contentSpacing: 10) {
                    PreferenceToggleRow(
                        title: L("hide_personal_info_title"),
                        subtitle: L("hide_personal_info_subtitle"),
                        binding: self.$settings.hidePersonalInfo)
                    PreferenceToggleRow(
                        title: L("show_provider_storage_usage_title"),
                        subtitle: L("show_provider_storage_usage_subtitle"),
                        binding: self.$settings.providerStorageFootprintsEnabled)
                }

                Divider()

                SettingsSection(
                    title: L("section_keychain_access"),
                    caption: L("keychain_access_caption"))
                {
                    PreferenceToggleRow(
                        title: L("disable_keychain_access_title"),
                        subtitle: L("disable_keychain_access_subtitle"),
                        binding: self.$settings.debugDisableKeychainAccess)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
    }
}
