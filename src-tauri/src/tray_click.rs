//! Decides what a tray click should do.
//!
//! macOS AppKit opens an `NSStatusItem` menu on left click whenever the menu
//! is attached. Watchtower therefore keeps the menu detached on macOS and
//! opens it only for a right click. Windows and Linux already show the menu
//! on right click when `show_menu_on_left_click` is false, so a right click
//! there must not open a second menu.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayButton {
    Left,
    Right,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayButtonState {
    Down,
    Up,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayClickIntent {
    ShowPanel,
    ShowMenu,
    Ignore,
}

/// `manual_menu` is true only on macOS, where the app has to open the menu
/// itself. On Windows and Linux the system opens it.
pub fn tray_click_intent(
    button: TrayButton,
    state: TrayButtonState,
    manual_menu: bool,
) -> TrayClickIntent {
    match (button, state, manual_menu) {
        (TrayButton::Left, TrayButtonState::Up, _) => TrayClickIntent::ShowPanel,
        (TrayButton::Right, TrayButtonState::Down, true) => TrayClickIntent::ShowMenu,
        _ => TrayClickIntent::Ignore,
    }
}

pub fn uses_manual_tray_menu() -> bool {
    cfg!(target_os = "macos")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn left_release_opens_the_panel() {
        assert_eq!(
            tray_click_intent(TrayButton::Left, TrayButtonState::Up, true),
            TrayClickIntent::ShowPanel
        );
        assert_eq!(
            tray_click_intent(TrayButton::Left, TrayButtonState::Up, false),
            TrayClickIntent::ShowPanel
        );
    }

    #[test]
    fn left_press_does_not_toggle_the_panel() {
        assert_eq!(
            tray_click_intent(TrayButton::Left, TrayButtonState::Down, true),
            TrayClickIntent::Ignore
        );
    }

    #[test]
    fn right_press_opens_the_menu_only_when_the_app_owns_it() {
        assert_eq!(
            tray_click_intent(TrayButton::Right, TrayButtonState::Down, true),
            TrayClickIntent::ShowMenu
        );
        assert_eq!(
            tray_click_intent(TrayButton::Right, TrayButtonState::Down, false),
            TrayClickIntent::Ignore
        );
    }

    #[test]
    fn right_release_does_not_open_the_panel() {
        assert_eq!(
            tray_click_intent(TrayButton::Right, TrayButtonState::Up, true),
            TrayClickIntent::Ignore
        );
        assert_eq!(
            tray_click_intent(TrayButton::Right, TrayButtonState::Up, false),
            TrayClickIntent::Ignore
        );
    }

    #[test]
    fn other_buttons_are_ignored() {
        assert_eq!(
            tray_click_intent(TrayButton::Other, TrayButtonState::Up, true),
            TrayClickIntent::Ignore
        );
    }

    #[test]
    fn manual_menu_matches_the_platform() {
        assert_eq!(uses_manual_tray_menu(), cfg!(target_os = "macos"));
    }
}
