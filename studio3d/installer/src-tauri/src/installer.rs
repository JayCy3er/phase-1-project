use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use tauri::ipc::Channel;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InstallLog {
    pub step: String,
    pub message: String,
    pub done: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn install_python_deps(
    install_dir: String,
    gpu_vendor: String,
    tier: String,
    hf_token: String,
    on_log: Channel<InstallLog>,
) -> Result<(), String> {
    let dir = PathBuf::from(&install_dir);

    macro_rules! log {
        ($step:expr, $msg:expr) => {
            let _ = on_log.send(InstallLog {
                step: $step.to_string(),
                message: $msg.to_string(),
                done: false,
                error: None,
            });
        };
    }
    macro_rules! log_done {
        ($step:expr) => {
            let _ = on_log.send(InstallLog {
                step: $step.to_string(),
                message: "Done".to_string(),
                done: true,
                error: None,
            });
        };
    }

    // 1. Create venv
    log!("python", "Creating Python virtual environment…");
    run_cmd(
        "python3",
        &["-m", "venv", dir.join(".venv").to_str().unwrap()],
        &dir,
        None,
    )?;
    log_done!("python");

    let pip = dir.join(".venv/bin/pip");
    let python = dir.join(".venv/bin/python");

    // 2. Upgrade pip
    log!("pip", "Upgrading pip…");
    run_cmd(pip.to_str().unwrap(), &["install", "--upgrade", "pip", "-q"], &dir, None)?;

    // 3. Install PyTorch based on GPU vendor
    let torch_index = match gpu_vendor.as_str() {
        "AMD"    => "https://download.pytorch.org/whl/rocm6.1",
        "NVIDIA" => "https://download.pytorch.org/whl/cu121",
        _        => "https://download.pytorch.org/whl/cpu",
    };

    log!("torch", format!("Installing PyTorch ({} build)…", gpu_vendor));
    run_cmd(
        pip.to_str().unwrap(),
        &["install", "torch", "torchvision", "torchaudio",
          "--index-url", torch_index, "-q"],
        &dir,
        None,
    )?;
    log_done!("torch");

    // 4. Install other requirements
    let req_path = dir.join("backend/requirements.txt");
    if req_path.exists() {
        log!("deps", "Installing Python dependencies…");
        run_cmd(
            pip.to_str().unwrap(),
            &["install", "-r", req_path.to_str().unwrap(), "-q"],
            &dir,
            None,
        )?;
        log_done!("deps");
    }

    // 5. Write config.json
    let config = serde_json::json!({
        "tier": tier,
        "installed_models": {},
        "gpu_vendor": gpu_vendor,
    });
    let config_path = dir.join("backend/config.json");
    std::fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap())
        .map_err(|e| e.to_string())?;

    log_done!("config");
    Ok(())
}

fn run_cmd(
    program: &str,
    args: &[&str],
    cwd: &PathBuf,
    env_extra: Option<Vec<(&str, &str)>>,
) -> Result<(), String> {
    let mut cmd = Command::new(program);
    cmd.args(args).current_dir(cwd);

    // Always set ROCm env var
    cmd.env("HSA_OVERRIDE_GFX_VERSION", "11.0.0");

    if let Some(envs) = env_extra {
        for (k, v) in envs {
            cmd.env(k, v);
        }
    }

    let output = cmd.output().map_err(|e| format!("Failed to run {}: {}", program, e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("{} failed:\n{}", program, stderr));
    }
    Ok(())
}
