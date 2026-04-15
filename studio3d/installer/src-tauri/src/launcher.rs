use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;

// Global child process handles
static PROCESSES: Mutex<Option<HashMap<String, Child>>> = Mutex::new(None);

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ServiceStatus {
    pub redis: bool,
    pub api: bool,
    pub worker: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VramInfo {
    pub used_gb: f32,
    pub total_gb: f32,
}

#[tauri::command]
pub async fn start_services(install_dir: String) -> Result<ServiceStatus, String> {
    let dir = PathBuf::from(&install_dir);
    let python = dir.join(".venv/bin/python");
    let celery = dir.join(".venv/bin/celery");

    let mut procs = PROCESSES.lock().unwrap();
    let map = procs.get_or_insert_with(HashMap::new);

    let env = [
        ("HSA_OVERRIDE_GFX_VERSION", "11.0.0"),
        ("HIP_VISIBLE_DEVICES", "0"),
        ("ROCR_VISIBLE_DEVICES", "0"),
        ("REDIS_URL", "redis://localhost:6379"),
    ];

    // Start Redis (use system redis-server or bundled binary)
    if !map.contains_key("redis") {
        let redis = Command::new("redis-server")
            .current_dir(&dir)
            .spawn()
            .map_err(|e| format!("Failed to start Redis: {}", e))?;
        map.insert("redis".to_string(), redis);
    }

    // Give Redis a moment to start
    std::thread::sleep(std::time::Duration::from_millis(500));

    // Start FastAPI
    if !map.contains_key("api") {
        let backend_dir = dir.join("backend");
        let mut api_cmd = Command::new(python.to_str().unwrap());
        api_cmd.args(["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"])
               .current_dir(&backend_dir);
        for (k, v) in &env { api_cmd.env(k, v); }
        let api = api_cmd.spawn().map_err(|e| format!("Failed to start API: {}", e))?;
        map.insert("api".to_string(), api);
    }

    // Start Celery worker
    if !map.contains_key("worker") {
        let backend_dir = dir.join("backend");
        let mut celery_cmd = Command::new(celery.to_str().unwrap());
        celery_cmd.args(["-A", "tasks", "worker", "--loglevel=info", "--concurrency=1"])
                  .current_dir(&backend_dir);
        for (k, v) in &env { celery_cmd.env(k, v); }
        let worker = celery_cmd.spawn().map_err(|e| format!("Failed to start worker: {}", e))?;
        map.insert("worker".to_string(), worker);
    }

    Ok(ServiceStatus { redis: true, api: true, worker: true })
}

#[tauri::command]
pub async fn stop_services() -> Result<(), String> {
    let mut procs = PROCESSES.lock().unwrap();
    if let Some(map) = procs.as_mut() {
        for (name, child) in map.iter_mut() {
            if let Err(e) = child.kill() {
                eprintln!("Failed to kill {}: {}", name, e);
            }
        }
        map.clear();
    }
    Ok(())
}

#[tauri::command]
pub async fn get_service_status() -> ServiceStatus {
    let mut procs = PROCESSES.lock().unwrap();
    let map = match procs.as_mut() {
        Some(m) => m,
        None => return ServiceStatus { redis: false, api: false, worker: false },
    };

    // Check if each child is still alive (try_wait returns None if still running)
    let redis_alive  = map.get_mut("redis").map(|c| c.try_wait().map(|s| s.is_none()).unwrap_or(false)).unwrap_or(false);
    let api_alive    = map.get_mut("api").map(|c| c.try_wait().map(|s| s.is_none()).unwrap_or(false)).unwrap_or(false);
    let worker_alive = map.get_mut("worker").map(|c| c.try_wait().map(|s| s.is_none()).unwrap_or(false)).unwrap_or(false);

    ServiceStatus {
        redis:  redis_alive,
        api:    api_alive,
        worker: worker_alive,
    }
}

#[tauri::command]
pub async fn get_vram_usage() -> VramInfo {
    // Try ROCm
    if let Ok(out) = Command::new("rocm-smi")
        .args(["--showmeminfo", "vram", "--csv"])
        .env("HSA_OVERRIDE_GFX_VERSION", "11.0.0")
        .output()
    {
        let text = String::from_utf8_lossy(&out.stdout);
        let mut used = 0u64;
        let mut total = 0u64;
        for line in text.lines() {
            if line.contains("Used") {
                used = line.split(',').last().unwrap_or("0").trim().parse().unwrap_or(0);
            }
            if line.contains("Total") {
                total = line.split(',').last().unwrap_or("0").trim().parse().unwrap_or(0);
            }
        }
        return VramInfo {
            used_gb:  used  as f32 / (1024.0_f32.powi(3)),
            total_gb: total as f32 / (1024.0_f32.powi(3)),
        };
    }

    // Try NVIDIA
    if let Ok(out) = Command::new("nvidia-smi")
        .args(["--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"])
        .output()
    {
        let text = String::from_utf8_lossy(&out.stdout);
        let line = text.lines().next().unwrap_or("0, 0");
        let parts: Vec<f32> = line.split(',').map(|s| s.trim().parse().unwrap_or(0.0)).collect();
        if parts.len() >= 2 {
            return VramInfo {
                used_gb:  parts[0] / 1024.0,
                total_gb: parts[1] / 1024.0,
            };
        }
    }

    VramInfo { used_gb: 0.0, total_gb: 24.0 }
}
