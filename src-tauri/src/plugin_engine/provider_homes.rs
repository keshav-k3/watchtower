use crate::plugin_engine::manifest::LoadedPlugin;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::path::Path;

const SETTINGS_FILE_NAME: &str = "settings.json";
const HOME_CAPABLE_PLUGIN_IDS: [&str; 2] = ["claude", "codex"];

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderHome {
    pub id: String,
    pub plugin_id: String,
    pub name: String,
    pub home_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsFile {
    #[serde(default)]
    provider_homes: Option<Vec<ProviderHome>>,
}

pub fn home_env_var(plugin_id: &str) -> Option<&'static str> {
    match plugin_id {
        "claude" => Some("CLAUDE_CONFIG_DIR"),
        "codex" => Some("CODEX_HOME"),
        _ => None,
    }
}

pub fn read_provider_homes(app_data_dir: &Path) -> Vec<ProviderHome> {
    let path = app_data_dir.join(SETTINGS_FILE_NAME);
    let data = match std::fs::read_to_string(&path) {
        Ok(data) => data,
        Err(_) => return Vec::new(),
    };
    parse_provider_homes_json(&data)
}

pub fn parse_provider_homes_json(data: &str) -> Vec<ProviderHome> {
    let parsed = match serde_json::from_str::<SettingsFile>(data) {
        Ok(parsed) => parsed,
        Err(err) => {
            log::warn!("failed to parse providerHomes from settings.json: {}", err);
            return Vec::new();
        }
    };
    sanitize_provider_homes(parsed.provider_homes.unwrap_or_default())
}

fn sanitize_provider_homes(homes: Vec<ProviderHome>) -> Vec<ProviderHome> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for home in homes {
        let id = home.id.trim().to_string();
        let plugin_id = home.plugin_id.trim().to_string();
        let name = home.name.trim().to_string();
        let home_path = home.home_path.trim().to_string();
        if id.is_empty() || name.is_empty() || home_path.is_empty() {
            continue;
        }
        if !HOME_CAPABLE_PLUGIN_IDS.contains(&plugin_id.as_str()) {
            log::warn!(
                "ignoring extra account '{}': plugin '{}' does not support config homes",
                id,
                plugin_id
            );
            continue;
        }
        if HOME_CAPABLE_PLUGIN_IDS.contains(&id.as_str()) {
            log::warn!(
                "ignoring extra account '{}': id collides with a bundled provider",
                id
            );
            continue;
        }
        if !seen.insert(id.clone()) {
            log::warn!("ignoring duplicate extra account id '{}'", id);
            continue;
        }
        out.push(ProviderHome {
            id,
            plugin_id,
            name,
            home_path,
        });
    }
    out
}

pub fn instantiate_home(source: &LoadedPlugin, home: &ProviderHome) -> Option<LoadedPlugin> {
    let env_var = home_env_var(&home.plugin_id)?;
    if source.manifest.id != home.plugin_id {
        return None;
    }
    let mut instance = source.clone();
    instance.manifest.id = home.id.clone();
    instance.manifest.name = home.name.clone();
    instance.source_plugin_id = Some(home.plugin_id.clone());
    instance
        .env_overlay
        .insert(env_var.to_string(), home.home_path.clone());
    Some(instance)
}

pub fn plugins_with_homes(bundled: &[LoadedPlugin], homes: &[ProviderHome]) -> Vec<LoadedPlugin> {
    let by_id: HashMap<String, LoadedPlugin> = bundled
        .iter()
        .map(|plugin| (plugin.manifest.id.clone(), plugin.clone()))
        .collect();
    let mut out = bundled.to_vec();
    let bundled_ids: HashSet<String> = by_id.keys().cloned().collect();

    for home in homes {
        if bundled_ids.contains(&home.id) {
            continue;
        }
        let Some(source) = by_id.get(&home.plugin_id) else {
            log::warn!(
                "ignoring extra account '{}': bundled plugin '{}' is not loaded",
                home.id,
                home.plugin_id
            );
            continue;
        };
        if let Some(instance) = instantiate_home(source, home) {
            out.push(instance);
        }
    }
    out
}

