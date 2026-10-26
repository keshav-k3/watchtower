use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::path::BaseDirectory;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

use crate::panel::{handle_tray_click, show_panel};
use crate::tray_click::{
    tray_click_intent, uses_manual_tray_menu, TrayButton, TrayButtonState, TrayClickIntent,
};

const LOG_LEVEL_STORE_KEY: &str = "logLevel";

fn get_stored_log_level(app_handle: &AppHandle) -> log::LevelFilter {
    let store = match app_handle.store("settings.json") {
        Ok(s) => s,
        Err(_) => return log::LevelFilter::Error,
    };
    let value = store.get(LOG_LEVEL_STORE_KEY);
    let level_str = value.and_then(|v| v.as_str().map(|s| s.to_string()));
    match level_str.as_deref() {
        Some("error") => log::LevelFilter::Error,
        Some("warn") => log::LevelFilter::Warn,
        Some("info") => log::LevelFilter::Info,
        Some("debug") => log::LevelFilter::Debug,
        Some("trace") => log::LevelFilter::Trace,
        _ => log::LevelFilter::Error, // Default: least verbose
    }
}

fn map_button(button: MouseButton) -> TrayButton {
    match button {
        MouseButton::Left => TrayButton::Left,
        MouseButton::Right => TrayButton::Right,
        _ => TrayButton::Other,
    }
}

fn map_state(state: MouseButtonState) -> TrayButtonState {
    match state {
        MouseButtonState::Down => TrayButtonState::Down,
        MouseButtonState::Up => TrayButtonState::Up,
    }
}

pub fn create(app_handle: &AppHandle) -> tauri::Result<()> {
    let tray_icon_path = app_handle
        .path()
        .resolve("icons/tray-icon.png", BaseDirectory::Resource)?;
    let icon = Image::from_path(tray_icon_path)?;

    // Load persisted log level
    let current_level = get_stored_log_level(app_handle);
    log::set_max_level(current_level);

    let show_stats = MenuItem::with_id(app_handle, "show_stats", "Show Stats", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app_handle)?;
    let about = MenuItem::with_id(app_handle, "about", "About Watchtower", true, None::<&str>)?;
    let quit = MenuItem::with_id(app_handle, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app_handle, &[&show_stats, &separator, &about, &quit])?;

    let tray = TrayIconBuilder::with_id("tray")
        .icon(icon)
        .icon_as_template(true)
        .tooltip("Watchtower")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app_handle, event| {
            log::debug!("tray menu: {}", event.id.as_ref());
            match event.id.as_ref() {
                "show_stats" => {
                    show_panel(app_handle);
                    let _ = app_handle.emit("tray:navigate", "home");
                }
                "about" => {
                    show_panel(app_handle);
                    let _ = app_handle.emit("tray:show-about", ());
                }
                "quit" => {
                    log::info!("quit requested via tray");
                    app_handle.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            let TrayIconEvent::Click {
                button,
                button_state,
                rect,
                ..
            } = event
            else {
                return;
            };

            let intent = tray_click_intent(
                map_button(button),
                map_state(button_state),
                uses_manual_tray_menu(),
            );
            log::debug!("tray click intent: {:?}", intent);
            match intent {
                TrayClickIntent::ShowPanel => {
                    handle_tray_click(tray.app_handle(), rect.position, rect.size);
                }
                TrayClickIntent::ShowMenu => {
                    #[cfg(target_os = "macos")]
                    crate::tray_macos::show_tray_menu();
                }
                TrayClickIntent::Ignore => {}
            }
        })
        .build(app_handle)?;

    #[cfg(target_os = "macos")]
    {
        if let Err(error) = tray.with_inner_tray_icon(|inner| {
            crate::tray_macos::capture(inner);
        }) {
            log::error!("failed to detach the macOS tray menu from left click: {}", error);
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = tray;
    }

    Ok(())
}
