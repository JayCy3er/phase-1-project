use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use tokio::io::AsyncWriteExt;
use futures_util::StreamExt;
use tauri::ipc::Channel;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DownloadProgress {
    pub download_id: String,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub speed_bps: f64,
    pub eta_secs: f64,
    pub done: bool,
    pub error: Option<String>,
}

// Global pause state: download_id -> paused
static PAUSED: Mutex<Option<HashMap<String, bool>>> = Mutex::new(None);

fn paused_map() -> std::sync::MutexGuard<'static, Option<HashMap<String, bool>>> {
    PAUSED.lock().unwrap()
}

fn is_paused(id: &str) -> bool {
    let guard = paused_map();
    guard.as_ref().map(|m| *m.get(id).unwrap_or(&false)).unwrap_or(false)
}

fn set_paused(id: &str, val: bool) {
    let mut guard = paused_map();
    let map = guard.get_or_insert_with(HashMap::new);
    map.insert(id.to_string(), val);
}

#[tauri::command]
pub async fn pause_download(download_id: String) {
    set_paused(&download_id, true);
}

#[tauri::command]
pub async fn resume_download(download_id: String) {
    set_paused(&download_id, false);
}

#[tauri::command]
pub async fn download_file(
    url: String,
    dest_path: String,
    expected_sha256: Option<String>,
    download_id: String,
    on_progress: Channel<DownloadProgress>,
) -> Result<String, String> {
    set_paused(&download_id, false);

    let dest = PathBuf::from(&dest_path);
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }

    // Check for existing partial download (resume support)
    let existing_bytes = tokio::fs::metadata(&dest).await.map(|m| m.len()).unwrap_or(0);

    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    if existing_bytes > 0 {
        req = req.header("Range", format!("bytes={}-", existing_bytes));
    }

    let response = req.send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() && response.status().as_u16() != 206 {
        return Err(format!("HTTP {}: {}", response.status(), url));
    }

    let total_bytes = response
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0)
        + existing_bytes;

    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&dest)
        .await
        .map_err(|e| e.to_string())?;

    let mut bytes_downloaded = existing_bytes;
    let mut stream = response.bytes_stream();
    let start = std::time::Instant::now();

    while let Some(chunk) = stream.next().await {
        // Pause loop
        while is_paused(&download_id) {
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        }

        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        bytes_downloaded += chunk.len() as u64;

        let elapsed = start.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 {
            (bytes_downloaded - existing_bytes) as f64 / elapsed
        } else {
            0.0
        };
        let remaining = total_bytes.saturating_sub(bytes_downloaded);
        let eta = if speed > 0.0 { remaining as f64 / speed } else { 0.0 };

        let _ = on_progress.send(DownloadProgress {
            download_id: download_id.clone(),
            bytes_downloaded,
            total_bytes,
            speed_bps: speed,
            eta_secs: eta,
            done: false,
            error: None,
        });
    }

    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    // SHA256 verification
    if let Some(expected) = expected_sha256 {
        let hash = sha256_file(&dest).await?;
        if hash != expected.to_lowercase() {
            tokio::fs::remove_file(&dest).await.ok();
            return Err(format!("SHA256 mismatch: expected {} got {}", expected, hash));
        }
    }

    let _ = on_progress.send(DownloadProgress {
        download_id: download_id.clone(),
        bytes_downloaded,
        total_bytes,
        speed_bps: 0.0,
        eta_secs: 0.0,
        done: true,
        error: None,
    });

    Ok(dest_path)
}

async fn sha256_file(path: &PathBuf) -> Result<String, String> {
    let data = tokio::fs::read(path).await.map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(hex::encode(hasher.finalize()))
}
