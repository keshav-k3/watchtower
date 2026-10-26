//! Writes the widget snapshot and asks WidgetKit to reload.
//!
//! The Swift bridge (`libWatchtowerWidgetBridge.dylib`) is built on a Mac and
//! loaded from the app bundle. Without it, the JSON is still written and the
//! widget picks it up on its own timeline.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;

use time::OffsetDateTime;

use crate::plugin_engine::host_api::redact_log_message;
use crate::plugin_engine::manifest::LoadedPlugin;
use crate::plugin_engine::runtime::PluginOutput;
use crate::widget_snapshot::{self, SNAPSHOT_FILE_NAME, SnapshotStore};
#[cfg(target_os = "macos")]
use crate::widget_snapshot::{APP_GROUP_ID, WIDGET_EXTENSION_BUNDLE_ID};

fn store() -> &'static Mutex<SnapshotStore> {
    static STORE: OnceLock<Mutex<SnapshotStore>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(SnapshotStore::new()))
}

fn lock() -> std::sync::MutexGuard<'static, SnapshotStore> {
    store().lock().unwrap_or_else(|poisoned| {
        log::error!("widget snapshot lock poisoned; recovering the last document");
        poisoned.into_inner()
    })
}

fn last_reload() -> &'static Mutex<Option<Instant>> {
    static LAST: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();
    LAST.get_or_init(|| Mutex::new(None))
}

pub fn init(app_data_dir: &Path, plugins: &[LoadedPlugin]) {
    let seeds: Vec<_> = plugins
        .iter()
        .map(widget_snapshot::seed_from_plugin)
        .collect();
    let mut guard = lock();
    let path = app_data_dir.join(SNAPSHOT_FILE_NAME);
    match std::fs::read_to_string(&path) {
        Ok(text) => {
            if let Err(error) = guard.load_file_contents(&text) {
                log::warn!("{error}; starting a fresh widget snapshot");
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            log::error!(
                "failed to read widget snapshot: {}",
                redact_log_message(&error.to_string())
            );
        }
    }
    guard.seed(&seeds);
}

pub fn record_probe(app_data_dir: &Path, plugin: &LoadedPlugin, output: &PluginOutput) {
    let seed = widget_snapshot::seed_from_plugin(plugin);
    // Probes run on several workers. Write while holding the lock so two
    // writers never race on the temp file and the newest document lands last.
    let mut guard = lock();
    guard.record_output(&seed, output, OffsetDateTime::now_utc());
    let json = match guard.to_json() {
        Ok(json) => json,
        Err(error) => {
            log::error!("{error}");
            return;
        }
    };
    if let Err(error) = write_snapshot_files(&json, &destinations(app_data_dir)) {
        log::error!(
            "widget snapshot write failed: {}",
            redact_log_message(&error)
        );
    }
}

pub fn record_failure(app_data_dir: &Path, provider_id: &str, provider_name: &str) {
    // Probes run on several workers. Write while holding the lock so two
    // writers never race on the temp file and the newest document lands last.
    let mut guard = lock();
    guard.record_failure(provider_id, provider_name, OffsetDateTime::now_utc());
    let json = match guard.to_json() {
        Ok(json) => json,
        Err(error) => {
            log::error!("{error}");
            return;
        }
    };
    if let Err(error) = write_snapshot_files(&json, &destinations(app_data_dir)) {
        log::error!(
            "widget snapshot write failed: {}",
            redact_log_message(&error)
        );
    }
}

/// Ask WidgetKit to redraw. Skipped when the last request was inside the quiet period.
pub fn reload_timelines() {
    let now = Instant::now();
    let due = {
        let last = last_reload().lock().unwrap_or_else(|poisoned| {
            log::error!("widget reload clock poisoned; recovering");
            poisoned.into_inner()
        });
        widget_snapshot::should_reload(*last, now)
    };
    if !due {
        log::debug!("widget reload skipped until the quiet period ends");
        return;
    }

    let json = match lock().to_json() {
        Ok(json) => json,
        Err(error) => {
            log::error!("{error}");
            return;
        }
    };

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (json, now);
        log::debug!("widget timeline reload is macOS-only");
        return;
    }

    #[cfg(target_os = "macos")]
    match request_reload(&json) {
        Ok(0) => {
            store_reload_time(now);
            log::info!("widget timelines reloaded");
        }
        Ok(code) => {
            store_reload_time(now);
            log::error!(
                "widget bridge could not write the App Group snapshot (code {code}); reload was still requested"
            );
        }
        Err(error) => {
            log::error!(
                "widget timeline reload failed: {}",
                redact_log_message(&error)
            );
        }
    }
}

