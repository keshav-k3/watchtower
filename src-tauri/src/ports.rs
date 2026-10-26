//! Listening TCP ports and a confirmed stop action.
//!
//! macOS and Linux use `lsof`. The working directory comes from `lsof -d cwd`
//! on macOS and from `/proc/<pid>/cwd` on Linux. Windows gets an empty list
//! and a note instead of a fake result.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawListener {
    pub command: String,
    pub pid: u32,
    pub user: String,
    pub port: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessInfo {
    pub uid: u32,
    pub user: String,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListeningPort {
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
    pub user: String,
    pub cwd: Option<String>,
    pub project: Option<String>,
    pub system: bool,
    pub self_process: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListeningPortsResponse {
    pub supported: bool,
    pub note: Option<String>,
    pub ports: Vec<ListeningPort>,
}

pub fn parse_listen_line(line: &str) -> Option<RawListener> {
    let line = line.trim();
    if line.is_empty() || line.starts_with("COMMAND") || !line.contains("(LISTEN)") {
        return None;
    }
    let port = port_from_listen_line(line)?;
    let mut parts = line.split_whitespace();
    let command = parts.next()?.to_string();
    let pid = parts.next()?.parse().ok()?;
    let user = parts.next()?.to_string();
    Some(RawListener {
        command,
        pid,
        user,
        port,
    })
}

fn port_from_listen_line(line: &str) -> Option<u16> {
    for token in line.split_whitespace().rev() {
        let token = token.trim_matches(|c| c == '(' || c == ')');
        let Some((_, port)) = token.rsplit_once(':') else {
            continue;
        };
        if let Ok(port) = port.parse::<u16>() {
            if port > 0 {
                return Some(port);
            }
        }
    }
    None
}

pub fn parse_ps_line(line: &str) -> Option<(u32, ProcessInfo)> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }
    let mut parts = line.split_whitespace();
    let pid = parts.next()?.parse().ok()?;
    let uid = parts.next()?.parse().ok()?;
    let user = parts.next()?.to_string();
    let command = parts.collect::<Vec<_>>().join(" ");
    if command.is_empty() {
        return None;
    }
    Some((
        pid,
        ProcessInfo {
            uid,
            user,
            command,
        },
    ))
}

pub fn parse_lsof_cwd(output: &str) -> Option<String> {
    for line in output.lines() {
        let Some(rest) = line.strip_prefix('n') else {
            continue;
        };
        let path = rest.trim();
        if path.starts_with('/') {
            return Some(path.to_string());
        }
    }
    None
}

pub fn is_system_process(user: &str, uid: u32, current_user: &str) -> bool {
    if uid == 0 || user == "root" {
        return true;
    }
    if !current_user.is_empty() && user == current_user {
        return false;
    }
    user.starts_with('_') || uid < 500
}

pub fn is_watchtower_process(pid: u32, name: &str, self_pid: u32) -> bool {
    if pid == self_pid {
        return true;
    }
    let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
    base.eq_ignore_ascii_case("watchtower")
}

pub fn stop_refusal(pid: u32, name: &str, self_pid: u32) -> Option<&'static str> {
    if pid <= 1 {
        return Some("That process is a system service and cannot be stopped from Watchtower.");
    }
    if is_watchtower_process(pid, name, self_pid) {
        Some("Watchtower cannot stop itself.")
    } else {
        None
    }
}

/// Watchtower never stops root or system-account processes, even if the
/// panel was bypassed. An unknown pid is refused too, because its owner
/// cannot be checked. A process owned by another account is refused as well.
pub fn system_refusal(
    info: Option<&ProcessInfo>,
    current_user: &str,
    current_uid: Option<u32>,
) -> Option<&'static str> {
    match info {
        None => Some("That process is no longer running or could not be checked."),
        Some(info) if is_system_process(&info.user, info.uid, current_user) => {
            Some("That process is a system service and cannot be stopped from Watchtower.")
        }
        Some(info) if current_uid.is_some_and(|uid| uid != info.uid) => {
            Some("That process belongs to another user and cannot be stopped from Watchtower.")
        }
        Some(_) => None,
    }
}

fn base_name(name: &str) -> &str {
    name.trim().rsplit(['/', '\\']).next().unwrap_or(name).trim()
}

