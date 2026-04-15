use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModelUpdate {
    pub id: String,
    pub name: String,
    pub current_version: String,
    pub latest_version: String,
    pub size_gb: f32,
    pub changelog: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateCheckResult {
    pub updates: Vec<ModelUpdate>,
    pub app_update: Option<AppUpdate>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppUpdate {
    pub current: String,
    pub latest: String,
    pub download_url: String,
    pub changelog_url: String,
}

// Manifest JSON structure
#[derive(Deserialize)]
struct Manifest {
    tiers: serde_json::Value,
    app_version: AppVersionManifest,
}

#[derive(Deserialize)]
struct AppVersionManifest {
    latest: String,
    #[serde(default)]
    download_url_windows: String,
    #[serde(default)]
    download_url_mac: String,
    #[serde(default)]
    download_url_linux: String,
    #[serde(default)]
    changelog_url: String,
}

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

#[tauri::command]
pub async fn check_updates(
    manifest_url: String,
    install_dir: String,
    tier: String,
) -> Result<UpdateCheckResult, String> {
    let client = reqwest::Client::new();
    let manifest: serde_json::Value = client
        .get(&manifest_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let config_path = PathBuf::from(&install_dir).join("backend/config.json");
    let config: serde_json::Value = if config_path.exists() {
        let raw = std::fs::read_to_string(&config_path).unwrap_or_default();
        serde_json::from_str(&raw).unwrap_or_default()
    } else {
        serde_json::json!({ "installed_models": {} })
    };

    let installed = config["installed_models"].as_object().cloned().unwrap_or_default();

    let mut updates: Vec<ModelUpdate> = Vec::new();

    if let Some(tier_models) = manifest["tiers"][&tier]["models"].as_array() {
        for model in tier_models {
            let id = model["id"].as_str().unwrap_or_default().to_string();
            let latest_version = model["version"].as_str().unwrap_or("0.0.0").to_string();
            let current_version = installed
                .get(&id)
                .and_then(|v| v["version"].as_str())
                .unwrap_or("0.0.0")
                .to_string();

            if current_version != latest_version {
                updates.push(ModelUpdate {
                    id,
                    name: model["name"].as_str().unwrap_or_default().to_string(),
                    current_version,
                    latest_version,
                    size_gb: model["size_gb"].as_f64().unwrap_or(0.0) as f32,
                    changelog: model["changelog"].as_str().unwrap_or_default().to_string(),
                });
            }
        }
    }

    // Check app version
    let latest_app = manifest["app_version"]["latest"].as_str().unwrap_or(APP_VERSION);
    let app_update = if latest_app != APP_VERSION {
        let download_url = if cfg!(target_os = "windows") {
            manifest["app_version"]["download_url_windows"].as_str().unwrap_or_default()
        } else if cfg!(target_os = "macos") {
            manifest["app_version"]["download_url_mac"].as_str().unwrap_or_default()
        } else {
            manifest["app_version"]["download_url_linux"].as_str().unwrap_or_default()
        };
        Some(AppUpdate {
            current: APP_VERSION.to_string(),
            latest: latest_app.to_string(),
            download_url: download_url.to_string(),
            changelog_url: manifest["app_version"]["changelog_url"]
                .as_str().unwrap_or_default().to_string(),
        })
    } else {
        None
    };

    Ok(UpdateCheckResult { updates, app_update })
}

#[tauri::command]
pub async fn apply_update(
    model_id: String,
    download_url: String,
    dest_path: String,
    expected_sha256: Option<String>,
    install_dir: String,
) -> Result<String, String> {
    let dest = PathBuf::from(&dest_path);

    // Backup existing model
    if dest.exists() {
        let backup_dir = PathBuf::from(&install_dir).join("models/backup");
        std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
        let backup_dest = backup_dir.join(dest.file_name().unwrap_or_default());
        std::fs::rename(&dest, &backup_dest).map_err(|e| e.to_string())?;
    }

    // Download new version to temp path
    let tmp = dest.with_extension("tmp");
    let client = reqwest::Client::new();
    let response = client.get(&download_url).send().await.map_err(|e| e.to_string())?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;

    // Verify SHA256
    if let Some(expected) = expected_sha256 {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let hash = hex::encode(hasher.finalize());
        if hash != expected.to_lowercase() {
            std::fs::remove_file(&tmp).ok();
            // Rollback
            let backup = PathBuf::from(&install_dir)
                .join("models/backup")
                .join(dest.file_name().unwrap_or_default());
            if backup.exists() {
                std::fs::rename(&backup, &dest).ok();
            }
            return Err(format!("SHA256 mismatch for {}: expected {} got {}", model_id, expected, hash));
        }
    }

    // Move tmp to final
    std::fs::rename(&tmp, &dest).map_err(|e| e.to_string())?;

    // Update config.json version
    let config_path = PathBuf::from(&install_dir).join("backend/config.json");
    if let Ok(raw) = std::fs::read_to_string(&config_path) {
        if let Ok(mut config) = serde_json::from_str::<serde_json::Value>(&raw) {
            if let Some(models) = config["installed_models"].as_object_mut() {
                models.entry(&model_id).or_insert(serde_json::json!({}))
                    ["version"] = serde_json::json!(download_url); // placeholder version
            }
            let _ = std::fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap());
        }
    }

    Ok(dest_path)
}
