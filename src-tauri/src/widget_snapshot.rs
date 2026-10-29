//! Versioned usage snapshot shared with the macOS Notification Center widget.
//!
//! The widget never talks to providers. Each probe batch folds the latest
//! progress lines into this document and writes it where the extension can read.

use crate::plugin_engine::manifest::{LoadedPlugin, ManifestLine};
use crate::plugin_engine::runtime::{MetricLine, PluginOutput};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

pub const SCHEMA_VERSION: u32 = 1;
pub const APP_GROUP_ID: &str = "group.com.keshavk3.watchtower";
pub const WIDGET_EXTENSION_BUNDLE_ID: &str = "com.keshavk3.watchtower.widget";
pub const SNAPSHOT_FILE_NAME: &str = "widget-snapshot.json";
pub const WIDGET_KIND: &str = "com.keshavk3.watchtower.usage";

/// Quiet period between WidgetKit reload requests. macOS drops reloads that
/// arrive too often, and the default in-app refresh is every 5 minutes.
pub const RELOAD_GAP_SECS: u64 = 15 * 60;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WidgetSnapshot {
    pub version: u32,
    pub updated_at: String,
    pub providers: Vec<WidgetProvider>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WidgetProvider {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brand_color: Option<String>,
    pub stale: bool,
    pub updated_at: String,
    pub lines: Vec<WidgetLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WidgetLine {
    pub label: String,
    pub percent: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resets_at: Option<String>,
    pub primary: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PluginSeed {
    pub id: String,
    pub name: String,
    pub brand_color: Option<String>,
    pub primary_labels: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct SnapshotStore {
    snapshot: WidgetSnapshot,
}

impl Default for SnapshotStore {
    fn default() -> Self {
        Self::new()
    }
}

impl SnapshotStore {
    pub fn new() -> Self {
        Self {
            snapshot: WidgetSnapshot {
                version: SCHEMA_VERSION,
                updated_at: String::new(),
                providers: Vec::new(),
            },
        }
    }

    pub fn snapshot(&self) -> &WidgetSnapshot {
        &self.snapshot
    }

    /// Replace the in-memory document. Unknown versions are refused so a newer
    /// file cannot be rewritten as version 1 and lose fields.
    pub fn load_file_contents(&mut self, text: &str) -> Result<(), String> {
        let parsed: WidgetSnapshot = serde_json::from_str(text)
            .map_err(|e| format!("widget snapshot is not valid JSON: {e}"))?;
        if parsed.version != SCHEMA_VERSION {
            return Err(format!(
                "widget snapshot version {} is not supported",
                parsed.version
            ));
        }
        self.snapshot = parsed;
        Ok(())
    }

    /// Keep saved usage for plugins that are still installed, in plugin-list order.
    pub fn seed(&mut self, plugins: &[PluginSeed]) {
        let mut next = Vec::with_capacity(plugins.len());
        for plugin in plugins {
            if let Some(mut existing) = self
                .snapshot
                .providers
                .iter()
                .find(|provider| provider.id == plugin.id)
                .cloned()
            {
                existing.name = plugin.name.clone();
                existing.brand_color = plugin.brand_color.clone();
                next.push(existing);
            } else {
                next.push(WidgetProvider {
                    id: plugin.id.clone(),
                    name: plugin.name.clone(),
                    brand_color: plugin.brand_color.clone(),
                    stale: true,
                    updated_at: String::new(),
                    lines: Vec::new(),
                });
            }
        }
        self.snapshot.providers = next;
    }

    pub fn record_output(&mut self, seed: &PluginSeed, output: &PluginOutput, now: OffsetDateTime) {
        if output_is_error(output) {
            self.record_failure(&seed.id, &seed.name, now);
            if let Some(provider) = self
                .snapshot
                .providers
                .iter_mut()
                .find(|provider| provider.id == seed.id)
            {
                provider.brand_color = seed.brand_color.clone();
            }
            return;
        }

        let stamp = format_timestamp(now);
        self.snapshot.updated_at = stamp.clone();
        let lines = widget_lines(output, &seed.primary_labels);
        let provider = WidgetProvider {
            id: seed.id.clone(),
            name: seed.name.clone(),
            brand_color: seed.brand_color.clone(),
            stale: false,
            updated_at: stamp,
            lines,
        };
        upsert(&mut self.snapshot.providers, provider);
    }

    pub fn record_failure(&mut self, id: &str, name: &str, now: OffsetDateTime) {
        let stamp = format_timestamp(now);
        self.snapshot.updated_at = stamp.clone();
        if let Some(provider) = self
            .snapshot
            .providers
            .iter_mut()
            .find(|provider| provider.id == id)
        {
            provider.stale = true;
            provider.updated_at = stamp;
            if !name.is_empty() {
                provider.name = name.to_string();
            }
            return;
        }
        self.snapshot.providers.push(WidgetProvider {
            id: id.to_string(),
            name: if name.is_empty() {
                id.to_string()
            } else {
                name.to_string()
            },
            brand_color: None,
            stale: true,
            updated_at: stamp,
            lines: Vec::new(),
        });
    }

    pub fn to_json(&self) -> Result<String, String> {
        let mut json = serde_json::to_string_pretty(&self.snapshot)
            .map_err(|e| format!("failed to serialize widget snapshot: {e}"))?;
        json.push('\n');
        Ok(json)
    }
}

pub fn seed_from_plugin(plugin: &LoadedPlugin) -> PluginSeed {
    PluginSeed {
        id: plugin.manifest.id.clone(),
        name: plugin.manifest.name.clone(),
        brand_color: plugin.manifest.brand_color.clone(),
        primary_labels: primary_labels(&plugin.manifest.lines),
    }
}

pub fn primary_labels(lines: &[ManifestLine]) -> Vec<String> {
    let mut candidates: Vec<&ManifestLine> = lines
        .iter()
        .filter(|line| line.line_type == "progress" && line.primary_order.is_some())
        .collect();
    candidates.sort_by_key(|line| line.primary_order.unwrap_or(u32::MAX));
    candidates
        .into_iter()
        .map(|line| line.label.clone())
        .collect()
}

pub fn format_timestamp(now: OffsetDateTime) -> String {
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        now.year(),
        u8::from(now.month()),
        now.day(),
        now.hour(),
        now.minute(),
        now.second()
    )
}

/// Percent of `limit` that `used` represents, rounded to one decimal.
/// Values above 100 are kept so an over-limit plan still reads as over-limit.
pub fn usage_percent(used: f64, limit: f64) -> Option<f64> {
    if !used.is_finite() || !limit.is_finite() || limit <= 0.0 {
        return None;
    }
    let pct = (used.max(0.0) / limit) * 100.0;
    if !pct.is_finite() {
        return None;
    }
    Some((pct.min(999.9) * 10.0).round() / 10.0)
}

pub fn should_reload(last: Option<std::time::Instant>, now: std::time::Instant) -> bool {
    match last {
        None => true,
        Some(last) => now.saturating_duration_since(last).as_secs() >= RELOAD_GAP_SECS,
    }
}

fn output_is_error(output: &PluginOutput) -> bool {
    output
        .lines
        .iter()
        .any(|line| matches!(line, MetricLine::Badge { label, .. } if label == "Error"))
}

fn widget_lines(output: &PluginOutput, primary_labels: &[String]) -> Vec<WidgetLine> {
    let mut lines = Vec::new();
    for line in &output.lines {
        let MetricLine::Progress {
            label,
            used,
            limit,
            resets_at,
            ..
        } = line
        else {
            continue;
        };
        let Some(percent) = usage_percent(*used, *limit) else {
            continue;
        };
        lines.push(WidgetLine {
            label: label.clone(),
            percent,
            resets_at: resets_at.clone(),
            primary: false,
        });
    }

    let primary = primary_labels
        .iter()
        .find(|label| lines.iter().any(|line| line.label == **label))
        .cloned()
        .or_else(|| lines.first().map(|line| line.label.clone()));
    if let Some(primary) = primary {
        if let Some(line) = lines.iter_mut().find(|line| line.label == primary) {
            line.primary = true;
        }
    }
    lines
}

fn upsert(providers: &mut Vec<WidgetProvider>, provider: WidgetProvider) {
    if let Some(existing) = providers
        .iter_mut()
        .find(|existing| existing.id == provider.id)
    {
        *existing = provider;
    } else {
        providers.push(provider);
    }
}

#[cfg(test)]
#[path = "widget_snapshot_tests.rs"]
mod tests;
