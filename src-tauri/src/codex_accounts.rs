//! Extra Codex logins live in separate CODEX_HOME directories.
//!
//! A Codex config profile (`codex --profile`, `[profiles.*]` in config.toml)
//! changes model settings inside one home. It does not carry its own
//! auth.json, so profiles are not treated as accounts.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CodexAccountInput {
    pub label: String,
    pub home: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedCodexAccount {
    pub label: String,
    pub home: String,
    pub source: String,
    pub has_auth: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CodexAccountSync {
    pub accounts: Vec<ResolvedCodexAccount>,
    pub profile_note: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AccountsFile {
    show_all: bool,
    accounts: Vec<ResolvedCodexAccount>,
}

pub fn parse_codex_home_assignments(text: &str) -> Vec<String> {
    let mut found = Vec::new();
    for raw_line in text.lines() {
        let line = strip_shell_comment(raw_line);
        let Some(value) = assignment_value(line, "CODEX_HOME").or_else(|| fish_set_value(line)) else {
            continue;
        };
        if !value.is_empty() {
            found.push(value);
        }
    }
    found
}

fn strip_shell_comment(line: &str) -> &str {
    let mut quote: Option<char> = None;
    for (index, ch) in line.char_indices() {
        match (quote, ch) {
            (None, '"' | '\'') => quote = Some(ch),
            (Some(open), ch) if ch == open => quote = None,
            (None, '#') => return &line[..index],
            _ => {}
        }
    }
    line
}

fn assignment_value(line: &str, name: &str) -> Option<String> {
    let mut rest = line;
    while let Some(index) = rest.find(name) {
        let before_ok = index == 0
            || rest[..index].chars().last().is_some_and(|ch| {
                ch.is_whitespace() || matches!(ch, '=' | ';' | '"' | '\'' | '(')
            });
        rest = &rest[index + name.len()..];
        if !before_ok {
            continue;
        }
        let rest = rest.trim_start();
        if !rest.starts_with('=') {
            continue;
        }
        return Some(unquote(rest[1..].trim_start()));
    }
    None
}

fn fish_set_value(line: &str) -> Option<String> {
    let tokens: Vec<&str> = line.split_whitespace().collect();
    let index = tokens.iter().position(|token| *token == "CODEX_HOME")?;
    let value = tokens.get(index + 1)?;
    if value.starts_with('-') || value.contains('=') {
        return None;
    }
    Some(unquote(value))
}

fn unquote(value: &str) -> String {
    let value = value.trim();
    if value.len() >= 2 {
        let bytes = value.as_bytes();
        if (bytes[0] == b'"' && bytes[value.len() - 1] == b'"')
            || (bytes[0] == b'\'' && bytes[value.len() - 1] == b'\'')
        {
            return value[1..value.len() - 1].to_string();
        }
    }
    value
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .trim_matches(|c| c == '"' || c == '\'' || c == ';')
        .to_string()
}

pub fn expand_codex_home(value: &str, user_home: &Path) -> Option<PathBuf> {
    let value = value.trim().trim_matches('"').trim_matches('\'');
    if value.is_empty() {
        return None;
    }
    let home = user_home.to_string_lossy();
    let replaced = value
        .replace("${HOME}", home.as_ref())
        .replace("$HOME", home.as_ref());
    if replaced.contains('$') {
        return None;
    }
    if let Some(rest) = replaced.strip_prefix("~/") {
        return Some(user_home.join(rest));
    }
    if replaced == "~" {
        return Some(user_home.to_path_buf());
    }
    let path = PathBuf::from(&replaced);
    if path.is_absolute() {
        Some(path)
    } else {
        None
    }
}

pub fn label_for_home(home: &Path, is_default: bool) -> String {
    let name = home
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("codex")
        .trim_start_matches('.')
        .to_ascii_lowercase();
    if name.contains("work") {
        return "Work".to_string();
    }
    if name.contains("personal") {
        return "Personal".to_string();
    }
    if is_default {
        return "Codex".to_string();
    }
    let mut label = String::new();
    let mut upper = true;
    for ch in name.replace(['-', '_'], " ").chars() {
        if ch.is_whitespace() {
            label.push(' ');
            upper = true;
            continue;
        }
        if upper {
            label.extend(ch.to_uppercase());
            upper = false;
        } else {
            label.push(ch);
        }
    }
    let label = label.split_whitespace().collect::<Vec<_>>().join(" ");
    if label.is_empty() {
        "Codex".to_string()
    } else {
        label
    }
}

pub fn config_has_profiles(text: &str) -> bool {
    text.lines().any(|line| {
        let trimmed = line.trim();
        trimmed.starts_with("[profiles.") || trimmed.starts_with("[profile.")
    })
}

pub fn shell_files(user_home: &Path) -> Vec<PathBuf> {
    vec![
        user_home.join(".zshrc"),
        user_home.join(".zprofile"),
        user_home.join(".bashrc"),
        user_home.join(".bash_profile"),
        user_home.join(".profile"),
        user_home.join(".config/fish/config.fish"),
    ]
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().trim_end_matches('/').to_string()
}

fn has_auth(home: &Path) -> bool {
    home.join("auth.json").is_file()
}

pub fn resolve_accounts(
    user_home: &Path,
    default_home: &Path,
    detected_homes: &[PathBuf],
    manual: &[CodexAccountInput],
    profiles_found: bool,
) -> CodexAccountSync {
    let mut accounts = Vec::new();
    let mut seen = std::collections::BTreeSet::new();

    let push = |accounts: &mut Vec<ResolvedCodexAccount>,
                seen: &mut std::collections::BTreeSet<String>,
                home: &Path,
                label: String,
                source: &str| {
        let key = normalize_path(home);
        if key.is_empty() || !seen.insert(key.clone()) {
            return;
        }
        accounts.push(ResolvedCodexAccount {
            label,
            home: key,
            source: source.to_string(),
            has_auth: has_auth(home),
        });
    };

    push(
        &mut accounts,
        &mut seen,
        default_home,
        label_for_home(default_home, true),
        "default",
    );

    for home in detected_homes {
        if !has_auth(home) {
            continue;
        }
        push(
            &mut accounts,
            &mut seen,
            home,
            label_for_home(home, false),
            "detected",
        );
    }

    for account in manual {
        let Some(home) = expand_codex_home(&account.home, user_home) else {
            continue;
        };
        let label = account.label.trim();
        if label.is_empty() {
            continue;
        }
        let key = normalize_path(&home);
        if let Some(existing) = accounts.iter_mut().find(|item| item.home == key) {
            existing.label = label.to_string();
            if existing.source == "detected" {
                existing.source = "manual".to_string();
            }
            continue;
        }
        push(
            &mut accounts,
            &mut seen,
            &home,
            label.to_string(),
            "manual",
        );
    }

    CodexAccountSync {
        accounts,
        profile_note: profiles_found.then(|| {
            "Codex config profiles share one login. Add another account with its CODEX_HOME folder."
                .to_string()
        }),
    }
}

fn default_home(user_home: &Path) -> PathBuf {
    if let Ok(value) = std::env::var("CODEX_HOME") {
        if let Some(path) = expand_codex_home(&value, user_home) {
            return path;
        }
    }
    let config = user_home.join(".config/codex");
    if has_auth(&config) && !has_auth(&user_home.join(".codex")) {
        return config;
    }
    user_home.join(".codex")
}

fn detected_homes(user_home: &Path) -> (Vec<PathBuf>, bool) {
    let mut homes = Vec::new();
    for path in shell_files(user_home) {
        let Ok(text) = std::fs::read_to_string(&path) else {
            continue;
        };
        for value in parse_codex_home_assignments(&text) {
            if let Some(home) = expand_codex_home(&value, user_home) {
                homes.push(home);
            }
        }
    }
    let mut profiles = false;
    let mut config_paths = vec![user_home.join(".codex/config.toml")];
    for home in &homes {
        config_paths.push(home.join("config.toml"));
    }
    for path in config_paths {
        if let Ok(text) = std::fs::read_to_string(path) {
            profiles |= config_has_profiles(&text);
        }
    }
    (homes, profiles)
}

pub fn accounts_file_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir
        .join("plugins_data")
        .join("codex")
        .join("accounts.json")
}

pub fn write_accounts_file(
    app_data_dir: &Path,
    show_all: bool,
    sync: &CodexAccountSync,
) -> Result<(), String> {
    let path = accounts_file_path(app_data_dir);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let file = AccountsFile {
        show_all,
        accounts: sync.accounts.clone(),
    };
    let text = serde_json::to_string_pretty(&file).map_err(|error| error.to_string())?;
    std::fs::write(path, text).map_err(|error| error.to_string())
}

// Spawns lsof/ps/pmset or reads files: keep it off the main (UI) thread.
#[tauri::command(async)]
pub fn sync_codex_accounts(
    app: tauri::AppHandle,
    show_all: bool,
    accounts: Vec<CodexAccountInput>,
) -> Result<CodexAccountSync, String> {
    let user_home = dirs::home_dir().ok_or("Home directory is not available")?;
    let default_home = default_home(&user_home);
    let (detected, profiles) = detected_homes(&user_home);
    let sync = resolve_accounts(&user_home, &default_home, &detected, &accounts, profiles);
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    write_accounts_file(&app_data_dir, show_all, &sync)?;
    Ok(sync)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_home_assignments_from_aliases_and_exports() {
        let text = r#"
            export CODEX_HOME="$HOME/.codex-work"
            alias personal='CODEX_HOME=~/.codex-personal codex'
            set -gx CODEX_HOME ~/.codex-fish
            # CODEX_HOME=/tmp/ignored
            PATH="$CODEX_HOME/bin"
        "#;
        let values = parse_codex_home_assignments(text);
        assert_eq!(
            values,
            vec![
                "$HOME/.codex-work".to_string(),
                "~/.codex-personal".to_string(),
                "~/.codex-fish".to_string()
            ]
        );
    }

    #[test]
    fn expands_only_safe_home_values() {
        let home = Path::new("/Users/keshav");
        assert_eq!(
            expand_codex_home("$HOME/.codex-work", home).unwrap(),
            PathBuf::from("/Users/keshav/.codex-work")
        );
        assert_eq!(
            expand_codex_home("~/extra", home).unwrap(),
            PathBuf::from("/Users/keshav/extra")
        );
        assert_eq!(
            expand_codex_home("/tmp/codex", home).unwrap(),
            PathBuf::from("/tmp/codex")
        );
        assert!(expand_codex_home("$OTHER/codex", home).is_none());
        assert!(expand_codex_home("relative/codex", home).is_none());
        assert!(expand_codex_home("", home).is_none());
    }

    #[test]
    fn labels_common_folder_names() {
        assert_eq!(label_for_home(Path::new("/Users/a/.codex"), true), "Codex");
        assert_eq!(label_for_home(Path::new("/Users/a/.codex-work"), false), "Work");
        assert_eq!(
            label_for_home(Path::new("/Users/a/.codex-personal"), false),
            "Personal"
        );
        assert_eq!(label_for_home(Path::new("/Users/a/client-codex"), false), "Client Codex");
    }

    #[test]
    fn profiles_are_noted_and_not_turned_into_accounts() {
        assert!(config_has_profiles("[profiles.work]\nmodel = \"gpt\"\n"));
        assert!(!config_has_profiles("model = \"gpt\"\n"));
        let home = Path::new("/Users/keshav");
        let sync = resolve_accounts(
            home,
            Path::new("/Users/keshav/.codex"),
            &[PathBuf::from("/Users/keshav/.codex-work")],
            &[CodexAccountInput {
                label: "Client".into(),
                home: "/Users/keshav/.codex-client".into(),
            }],
            true,
        );
        assert_eq!(sync.accounts.len(), 2);
        assert_eq!(sync.accounts[0].source, "default");
        assert_eq!(sync.accounts[1].label, "Client");
        assert!(sync.profile_note.is_some());
    }

    #[test]
    fn manual_label_overrides_a_detected_home() {
        let home = std::env::temp_dir().join(format!("wt-codex-label-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        let work = home.join(".codex-work");
        std::fs::create_dir_all(&work).unwrap();
        std::fs::write(work.join("auth.json"), "{}").unwrap();
        let sync = resolve_accounts(
            &home,
            home.join(".codex").as_path(),
            &[work.clone()],
            &[CodexAccountInput {
                label: "Office".into(),
                home: work.to_string_lossy().to_string(),
            }],
            false,
        );
        let office = sync.accounts.iter().find(|account| account.label == "Office").unwrap();
        assert_eq!(office.source, "manual");
        assert!(office.has_auth);
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn writes_the_plugin_accounts_file() {
        let root = std::env::temp_dir().join(format!("wt-codex-accounts-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let sync = CodexAccountSync {
            accounts: vec![ResolvedCodexAccount {
                label: "Codex".into(),
                home: "/Users/keshav/.codex".into(),
                source: "default".into(),
                has_auth: true,
            }],
            profile_note: None,
        };
        write_accounts_file(&root, false, &sync).unwrap();
        let text = std::fs::read_to_string(accounts_file_path(&root)).unwrap();
        assert!(text.contains("\"showAll\": false"));
        assert!(text.contains("Codex"));
        let _ = std::fs::remove_dir_all(&root);
    }
}