#[cfg(target_os = "macos")]
fn store_reload_time(now: Instant) {
    let mut last = last_reload().lock().unwrap_or_else(|poisoned| {
        log::error!("widget reload clock poisoned; recovering");
        poisoned.into_inner()
    });
    *last = Some(now);
}

pub fn write_snapshot_files(json: &str, destinations: &[PathBuf]) -> Result<(), String> {
    if destinations.is_empty() {
        return Err("no widget snapshot destinations".to_string());
    }
    static WRITE: Mutex<()> = Mutex::new(());
    let _write = WRITE.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let mut first_error = None;
    for dir in destinations {
        if let Err(error) = write_atomic(dir, json.as_bytes()) {
            log::error!("{}", redact_log_message(&error));
            if first_error.is_none() {
                first_error = Some(error);
            }
        }
    }
    match first_error {
        Some(error) => Err(error),
        None => Ok(()),
    }
}

fn destinations(app_data_dir: &Path) -> Vec<PathBuf> {
    let mut dirs = vec![app_data_dir.to_path_buf()];
    dirs.extend(shared_container_dirs());
    dirs
}

#[cfg(target_os = "macos")]
fn shared_container_dirs() -> Vec<PathBuf> {
    let Some(home) = dirs::home_dir() else {
        log::error!("widget snapshot could not find the home directory");
        return Vec::new();
    };
    vec![
        home.join("Library/Group Containers").join(APP_GROUP_ID),
        home.join("Library/Containers")
            .join(WIDGET_EXTENSION_BUNDLE_ID)
            .join("Data"),
    ]
}

#[cfg(not(target_os = "macos"))]
fn shared_container_dirs() -> Vec<PathBuf> {
    Vec::new()
}

fn write_atomic(dir: &Path, bytes: &[u8]) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|error| {
        format!(
            "failed to create widget snapshot directory {}: {error}",
            dir.display()
        )
    })?;
    let dest = dir.join(SNAPSHOT_FILE_NAME);
    // A name of our own: the Swift bridge writes `.widget-snapshot.json.tmp`
    // in the App Group folder at the same time.
    let tmp = dir.join(format!(".widget-snapshot.{}.tmp", std::process::id()));
    write_private(&tmp, bytes).map_err(|error| {
        let _ = std::fs::remove_file(&tmp);
        format!(
            "failed to write widget snapshot temp file {}: {error}",
            tmp.display()
        )
    })?;
    std::fs::rename(&tmp, &dest).map_err(|error| {
        let _ = std::fs::remove_file(&tmp);
        format!(
            "failed to replace widget snapshot {}: {error}",
            dest.display()
        )
    })?;
    Ok(())
}

/// Usage numbers are private to the user: owner read/write only.
fn write_private(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(std::fs::Permissions::from_mode(0o600))?;
    }
    file.write_all(bytes)?;
    file.sync_all()
}

#[cfg(target_os = "macos")]
fn request_reload(json: &str) -> Result<i32, String> {
    bridge_write_and_reload(json)
}

#[cfg(target_os = "macos")]
struct WidgetBridge {
    _handle: *mut std::ffi::c_void,
    write_and_reload: unsafe extern "C" fn(*const libc::c_char) -> libc::c_int,
}

// The dylib stays loaded for the process. The C function does not borrow Rust memory.
#[cfg(target_os = "macos")]
unsafe impl Send for WidgetBridge {}
#[cfg(target_os = "macos")]
unsafe impl Sync for WidgetBridge {}

#[cfg(target_os = "macos")]
fn bridge_write_and_reload(json: &str) -> Result<i32, String> {
    use std::ffi::CString;

    static BRIDGE: OnceLock<WidgetBridge> = OnceLock::new();

    if BRIDGE.get().is_none() {
        let loaded = load_bridge()?;
        let _ = BRIDGE.set(loaded);
    }
    let Some(bridge) = BRIDGE.get() else {
        return Err("widget bridge failed to stay loaded".to_string());
    };

    let cjson =
        CString::new(json).map_err(|_| "widget snapshot contained a null byte".to_string())?;
    let code = unsafe { (bridge.write_and_reload)(cjson.as_ptr()) };
    Ok(code)
}

