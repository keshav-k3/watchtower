use super::*;
use crate::plugin_engine::runtime::ProgressFormat;
use std::path::PathBuf;
use std::time::{Duration, Instant};

fn at(unix: i64) -> OffsetDateTime {
    OffsetDateTime::from_unix_timestamp(unix).unwrap()
}

fn seed(id: &str, name: &str, primary: &[&str]) -> PluginSeed {
    PluginSeed {
        id: id.to_string(),
        name: name.to_string(),
        brand_color: Some("#DE7356".to_string()),
        primary_labels: primary.iter().map(|label| (*label).to_string()).collect(),
    }
}

fn progress(label: &str, used: f64, limit: f64, resets_at: Option<&str>) -> MetricLine {
    MetricLine::Progress {
        label: label.to_string(),
        used,
        limit,
        format: ProgressFormat::Percent,
        resets_at: resets_at.map(str::to_string),
        period_duration_ms: None,
        color: None,
    }
}

fn output(id: &str, lines: Vec<MetricLine>) -> PluginOutput {
    PluginOutput {
        provider_id: id.to_string(),
        display_name: id.to_string(),
        plan: None,
        lines,
        icon_url: "data:image/svg+xml;base64,AAAA".to_string(),
    }
}

#[test]
fn timestamp_is_utc_without_fractions() {
    assert_eq!(format_timestamp(at(1_700_000_000)), "2023-11-14T22:13:20Z");
}

#[test]
fn percent_covers_count_dollars_and_over_limit() {
    assert_eq!(usage_percent(1.0, 3.0), Some(33.3));
    assert_eq!(usage_percent(15.0, 20.0), Some(75.0));
    assert_eq!(usage_percent(120.0, 100.0), Some(120.0));
    assert_eq!(usage_percent(-5.0, 100.0), Some(0.0));
    assert_eq!(usage_percent(10.0, 0.0), None);
    assert_eq!(usage_percent(f64::NAN, 100.0), None);
    assert_eq!(usage_percent(10_000.0, 1.0), Some(999.9));
}

#[test]
fn primary_uses_the_first_candidate_that_exists() {
    let mut store = SnapshotStore::new();
    let claude = seed(
        "claude",
        "Claude",
        &["Session", "Weekly", "Extra usage spent"],
    );
    store.record_output(
        &claude,
        &output(
            "claude",
            vec![
                MetricLine::Text {
                    label: "Today".to_string(),
                    value: "$5".to_string(),
                    color: None,
                    subtitle: None,
                },
                progress("Weekly", 41.0, 100.0, Some("2026-11-02T00:00:00Z")),
                progress("Extra usage spent", 10.0, 100.0, None),
            ],
        ),
        at(1_700_000_000),
    );

    let provider = &store.snapshot().providers[0];
    assert_eq!(provider.lines.len(), 2);
    assert!(provider.lines.iter().all(|line| line.label != "Today"));
    assert!(
        provider
            .lines
            .iter()
            .any(|line| line.label == "Weekly" && line.primary)
    );
    assert!(
        !provider
            .lines
            .iter()
            .any(|line| line.label == "Extra usage spent" && line.primary)
    );
    assert!(!provider.stale);
    assert_eq!(provider.brand_color.as_deref(), Some("#DE7356"));
}

#[test]
fn error_badge_keeps_previous_lines_and_marks_stale() {
    let mut store = SnapshotStore::new();
    let claude = seed("claude", "Claude", &["Session"]);
    let now = at(1_700_000_000);
    store.record_output(
        &claude,
        &output(
            "claude",
            vec![progress(
                "Session",
                72.0,
                100.0,
                Some("2026-10-26T15:00:00Z"),
            )],
        ),
        now,
    );
    store.record_output(
        &claude,
        &output(
            "claude",
            vec![MetricLine::Badge {
                label: "Error".to_string(),
                text: "not signed in".to_string(),
                color: Some("#ef4444".to_string()),
                subtitle: None,
            }],
        ),
        at(1_700_000_100),
    );

    let provider = &store.snapshot().providers[0];
    assert!(provider.stale);
    assert_eq!(provider.lines.len(), 1);
    assert_eq!(provider.lines[0].percent, 72.0);
    assert_eq!(provider.updated_at, "2023-11-14T22:15:00Z");
}