/// The list can be a few seconds old. If the pid now runs a different
/// program, the original process exited and the pid was reused.
pub fn reuse_refusal(info: Option<&ProcessInfo>, expected: Option<&str>) -> Option<&'static str> {
    let (Some(info), Some(expected)) = (info, expected) else {
        return None;
    };
    if expected.trim().is_empty() || base_name(&info.command) == base_name(expected) {
        None
    } else {
        Some("That process has changed since the list was loaded. Refresh and try again.")
    }
}

#[cfg(unix)]
fn current_uid() -> Option<u32> {
    Some(unsafe { libc::getuid() })
}

#[cfg(not(unix))]
fn current_uid() -> Option<u32> {
    None
}

pub fn project_label(cwd: &Path) -> Option<String> {
    if let Some(name) = package_name(cwd) {
        return Some(name);
    }
    cwd.file_name()
        .and_then(|name| name.to_str())
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
}

fn package_name(cwd: &Path) -> Option<String> {
    let text = std::fs::read_to_string(cwd.join("package.json")).ok()?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;
    let name = value.get("name")?.as_str()?.trim();
    if name.is_empty() || name.len() > 80 || name.contains('\n') {
        return None;
    }
    Some(name.to_string())
}

pub fn assemble_ports(
    listeners: Vec<RawListener>,
    processes: &HashMap<u32, ProcessInfo>,
    cwd_for: impl Fn(u32) -> Option<String>,
    current_user: &str,
    self_pid: u32,
) -> Vec<ListeningPort> {
    let mut ports = Vec::new();
    let mut seen = std::collections::BTreeSet::new();
    for listener in listeners {
        if !seen.insert((listener.pid, listener.port)) {
            continue;
        }
        let process = processes.get(&listener.pid);
        let user = process
            .map(|info| info.user.clone())
            .unwrap_or(listener.user);
        let uid = process.map(|info| info.uid).unwrap_or(u32::MAX);
        let process_name = process
            .map(|info| info.command.clone())
            .filter(|name| !name.is_empty())
            .unwrap_or(listener.command);
        let cwd = cwd_for(listener.pid);
        let project = cwd.as_deref().and_then(|path| project_label(Path::new(path)));
        ports.push(ListeningPort {
            port: listener.port,
            pid: listener.pid,
            process_name: process_name.clone(),
            user: user.clone(),
            cwd,
            project,
            system: is_system_process(&user, uid, current_user),
            self_process: is_watchtower_process(listener.pid, &process_name, self_pid),
        });
    }
    ports.sort_by(|a, b| a.port.cmp(&b.port).then(a.pid.cmp(&b.pid)));
    ports
}

fn current_user() -> String {
    std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_default()
}

fn lsof_path() -> Option<PathBuf> {
    ["/usr/sbin/lsof", "/usr/bin/lsof", "/bin/lsof"]
        .into_iter()
        .map(PathBuf::from)
        .find(|path| path.exists())
}

fn command_stdout(program: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok()?;
    if !output.status.success() && output.stdout.is_empty() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).to_string())
}

fn ps_processes() -> HashMap<u32, ProcessInfo> {
    let output = Command::new("ps")
        .args(["-ax", "-o", "pid=,uid=,user=,comm="])
        .output();
    let Ok(output) = output else {
        return HashMap::new();
    };
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines().filter_map(parse_ps_line).collect()
}

fn cwd_for_pid(pid: u32) -> Option<String> {
    let proc_cwd = PathBuf::from(format!("/proc/{pid}/cwd"));
    if let Ok(path) = std::fs::read_link(&proc_cwd) {
        if path.is_absolute() {
            return Some(path.to_string_lossy().to_string());
        }
    }
    let lsof = lsof_path()?;
    let output = command_stdout(
        &lsof,
        &["-a", "-p", &pid.to_string(), "-d", "cwd", "-Fn"],
    )?;
    parse_lsof_cwd(&output)
}

pub fn collect_listening_ports() -> ListeningPortsResponse {
    #[cfg(target_os = "windows")]
    {
        return ListeningPortsResponse {
            supported: false,
            note: Some("Listening ports are available on macOS and Linux.".to_string()),
            ports: Vec::new(),
        };
    }
    #[cfg(not(target_os = "windows"))]
    collect_unix_ports()
}

