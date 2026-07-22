//! Missing-media detection and relinking (project-format.md §6, roadmap M2).
//!
//! Source media is never modified here. Relinking only rewrites the *reference* held in the
//! project manifest, so the user's footage is untouched either way.

use std::path::Path;

use serde::Serialize;
use serde_json::Value;

use crate::error::{Result, StorageError, StorageErrorCode};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum LinkStatus {
    #[serde(rename = "online")]
    Online,
    #[serde(rename = "offline")]
    Offline,
    #[serde(rename = "proxy_only")]
    ProxyOnly,
    #[serde(rename = "invalid")]
    Invalid,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetLink {
    pub asset_id: String,
    pub path: String,
    pub status: LinkStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_path: Option<String>,
}

fn asset_array(manifest: &Value) -> &[Value] {
    manifest
        .get("assets")
        .and_then(Value::as_array)
        .map(|v| v.as_slice())
        .unwrap_or(&[])
}

/// Resolve each asset reference against the filesystem.
///
/// An original that is gone but has a usable proxy is `proxy_only` rather than `offline`:
/// the user can keep editing, and the distinction drives the export warning (an export
/// from proxies must be an explicit choice, media-engine.md §8).
pub fn detect(manifest: &Value) -> Vec<AssetLink> {
    asset_array(manifest)
        .iter()
        .map(|asset| {
            let asset_id = asset
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let path = asset
                .get("path")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let proxy_path = asset
                .get("proxyPath")
                .and_then(Value::as_str)
                .map(str::to_string);

            let status = if asset_id.is_empty() || path.is_empty() {
                LinkStatus::Invalid
            } else if Path::new(&path).exists() {
                LinkStatus::Online
            } else if proxy_path
                .as_deref()
                .map(|p| Path::new(p).exists())
                .unwrap_or(false)
            {
                LinkStatus::ProxyOnly
            } else {
                LinkStatus::Offline
            };

            AssetLink {
                asset_id,
                path,
                status,
                proxy_path,
            }
        })
        .collect()
}

/// True when every asset resolves to something usable.
pub fn all_resolved(links: &[AssetLink]) -> bool {
    links
        .iter()
        .all(|l| matches!(l.status, LinkStatus::Online | LinkStatus::ProxyOnly))
}

/// Point an asset at a new file, returning an updated manifest.
///
/// The manifest is only modified in memory — the caller saves it, so a failed relink
/// cannot corrupt the stored project.
pub fn relink(manifest: &Value, asset_id: &str, new_path: &str) -> Result<Value> {
    if !Path::new(new_path).exists() {
        return Err(StorageError::new(
            StorageErrorCode::ProjectInvalid,
            "The replacement file does not exist.",
        ));
    }
    let mut updated = manifest.clone();
    let assets = updated
        .get_mut("assets")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| {
            StorageError::new(
                StorageErrorCode::ProjectInvalid,
                "This project has no asset registry.",
            )
        })?;

    let mut found = false;
    for asset in assets.iter_mut() {
        if asset.get("id").and_then(Value::as_str) == Some(asset_id) {
            if let Some(obj) = asset.as_object_mut() {
                obj.insert("path".into(), Value::String(new_path.to_string()));
                obj.insert("status".into(), Value::String("online".into()));
            }
            found = true;
            break;
        }
    }
    if !found {
        return Err(StorageError::new(
            StorageErrorCode::ProjectInvalid,
            "That asset is not part of this project.",
        ));
    }
    Ok(updated)
}
