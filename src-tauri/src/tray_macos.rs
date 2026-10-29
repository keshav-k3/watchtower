//! macOS tray menu ownership.
//!
//! tray-icon 0.24.2 assigns the menu with `NSStatusItem.setMenu` as soon as
//! the icon is created. AppKit then opens that menu on a left click, and
//! `show_menu_on_left_click(false)` only skips an extra `performClick`.
//! Detach the menu after creation and put it back for a right click only.

use std::sync::atomic::{AtomicUsize, Ordering};

use objc2::msg_send;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;

static STATUS_ITEM: AtomicUsize = AtomicUsize::new(0);
static MENU: AtomicUsize = AtomicUsize::new(0);

pub fn capture(inner: &tray_icon::TrayIcon) {
    inner.set_show_menu_on_right_click(false);
    let Some(item) = inner.ns_status_item() else {
        log::warn!("macOS tray status item was not available");
        return;
    };

    STATUS_ITEM.store(Retained::as_ptr(&item) as usize, Ordering::SeqCst);

    unsafe {
        let menu: *mut AnyObject = msg_send![&*item, menu];
        if !menu.is_null() {
            if let Some(retained) = Retained::<AnyObject>::retain(menu) {
                std::mem::forget(retained);
            }
            MENU.store(menu as usize, Ordering::SeqCst);
            let _: () = msg_send![&*item, setMenu: std::ptr::null::<AnyObject>()];
        }
    }
}

pub fn show_tray_menu() {
    let item = STATUS_ITEM.load(Ordering::SeqCst) as *mut AnyObject;
    let menu = MENU.load(Ordering::SeqCst) as *mut AnyObject;
    if item.is_null() || menu.is_null() {
        log::warn!("macOS tray menu is not available for a right click");
        return;
    }

    unsafe {
        let _: () = msg_send![item, setMenu: menu];
        let button: *mut AnyObject = msg_send![item, button];
        if !button.is_null() {
            let _: () = msg_send![button, performClick: std::ptr::null::<AnyObject>()];
        }
        let _: () = msg_send![item, setMenu: std::ptr::null::<AnyObject>()];
    }
}
