use tauri::{AppHandle, Manager, PhysicalPosition, Position, Size};

const MAIN: &str = "main";
const MARGIN_LOGICAL: f64 = 16.0;

fn main_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    app.get_webview_window(MAIN)
}

pub fn init(app_handle: &AppHandle) -> tauri::Result<()> {
    let Some(window) = main_window(app_handle) else {
        return Ok(());
    };
    // Transparent windows can be fully invisible on Linux compositors without
    // proper alpha support. Force an opaque black backdrop for the panel shell.
    let _ = window.set_background_color(Some("#000000".parse().expect("valid color")));
    if std::env::var_os("WATCHTOWER_KEEP_VISIBLE").is_some() {
        // Recording / Linux demo path: keep the panel visible and centered so
        // screen capture can see the panel contents reliably.
        let _ = window.set_ignore_cursor_events(false);
        let _ = position_center(&window);
        let _ = window.set_always_on_top(true);
    } else {
        position_top_right(&window)?;
    }
    window.show()?;
    window.set_focus()?;
    Ok(())
}

pub fn show_panel(app_handle: &AppHandle) {
    let Some(window) = main_window(app_handle) else {
        return;
    };
    if std::env::var_os("WATCHTOWER_KEEP_VISIBLE").is_some() {
        let _ = position_center(&window);
        let _ = window.set_always_on_top(true);
    } else {
        let _ = position_top_right(&window);
    }
    let _ = window.show();
    let _ = window.set_focus();
}

pub fn hide_panel(app_handle: &AppHandle) {
    if std::env::var_os("WATCHTOWER_KEEP_VISIBLE").is_some() {
        return;
    }
    if let Some(window) = main_window(app_handle) {
        let _ = window.hide();
    }
}

pub fn toggle_panel(app_handle: &AppHandle) {
    let Some(window) = main_window(app_handle) else {
        return;
    };
    match window.is_visible() {
        Ok(true) => {
            let _ = window.hide();
        }
        _ => show_panel(app_handle),
    }
}

pub fn handle_tray_click(app_handle: &AppHandle, icon_position: Position, icon_size: Size) {
    let Some(window) = main_window(app_handle) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    let _ = window.show();
    position_panel_at_tray_icon(app_handle, icon_position, icon_size);
    let _ = window.set_focus();
}

pub fn position_panel_at_tray_icon(
    app_handle: &AppHandle,
    icon_position: Position,
    icon_size: Size,
) {
    let Some(window) = main_window(app_handle) else {
        return;
    };

    let (icon_phys_x, icon_phys_y) = match &icon_position {
        Position::Physical(pos) => (pos.x as f64, pos.y as f64),
        Position::Logical(pos) => (pos.x, pos.y),
    };
    let (icon_phys_w, icon_phys_h) = match &icon_size {
        Size::Physical(s) => (s.width as f64, s.height as f64),
        Size::Logical(s) => (s.width, s.height),
    };

    let Ok(monitors) = window.available_monitors() else {
        let _ = position_top_right(&window);
        return;
    };

    let icon_center_x = icon_phys_x + (icon_phys_w / 2.0);
    let icon_center_y = icon_phys_y + (icon_phys_h / 2.0);

    let found_monitor = monitors.iter().find(|monitor| {
        let origin = monitor.position();
        let size = monitor.size();
        icon_center_x >= origin.x as f64
            && icon_center_x < origin.x as f64 + size.width as f64
            && icon_center_y >= origin.y as f64
            && icon_center_y < origin.y as f64 + size.height as f64
    });

    let monitor = match found_monitor {
        Some(m) => m.clone(),
        None => match window.primary_monitor() {
            Ok(Some(m)) => m,
            _ => {
                let _ = position_top_right(&window);
                return;
            }
        },
    };

    let target_scale = monitor.scale_factor();
    let mon_phys_x = monitor.position().x as f64;
    let mon_phys_y = monitor.position().y as f64;
    let mon_logical_x = mon_phys_x / target_scale;
    let mon_logical_y = mon_phys_y / target_scale;

    let icon_logical_x = mon_logical_x + (icon_phys_x - mon_phys_x) / target_scale;
    let icon_logical_y = mon_logical_y + (icon_phys_y - mon_phys_y) / target_scale;
    let icon_logical_w = icon_phys_w / target_scale;
    let icon_logical_h = icon_phys_h / target_scale;

    let panel_width = match (window.outer_size(), window.scale_factor()) {
        (Ok(s), Ok(win_scale)) => s.width as f64 / win_scale,
        _ => 400.0,
    };

    let icon_center_logical_x = icon_logical_x + (icon_logical_w / 2.0);
    let panel_x = icon_center_logical_x - (panel_width / 2.0);
    let nudge_up: f64 = 6.0;
    let panel_y = (icon_logical_y + icon_logical_h - nudge_up).max(mon_logical_y);

    let x_phys = (panel_x * target_scale).round() as i32;
    let y_phys = (panel_y * target_scale).round() as i32;
    let _ = window.set_position(PhysicalPosition::new(x_phys, y_phys));
}

fn position_top_right(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.primary_monitor()? else {
        return Ok(());
    };
    let scale = monitor.scale_factor();
    let origin = monitor.position();
    let size = monitor.size();
    let (w, _h) = window
        .outer_size()
        .map(|s| (s.width as i32, s.height as i32))
        .unwrap_or((400, 500));
    let margin = (MARGIN_LOGICAL * scale).round() as i32;
    let x = origin.x + size.width as i32 - w - margin;
    let y = origin.y + margin;
    window.set_position(PhysicalPosition::new(x, y))
}

fn position_center(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.primary_monitor()? else {
        return Ok(());
    };
    let origin = monitor.position();
    let size = monitor.size();
    let (w, h) = window
        .outer_size()
        .map(|s| (s.width as i32, s.height as i32))
        .unwrap_or((400, 500));
    let x = origin.x + (size.width as i32 - w) / 2;
    let y = origin.y + (size.height as i32 - h) / 2;
    window.set_position(PhysicalPosition::new(x, y))
}
