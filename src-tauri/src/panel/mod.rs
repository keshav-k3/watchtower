#[cfg(target_os = "macos")]
mod macos;
#[cfg(not(target_os = "macos"))]
mod desktop;

#[cfg(target_os = "macos")]
pub use macos::*;
#[cfg(not(target_os = "macos"))]
pub use desktop::*;

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter};

static PANEL_VISIBLE: AtomicBool = AtomicBool::new(false);

pub fn panel_is_visible() -> bool {
    PANEL_VISIBLE.load(Ordering::Relaxed)
}

pub fn note_panel_visibility(app: &AppHandle, visible: bool) {
    let previous = PANEL_VISIBLE.swap(visible, Ordering::Relaxed);
    if previous != visible {
        let _ = app.emit("panel:visibility", visible);
    }
}