#[cfg(not(target_os = "windows"))]
fn collect_unix_ports() -> ListeningPortsResponse {
    let Some(lsof) = lsof_path() else {
        log::error!("lsof was not found; listening ports cannot be listed");
        return ListeningPortsResponse {
            supported: false,
            note: Some("lsof is not installed, so Watchtower cannot list listening ports.".to_string()),
            ports: Vec::new(),
        };
    };

    let Some(text) = command_stdout(&lsof, &["-nP", "-iTCP", "-sTCP:LISTEN"]) else {
        log::error!("lsof failed while listing listening ports");
        return ListeningPortsResponse {
            supported: false,
            note: Some("lsof failed while listing listening ports.".to_string()),
            ports: Vec::new(),
        };
    };

    let listeners: Vec<RawListener> = text.lines().filter_map(parse_listen_line).collect();
    let processes = ps_processes();
    let self_pid = std::process::id();
    let user = current_user();
    ListeningPortsResponse {
        supported: true,
        note: None,
        ports: assemble_ports(listeners, &processes, cwd_for_pid, &user, self_pid),
    }
}

#[cfg(unix)]
pub fn signal_process(pid: u32, force: bool, expected: Option<&str>) -> Result<(), String> {
    let info = ps_processes().get(&pid).cloned();
    let name = info.as_ref().map(|info| info.command.clone()).unwrap_or_default();
    if let Some(reason) = stop_refusal(pid, &name, std::process::id())
        .or_else(|| system_refusal(info.as_ref(), &current_user(), current_uid()))
        .or_else(|| reuse_refusal(info.as_ref(), expected))
    {
        log::warn!("refusing to stop pid {}: {}", pid, reason);
        return Err(reason.to_string());
    }

    let signal = if force { libc::SIGKILL } else { libc::SIGTERM };
    let result = unsafe { libc::kill(pid as i32, signal) };
    if result == 0 {
        Ok(())
    } else {
        let error = std::io::Error::last_os_error();
        log::error!("failed to signal pid {}: {}", pid, error);
        Err(format!("Could not stop process {pid}. {error}"))
    }
}

#[cfg(not(unix))]
pub fn signal_process(_pid: u32, _force: bool, _expected: Option<&str>) -> Result<(), String> {
    Err("Stopping a listening process is available on macOS and Linux.".to_string())
}

#[tauri::command]
pub fn list_listening_ports() -> ListeningPortsResponse {
    collect_listening_ports()
}

