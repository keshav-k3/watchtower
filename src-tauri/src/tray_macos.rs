//! macOS tray menu ownership.
//!
//! tray-icon 0.24 assigned the menu with `NSStatusItem.setMenu` as soon as
//! the icon was created. AppKit then opened that menu on a left click, and
//! `show_menu_on_left_click(false)` only skipped an extra `performClick`.
//! Detach the menu after creation and put it back for a right click only.
//!
//! tray-icon 0.25 attaches the menu only for the click that opens it, so
//! there is nothing to detach. Keep its own right-click menu in that case.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use objc2::msg_send;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;

static STATUS_ITEM: AtomicUsize = AtomicUsize::new(0);
static MENU: AtomicUsize = AtomicUsize::new(0);
static NATIVE_RIGHT_CLICK_MENU: AtomicBool = AtomicBool::new(false);

pub fn capture(inner: &tray_icon::TrayIcon) {
    let Some(item) = inner.ns_status_item() else {
        log::warn!("macOS tray status item was not available");
        return;
    };

    unsafe {
        let menu: *mut AnyObject = msg_send![&*item, menu];
        if menu.is_null() {
            NATIVE_RIGHT_CLICK_MENU.store(true, Ordering::SeqCst);
            return;
        }
    }

    inner.set_show_menu_on_right_click(false);
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
    if NATIVE_RIGHT_CLICK_MENU.load(Ordering::SeqCst) {
        return;
    }
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