pub fn resolve_probe_plugins(
    bundled: &[LoadedPlugin],
    requested_ids: Option<&[String]>,
    homes: &[ProviderHome],
) -> Vec<LoadedPlugin> {
    let expanded = plugins_with_homes(bundled, homes);
    let Some(ids) = requested_ids else {
        return expanded;
    };

    let mut by_id: HashMap<String, LoadedPlugin> = expanded
        .into_iter()
        .map(|plugin| (plugin.manifest.id.clone(), plugin))
        .collect();
    let mut seen = HashSet::new();
    ids.iter()
        .filter_map(|id| {
            if !seen.insert(id.clone()) {
                return None;
            }
            by_id.remove(id)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_engine::manifest::PluginManifest;
    use std::path::PathBuf;

    fn bundled(id: &str, name: &str) -> LoadedPlugin {
        LoadedPlugin {
            manifest: PluginManifest {
                schema_version: 1,
                id: id.to_string(),
                name: name.to_string(),
                version: "0.0.1".to_string(),
                entry: "plugin.js".to_string(),
                icon: "icon.svg".to_string(),
                brand_color: None,
                lines: vec![],
                links: vec![],
            },
            plugin_dir: PathBuf::from("."),
            entry_script: String::new(),
            icon_data_url: String::new(),
            env_overlay: HashMap::new(),
            source_plugin_id: None,
        }
    }

    #[test]
    fn parse_provider_homes_keeps_valid_claude_and_codex_rows() {
        let json = r#"{
            "plugins": { "order": ["claude"], "disabled": [] },
            "providerHomes": [
                { "id": "claude-work", "pluginId": "claude", "name": "Claude Work", "homePath": "~/.claude-work" },
                { "id": "codex-personal", "pluginId": "codex", "name": "Codex Personal", "homePath": "/tmp/codex-personal" }
            ]
        }"#;
        let homes = parse_provider_homes_json(json);
        assert_eq!(homes.len(), 2);
        assert_eq!(homes[0].id, "claude-work");
        assert_eq!(homes[1].plugin_id, "codex");
    }

    #[test]
    fn parse_provider_homes_drops_invalid_and_colliding_rows() {
        let json = r#"{
            "providerHomes": [
                { "id": "claude", "pluginId": "claude", "name": "Nope", "homePath": "~/.claude-work" },
                { "id": "cursor-home", "pluginId": "cursor", "name": "Cursor", "homePath": "~/.cursor" },
                { "id": "  ", "pluginId": "claude", "name": "Blank", "homePath": "~/.claude" },
                { "id": "claude-work", "pluginId": "claude", "name": "Work", "homePath": "~/.claude-work" },
                { "id": "claude-work", "pluginId": "claude", "name": "Dup", "homePath": "~/.claude-dup" }
            ]
        }"#;
        let homes = parse_provider_homes_json(json);
        assert_eq!(homes.len(), 1);
        assert_eq!(homes[0].id, "claude-work");
    }

    #[test]
    fn instantiate_home_overlays_claude_config_dir() {
        let source = bundled("claude", "Claude");
        let home = ProviderHome {
            id: "claude-work".to_string(),
            plugin_id: "claude".to_string(),
            name: "Claude Work".to_string(),
            home_path: "~/.claude-work".to_string(),
        };
        let instance = instantiate_home(&source, &home).expect("instance");
        assert_eq!(instance.manifest.id, "claude-work");
        assert_eq!(instance.manifest.name, "Claude Work");
        assert_eq!(instance.source_plugin_id.as_deref(), Some("claude"));
        assert_eq!(
            instance
                .env_overlay
                .get("CLAUDE_CONFIG_DIR")
                .map(String::as_str),
            Some("~/.claude-work")
        );
        assert!(source.env_overlay.is_empty());
    }

    #[test]
    fn resolve_probe_plugins_selects_extra_home_by_id() {
        let bundled_plugins = vec![bundled("claude", "Claude"), bundled("codex", "Codex")];
        let homes = vec![ProviderHome {
            id: "claude-work".to_string(),
            plugin_id: "claude".to_string(),
            name: "Claude Work".to_string(),
            home_path: "/tmp/work".to_string(),
        }];
        let selected = resolve_probe_plugins(
            &bundled_plugins,
            Some(&["claude-work".to_string(), "codex".to_string()]),
            &homes,
        );
        let ids: Vec<_> = selected
            .iter()
            .map(|plugin| plugin.manifest.id.as_str())
            .collect();
        assert_eq!(ids, vec!["claude-work", "codex"]);
        assert_eq!(
            selected[0]
                .env_overlay
                .get("CLAUDE_CONFIG_DIR")
                .map(String::as_str),
            Some("/tmp/work")
        );
    }

    #[test]
    fn plugins_with_homes_skips_unknown_source_plugins() {
        let bundled_plugins = vec![bundled("codex", "Codex")];
        let homes = vec![ProviderHome {
            id: "claude-work".to_string(),
            plugin_id: "claude".to_string(),
            name: "Claude Work".to_string(),
            home_path: "~/.claude-work".to_string(),
        }];
        let expanded = plugins_with_homes(&bundled_plugins, &homes);
        assert_eq!(expanded.len(), 1);
        assert_eq!(expanded[0].manifest.id, "codex");
    }
}