#[tauri::command]
pub fn stop_listening_process(
    pid: u32,
    force: bool,
    expected_process: Option<String>,
) -> Result<(), String> {
    signal_process(pid, force, expected_process.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_lsof_listen_rows() {
        let line = "node  4321 keshav  23u  IPv4 0xabc  0t0  TCP 127.0.0.1:3000 (LISTEN)";
        let parsed = parse_listen_line(line).unwrap();
        assert_eq!(parsed.command, "node");
        assert_eq!(parsed.pid, 4321);
        assert_eq!(parsed.user, "keshav");
        assert_eq!(parsed.port, 3000);

        let v6 = "node  9 keshav  23u  IPv6 0xabc  0t0  TCP [::1]:5173 (LISTEN)";
        assert_eq!(parse_listen_line(v6).unwrap().port, 5173);
        assert!(parse_listen_line("COMMAND PID USER").is_none());
        assert!(parse_listen_line("node 12 keshav TCP 127.0.0.1:80 (CLOSED)").is_none());
    }

    #[test]
    fn parses_ps_and_cwd() {
        let (pid, info) = parse_ps_line("  4321 501 keshav node server.js").unwrap();
        assert_eq!(pid, 4321);
        assert_eq!(info.uid, 501);
        assert_eq!(info.user, "keshav");
        assert_eq!(info.command, "node server.js");
        assert!(parse_ps_line("nope").is_none());
        assert!(parse_ps_line("").is_none());

        let cwd = parse_lsof_cwd("p4321\nfcwd\nn/Users/keshav/app\n").unwrap();
        assert_eq!(cwd, "/Users/keshav/app");
        assert!(parse_lsof_cwd("p1\n").is_none());
    }

    #[test]
    fn refuses_to_stop_root_system_or_unknown_processes() {
        let root = ProcessInfo { uid: 0, user: "root".into(), command: "sshd".into() };
        let daemon = ProcessInfo { uid: 88, user: "_windowserver".into(), command: "WindowServer".into() };
        let mine = ProcessInfo { uid: 501, user: "keshav".into(), command: "node".into() };
        let other = ProcessInfo { uid: 502, user: "alice".into(), command: "node".into() };
        assert!(system_refusal(Some(&root), "keshav", Some(501)).is_some());
        assert!(system_refusal(Some(&daemon), "keshav", Some(501)).is_some());
        assert!(system_refusal(None, "keshav", Some(501)).is_some());
        assert_eq!(system_refusal(Some(&mine), "keshav", Some(501)), None);
        assert!(system_refusal(Some(&other), "keshav", Some(501))
            .unwrap()
            .contains("another user"));
        // An empty $USER must not let a root process through.
        assert!(system_refusal(Some(&root), "", Some(501)).is_some());
    }

    #[test]
    fn classifies_system_and_self_processes() {
        assert!(is_system_process("root", 0, "keshav"));
        assert!(is_system_process("_windowserver", 88, "keshav"));
        assert!(is_system_process("daemon", 1, "keshav"));
        assert!(!is_system_process("keshav", 501, "keshav"));
        assert!(is_watchtower_process(10, "node", 10));
        assert!(is_watchtower_process(11, "/Applications/Watchtower.app/watchtower", 99));
        assert!(!is_watchtower_process(11, "node", 99));
        assert!(stop_refusal(1, "launchd", 50).is_some());
        assert!(stop_refusal(50, "watchtower", 99).unwrap().contains("itself"));
        assert!(stop_refusal(77, "node", 99).is_none());
    }

    #[test]
    fn project_label_prefers_package_name() {
        let root = std::env::temp_dir().join(format!("wt-ports-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        assert_eq!(
            project_label(&root).as_deref(),
            root.file_name().and_then(|n| n.to_str())
        );
        std::fs::write(root.join("package.json"), r#"{"name":"demo-server"}"#).unwrap();
        assert_eq!(project_label(&root).as_deref(), Some("demo-server"));
        std::fs::write(root.join("package.json"), "not json").unwrap();
        assert_eq!(
            project_label(&root).as_deref(),
            root.file_name().and_then(|n| n.to_str())
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn assemble_hides_nothing_but_marks_system_and_self() {
        let listeners = vec![
            RawListener {
                command: "node".into(),
                pid: 10,
                user: "keshav".into(),
                port: 3000,
            },
            RawListener {
                command: "node".into(),
                pid: 10,
                user: "keshav".into(),
                port: 3000,
            },
            RawListener {
                command: "launchd".into(),
                pid: 1,
                user: "root".into(),
                port: 22,
            },
        ];
        let mut processes = HashMap::new();
        processes.insert(
            10,
            ProcessInfo {
                uid: 501,
                user: "keshav".into(),
                command: "node".into(),
            },
        );
        let ports = assemble_ports(listeners, &processes, |_| Some("/tmp/demo".into()), "keshav", 10);
        assert_eq!(ports.len(), 2);
        assert!(ports.iter().any(|port| port.pid == 10 && port.self_process && !port.system));
        assert!(ports.iter().any(|port| port.pid == 1 && port.system));
    }

    #[cfg(unix)]
    #[test]
    fn sigterm_stops_a_child_process() {
        let mut child = Command::new("sleep").arg("30").spawn().unwrap();
        let pid = child.id();
        signal_process(pid, false, Some("sleep")).unwrap();
        let status = child.wait().unwrap();
        assert!(!status.success() || status.code().is_none());
    }

    #[test]
    fn refuses_to_signal_this_process() {
        let error = signal_process(std::process::id(), true, None).unwrap_err();
        assert!(error.contains("itself"));
    }

    #[test]
    fn refuses_a_pid_that_now_runs_a_different_program() {
        let node = ProcessInfo { uid: 501, user: "keshav".into(), command: "/usr/local/bin/node".into() };
        assert_eq!(reuse_refusal(Some(&node), Some("node")), None);
        assert_eq!(reuse_refusal(Some(&node), None), None);
        assert_eq!(reuse_refusal(None, Some("node")), None);
        assert!(reuse_refusal(Some(&node), Some("python3")).unwrap().contains("changed"));
    }

    #[cfg(unix)]
    #[test]
    fn sigterm_is_refused_when_the_pid_was_reused() {
        let mut child = Command::new("sleep").arg("30").spawn().unwrap();
        let pid = child.id();
        let error = signal_process(pid, false, Some("node")).unwrap_err();
        assert!(error.contains("changed"));
        child.kill().unwrap();
        let _ = child.wait();
    }
}