#[test]
fn later_probe_does_not_drop_other_providers() {
    let mut store = SnapshotStore::new();
    store.record_output(
        &seed("claude", "Claude", &["Session"]),
        &output("claude", vec![progress("Session", 10.0, 100.0, None)]),
        at(1_700_000_000),
    );
    store.record_output(
        &seed("cursor", "Cursor", &["Credits"]),
        &output("cursor", vec![progress("Credits", 3.0, 10.0, None)]),
        at(1_700_000_050),
    );

    assert_eq!(store.snapshot().providers.len(), 2);
    assert_eq!(store.snapshot().providers[0].id, "claude");
    assert_eq!(store.snapshot().providers[1].lines[0].percent, 30.0);
}

#[test]
fn seed_refreshes_names_and_drops_removed_plugins() {
    let mut store = SnapshotStore::new();
    store.record_output(
        &seed("claude", "Old", &["Session"]),
        &output("claude", vec![progress("Session", 10.0, 100.0, None)]),
        at(1_700_000_000),
    );
    store.record_output(
        &seed("codex", "Codex", &["Session"]),
        &output("codex", vec![progress("Session", 20.0, 100.0, None)]),
        at(1_700_000_000),
    );
    store.seed(&[
        PluginSeed {
            id: "cursor".to_string(),
            name: "Cursor".to_string(),
            brand_color: Some("#000000".to_string()),
            primary_labels: vec!["Credits".to_string()],
        },
        PluginSeed {
            id: "claude".to_string(),
            name: "Claude".to_string(),
            brand_color: Some("#D97757".to_string()),
            primary_labels: vec!["Session".to_string()],
        },
    ]);

    let ids: Vec<&str> = store
        .snapshot()
        .providers
        .iter()
        .map(|provider| provider.id.as_str())
        .collect();
    assert_eq!(ids, vec!["cursor", "claude"]);
    assert_eq!(store.snapshot().providers[1].name, "Claude");
    assert_eq!(store.snapshot().providers[1].lines[0].percent, 10.0);
    assert!(store.snapshot().providers[0].stale);
    assert!(store.snapshot().providers[0].lines.is_empty());
}

#[test]
fn json_is_versioned_and_omits_icons() {
    let mut store = SnapshotStore::new();
    store.record_output(
        &seed("claude", "Claude", &["Session"]),
        &output(
            "claude",
            vec![progress(
                "Session",
                72.0,
                100.0,
                Some("2026-10-26T15:00:00Z"),
            )],
        ),
        at(1_700_000_000),
    );
    let json = store.to_json().unwrap();
    assert!(json.contains("\"version\": 1"));
    assert!(json.contains("\"percent\": 72.0"));
    assert!(json.contains("\"resetsAt\": \"2026-10-26T15:00:00Z\""));
    assert!(!json.contains("data:image"));
    assert!(!json.contains("iconUrl"));

    let mut restored = SnapshotStore::new();
    restored.load_file_contents(&json).unwrap();
    assert_eq!(restored.snapshot(), store.snapshot());
}

#[test]
fn unsupported_version_is_refused() {
    let mut store = SnapshotStore::new();
    let error = store
        .load_file_contents(r#"{"version":2,"updatedAt":"","providers":[]}"#)
        .unwrap_err();
    assert!(error.contains("version 2"));
    assert!(store.snapshot().providers.is_empty());
}

#[test]
fn reload_quiet_period_is_fifteen_minutes() {
    let start = Instant::now();
    assert!(should_reload(None, start));
    assert!(!should_reload(
        Some(start),
        start + Duration::from_secs(14 * 60)
    ));
    assert!(should_reload(
        Some(start),
        start + Duration::from_secs(RELOAD_GAP_SECS)
    ));
}

#[test]
fn swift_and_entitlements_use_the_same_ids() {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let files = [
        "macos/WatchtowerWidget/Sources/Shared/WidgetContract.swift",
        "macos/WatchtowerWidget/WatchtowerWidget.entitlements",
        "Entitlements.plist",
        "macos/WatchtowerWidget/project.yml",
    ];
    for file in files {
        let text = std::fs::read_to_string(manifest.join(file))
            .unwrap_or_else(|error| panic!("read {file}: {error}"));
        assert!(
            text.contains(APP_GROUP_ID),
            "{file} should contain {APP_GROUP_ID}"
        );
    }
    let contract = std::fs::read_to_string(
        manifest.join("macos/WatchtowerWidget/Sources/Shared/WidgetContract.swift"),
    )
    .unwrap();
    assert!(contract.contains(WIDGET_KIND));
    assert!(contract.contains(SNAPSHOT_FILE_NAME));
    assert!(contract.contains(WIDGET_EXTENSION_BUNDLE_ID));
}
