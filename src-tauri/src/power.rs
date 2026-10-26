use serde::Serialize;
#[cfg(target_os = "macos")]
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerStatus {
    pub on_battery: bool,
}

pub fn on_battery() -> bool {
    #[cfg(target_os = "linux")]
    {
        linux_on_battery()
    }
    #[cfg(target_os = "macos")]
    {
        macos_on_battery_cached()
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        false
    }
}

pub(crate) fn status_is_discharging(status: &str) -> bool {
    status.trim().eq_ignore_ascii_case("Discharging")
}

#[cfg_attr(not(any(test, target_os = "macos")), allow(dead_code))]
pub(crate) fn on_battery_from_pmset(output: &str) -> bool {
    let lower = output.to_ascii_lowercase();
    lower.contains("now drawing from 'battery power'")
        || lower.contains("now drawing from \"battery power\"")
        || lower.contains("; discharging")
}

#[cfg(target_os = "linux")]
fn linux_on_battery() -> bool {
    let Ok(entries) = std::fs::read_dir("/sys/class/power_supply") else {
        return false;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(kind) = std::fs::read_to_string(path.join("type")) else {
            continue;
        };
        if !kind.to_ascii_lowercase().contains("battery") {
            continue;
        }
        let Ok(status) = std::fs::read_to_string(path.join("status")) else {
            continue;
        };
        if status_is_discharging(&status) {
            return true;
        }
    }
    false
}

#[cfg(target_os = "macos")]
fn macos_on_battery_cached() -> bool {
    static CACHE: Mutex<Option<(Instant, bool)>> = Mutex::new(None);
    let mut cache = CACHE.lock().unwrap_or_else(|err| err.into_inner());
    if let Some((checked_at, on_battery)) = *cache {
        if checked_at.elapsed() < Duration::from_secs(30) {
            return on_battery;
        }
    }
    let on_battery = macos_on_battery_now();
    *cache = Some((Instant::now(), on_battery));
    on_battery
}

#[cfg(target_os = "macos")]
fn macos_on_battery_now() -> bool {
    let output = std::process::Command::new("pmset")
        .args(["-g", "batt"])
        .output();
    let Ok(output) = output else {
        return false;
    };
    if !output.status.success() {
        return false;
    }
    on_battery_from_pmset(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(test)]
mod tests {
    use super::{on_battery_from_pmset, status_is_discharging};

    #[test]
    fn discharging_status_matches_sysfs() {
        assert!(status_is_discharging("Discharging\n"));
        assert!(status_is_discharging(" discharging "));
        assert!(!status_is_discharging("Charging"));
        assert!(!status_is_discharging("Full"));
        assert!(!status_is_discharging("Not charging"));
    }

    #[test]
    fn pmset_output_detects_battery_power() {
        let battery = "Now drawing from 'Battery Power'\n -InternalBattery-0 80%; discharging; 3:00 remaining";
        let ac = "Now drawing from 'AC Power'\n -InternalBattery-0 100%; charged; 0:00 remaining present: true";
        assert!(on_battery_from_pmset(battery));
        assert!(!on_battery_from_pmset(ac));
        assert!(on_battery_from_pmset("InternalBattery 40%; discharging"));
    }
}