#[cfg(target_os = "macos")]
fn load_bridge() -> Result<WidgetBridge, String> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let path = bridge_library_path()?;
    let c_path = CString::new(path.as_os_str().as_bytes())
        .map_err(|_| "widget bridge path contains a null byte".to_string())?;
    let handle = unsafe { libc::dlopen(c_path.as_ptr(), libc::RTLD_NOW) };
    if handle.is_null() {
        return Err(dl_error("widget bridge failed to load"));
    }

    let symbol = CString::new("watchtower_widget_write_and_reload").expect("symbol is static");
    let raw = unsafe { libc::dlsym(handle, symbol.as_ptr()) };
    if raw.is_null() {
        return Err(dl_error(
            "widget bridge is missing watchtower_widget_write_and_reload",
        ));
    }

    let write_and_reload = unsafe {
        std::mem::transmute::<
            *mut std::ffi::c_void,
            unsafe extern "C" fn(*const libc::c_char) -> libc::c_int,
        >(raw)
    };
    Ok(WidgetBridge {
        _handle: handle,
        write_and_reload,
    })
}

#[cfg(target_os = "macos")]
fn bridge_library_path() -> Result<PathBuf, String> {
    if let Some(path) = std::env::var_os("WATCHTOWER_WIDGET_BRIDGE") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return Ok(path);
        }
        return Err(format!(
            "WATCHTOWER_WIDGET_BRIDGE is not a file: {}",
            path.display()
        ));
    }

    let exe = std::env::current_exe().map_err(|error| format!("current exe: {error}"))?;
    let Some(dir) = exe.parent() else {
        return Err("widget bridge: executable has no directory".to_string());
    };
    let candidates = [
        dir.join("../Frameworks/libWatchtowerWidgetBridge.dylib"),
        dir.join("libWatchtowerWidgetBridge.dylib"),
    ];
    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| "widget bridge library was not found in the app bundle".to_string())
}

#[cfg(test)]
mod tests {
    use super::write_snapshot_files;
    use crate::widget_snapshot::SNAPSHOT_FILE_NAME;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn atomic_write_reaches_every_directory_and_removes_the_temp_file() {
        let root = std::env::temp_dir().join(format!(
            "watchtower-widget-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let good = root.join("good");
        let blocked = root.join("blocked");
        fs::create_dir_all(&root).unwrap();
        fs::write(&blocked, b"not a directory").unwrap();

        let json = "{\"version\":1}\n";
        let error = write_snapshot_files(json, &[blocked, good.clone()]).unwrap_err();
        assert!(error.contains("widget snapshot"));
        assert_eq!(
            fs::read_to_string(good.join(SNAPSHOT_FILE_NAME)).unwrap(),
            json
        );
        let leftovers: Vec<_> = fs::read_dir(&good)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(good.join(SNAPSHOT_FILE_NAME))
                .unwrap()
                .permissions()
                .mode();
            assert_eq!(mode & 0o777, 0o600);
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn concurrent_writers_always_leave_a_whole_document() {
        let root = std::env::temp_dir().join(format!(
            "watchtower-widget-race-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let handles: Vec<_> = (0..8)
            .map(|index| {
                let dir = root.clone();
                std::thread::spawn(move || {
                    let body = format!("{{\"writer\":{index},\"pad\":\"{}\"}}", "x".repeat(index * 4096));
                    for _ in 0..25 {
                        write_snapshot_files(&body, &[dir.clone()]).unwrap();
                    }
                })
            })
            .collect();
        for handle in handles {
            handle.join().unwrap();
        }
        let text = fs::read_to_string(root.join(SNAPSHOT_FILE_NAME)).unwrap();
        let value: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert!(value.get("writer").is_some());
        let _ = fs::remove_dir_all(root);
    }
}

#[cfg(target_os = "macos")]
fn dl_error(prefix: &str) -> String {
    let detail = unsafe {
        let err = libc::dlerror();
        if err.is_null() {
            String::new()
        } else {
            std::ffi::CStr::from_ptr(err).to_string_lossy().into_owned()
        }
    };
    if detail.is_empty() {
        prefix.to_string()
    } else {
        format!("{prefix}: {detail}")
    }
}
