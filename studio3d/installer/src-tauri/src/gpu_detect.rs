use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SystemInfo {
    pub gpu_name: String,
    pub vram_gb: f32,
    pub total_ram_gb: f32,
    pub free_disk_gb: f32,
    pub os: String,
    pub gpu_vendor: String, // "AMD" | "NVIDIA" | "Apple" | "Unknown"
    pub wsl2: bool,
}

#[tauri::command]
pub async fn scan_system() -> Result<SystemInfo, String> {
    let os = detect_os();
    let (gpu_name, vram_gb, gpu_vendor) = detect_gpu(&os);
    let total_ram_gb = detect_ram();
    let free_disk_gb = detect_disk();
    let wsl2 = detect_wsl2();

    Ok(SystemInfo {
        gpu_name,
        vram_gb,
        total_ram_gb,
        free_disk_gb,
        os,
        gpu_vendor,
        wsl2,
    })
}

fn detect_os() -> String {
    if cfg!(target_os = "windows") {
        "Windows".to_string()
    } else if cfg!(target_os = "macos") {
        "macOS".to_string()
    } else {
        "Linux".to_string()
    }
}

fn detect_wsl2() -> bool {
    if let Ok(version) = std::fs::read_to_string("/proc/version") {
        return version.to_lowercase().contains("microsoft");
    }
    false
}

fn detect_gpu(os: &str) -> (String, f32, String) {
    match os {
        "Windows" => detect_gpu_windows(),
        "macOS" => detect_gpu_macos(),
        _ => detect_gpu_linux(),
    }
}

fn detect_gpu_windows() -> (String, f32, String) {
    let output = Command::new("wmic")
        .args(["path", "win32_VideoController", "get", "Name,AdapterRAM", "/format:csv"])
        .output();

    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines().skip(2) {
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 3 {
                let name = parts[1].trim().to_string();
                let vram_bytes: u64 = parts[2].trim().parse().unwrap_or(0);
                let vram_gb = vram_bytes as f32 / (1024.0_f32.powi(3));
                let vendor = classify_vendor(&name);
                return (name, vram_gb, vendor);
            }
        }
    }
    ("Unknown GPU".to_string(), 0.0, "Unknown".to_string())
}

fn detect_gpu_linux() -> (String, f32, String) {
    // Try nvidia-smi first
    if let Ok(out) = Command::new("nvidia-smi")
        .args(["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
        .output()
    {
        let text = String::from_utf8_lossy(&out.stdout);
        let line = text.lines().next().unwrap_or("").trim();
        if !line.is_empty() {
            let parts: Vec<&str> = line.splitn(2, ',').collect();
            if parts.len() == 2 {
                let name = parts[0].trim().to_string();
                let vram_mb: f32 = parts[1].trim().parse().unwrap_or(0.0);
                return (name, vram_mb / 1024.0, "NVIDIA".to_string());
            }
        }
    }

    // Try ROCm / AMD
    if let Ok(out) = Command::new("rocm-smi")
        .args(["--showproductname", "--showmeminfo", "vram", "--csv"])
        .output()
    {
        let text = String::from_utf8_lossy(&out.stdout);
        let mut name = "AMD GPU".to_string();
        let mut vram_gb = 0.0f32;
        for line in text.lines() {
            if line.contains("Card series") {
                name = line.split(',').last().unwrap_or("AMD GPU").trim().to_string();
            }
            if line.contains("Total Memory") {
                let bytes: u64 = line.split(',').last().unwrap_or("0").trim().parse().unwrap_or(0);
                vram_gb = bytes as f32 / (1024.0_f32.powi(3));
            }
        }
        return (name, vram_gb, "AMD".to_string());
    }

    // Fallback: read from /sys
    if let Ok(entries) = std::fs::read_dir("/sys/class/drm") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("card") && !name.contains('-') {
                let mem_path = entry.path().join("device/mem_info_vram_total");
                if let Ok(bytes_str) = std::fs::read_to_string(&mem_path) {
                    let bytes: u64 = bytes_str.trim().parse().unwrap_or(0);
                    let vram_gb = bytes as f32 / (1024.0_f32.powi(3));
                    return (format!("AMD GPU ({})", name), vram_gb, "AMD".to_string());
                }
            }
        }
    }

    ("Unknown GPU".to_string(), 0.0, "Unknown".to_string())
}

fn detect_gpu_macos() -> (String, f32, String) {
    let output = Command::new("system_profiler")
        .arg("SPDisplaysDataType")
        .output();

    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stdout);
        let mut name = "Apple GPU".to_string();
        let mut vram_gb = 0.0f32;
        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("Chipset Model:") {
                name = trimmed.replace("Chipset Model:", "").trim().to_string();
            }
            if trimmed.starts_with("VRAM") {
                // "VRAM (Total): 16 GB"
                if let Some(gb_str) = trimmed.split_whitespace().rev().nth(1) {
                    vram_gb = gb_str.parse().unwrap_or(0.0);
                }
            }
        }
        return (name.clone(), vram_gb, classify_vendor(&name));
    }

    ("Apple GPU".to_string(), 16.0, "Apple".to_string())
}

fn classify_vendor(name: &str) -> String {
    let lower = name.to_lowercase();
    if lower.contains("nvidia") || lower.contains("geforce") || lower.contains("quadro") {
        "NVIDIA".to_string()
    } else if lower.contains("amd") || lower.contains("radeon") || lower.contains("rx ") {
        "AMD".to_string()
    } else if lower.contains("apple") || lower.contains("m1") || lower.contains("m2") || lower.contains("m3") {
        "Apple".to_string()
    } else {
        "Unknown".to_string()
    }
}

fn detect_ram() -> f32 {
    // Linux / WSL2
    if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
        for line in content.lines() {
            if line.starts_with("MemTotal:") {
                let kb: u64 = line.split_whitespace().nth(1).unwrap_or("0").parse().unwrap_or(0);
                return kb as f32 / (1024.0 * 1024.0);
            }
        }
    }
    // Windows
    #[cfg(target_os = "windows")]
    {
        if let Ok(out) = Command::new("wmic")
            .args(["ComputerSystem", "get", "TotalPhysicalMemory", "/format:value"])
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if line.starts_with("TotalPhysicalMemory=") {
                    let bytes: u64 = line.replace("TotalPhysicalMemory=", "").trim().parse().unwrap_or(0);
                    return bytes as f32 / (1024.0_f32.powi(3));
                }
            }
        }
    }
    0.0
}

fn detect_disk() -> f32 {
    // Get free space on the install drive
    let path = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/"));
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if let Ok(stat) = nix_statvfs(&path) {
            return stat;
        }
    }
    // Fallback
    if let Ok(out) = Command::new("df")
        .args(["-BG", "--output=avail", path.to_str().unwrap_or("/")])
        .output()
    {
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines().skip(1) {
            let gb_str = line.trim().trim_end_matches('G');
            return gb_str.parse().unwrap_or(0.0);
        }
    }
    100.0 // assume plenty if detection fails
}

#[cfg(unix)]
fn nix_statvfs(path: &std::path::Path) -> Result<f32, ()> {
    let output = Command::new("df")
        .args(["-k", "--output=avail", path.to_str().unwrap_or("/")])
        .output()
        .map_err(|_| ())?;
    let text = String::from_utf8_lossy(&output.stdout);
    let kb: u64 = text.lines().nth(1).unwrap_or("0").trim().parse().unwrap_or(0);
    Ok(kb as f32 / (1024.0 * 1024.0))
}
