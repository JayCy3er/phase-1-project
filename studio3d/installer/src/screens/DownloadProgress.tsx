import React, { useEffect, useRef, useState } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import type { InstallConfig } from '../App';

interface ComponentRow {
  id: string;
  label: string;
  size: string;
  bytes: number;
  progress: number; // 0–100
  status: 'queued' | 'downloading' | 'done' | 'skipped';
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)}MB`;
  return `${(n / 1024 ** 3).toFixed(2)}GB`;
}

function fmtEta(secs: number): string {
  if (!isFinite(secs) || secs <= 0) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m > 0 ? `~${m}m ${s}s remaining` : `~${s}s remaining`;
}

interface Props {
  config: InstallConfig;
  onComplete: () => void;
}

export default function DownloadProgress({ config, onComplete }: Props) {
  const [components, setComponents] = useState<ComponentRow[]>(() => buildRows(config.tier));
  const [overallProgress, setOverallProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runInstall();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runInstall() {
    // Step 1: Python deps
    const logChannel = new Channel<{ step: string; message: string; done: boolean; error?: string }>();
    logChannel.onmessage = (msg) => {
      const id = `dep_${msg.step}`;
      setComponents(prev => prev.map(r =>
        r.id === id ? { ...r, status: msg.done ? 'done' : 'downloading', progress: msg.done ? 100 : 50 } : r
      ));
    };

    try {
      await invoke('install_python_deps', {
        installDir: config.installDir || process.cwd(),
        gpuVendor: config.systemInfo?.gpu_vendor ?? 'Unknown',
        tier: config.tier,
        hfToken: config.hfToken,
        onLog: logChannel,
      });
    } catch (e) {
      console.error('Python deps install failed:', e);
    }

    // Step 2: Download models
    const modelComponents = components.filter(c => c.id.startsWith('model_'));
    for (const comp of modelComponents) {
      setCurrentId(comp.id);
      setComponents(prev => prev.map(r => r.id === comp.id ? { ...r, status: 'downloading' } : r));

      const progChannel = new Channel<{
        download_id: string;
        bytes_downloaded: number;
        total_bytes: number;
        speed_bps: number;
        eta_secs: number;
        done: boolean;
      }>();

      progChannel.onmessage = (p) => {
        if (p.download_id !== comp.id) return;
        const pct = p.total_bytes > 0 ? Math.round((p.bytes_downloaded / p.total_bytes) * 100) : 0;
        setSpeed(p.speed_bps);
        setEta(p.eta_secs);
        setComponents(prev => {
          const updated = prev.map(r =>
            r.id === comp.id
              ? { ...r, progress: pct, status: p.done ? 'done' : 'downloading' as const }
              : r
          );
          const totalPct = updated.reduce((sum, r) => sum + (r.status === 'done' ? 100 : r.progress), 0) / updated.length;
          setOverallProgress(Math.round(totalPct));
          return updated;
        });
      };

      if (comp.bytes > 0) {
        try {
          await invoke('download_file', {
            url: modelUrl(comp.id, config.tier),
            destPath: `${config.installDir || '.'}/models/${comp.id.replace('model_', '')}/model.bin`,
            expectedSha256: null,
            downloadId: comp.id,
            onProgress: progChannel,
          });
        } catch (e) {
          console.error(`Download failed for ${comp.id}:`, e);
        }
      } else {
        // Skip (cloud mode models)
        setComponents(prev => prev.map(r => r.id === comp.id ? { ...r, status: 'skipped', progress: 100 } : r));
      }
    }

    onComplete();
  }

  const togglePause = async () => {
    if (paused) {
      await invoke('resume_download', { downloadId: currentId });
      setPaused(false);
    } else {
      await invoke('pause_download', { downloadId: currentId });
      setPaused(true);
    }
  };

  const totalBytes = components.reduce((s, r) => s + r.bytes, 0);
  const downloadedBytes = components.reduce((s, r) => s + (r.bytes * r.progress / 100), 0);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-5">
        <h1 className="text-2xl font-bold">Installing Studio3D</h1>

        {/* Overall progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-white/50">
            <span>{fmtBytes(downloadedBytes)} of {fmtBytes(totalBytes)}</span>
            <span>{fmtBytes(speed)}/s {fmtEta(eta)}</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Component rows */}
        <div className="space-y-2">
          {components.map(comp => (
            <div key={comp.id} className="flex items-center gap-3">
              <span className="text-xs text-white/60 w-40 truncate">{comp.label}</span>
              <span className="text-[10px] text-white/30 w-12 text-right">{comp.size}</span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    comp.status === 'done'        ? 'bg-green-500' :
                    comp.status === 'downloading' ? 'bg-purple-500' :
                    comp.status === 'skipped'     ? 'bg-white/20'  : 'bg-white/5'
                  }`}
                  style={{ width: `${comp.progress}%` }}
                />
              </div>
              <span className="text-[10px] text-white/40 w-16 text-right">
                {comp.status === 'done'        ? 'Done ✅' :
                 comp.status === 'downloading' ? `${comp.progress}%` :
                 comp.status === 'skipped'     ? 'Skipped' : 'Queued'}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-white/30">
          You can close this window — installation continues in background.
        </p>

        <div className="flex gap-3">
          <button
            onClick={togglePause}
            className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('Cancel installation?')) setCancelled(true);
            }}
            className="px-4 py-2 rounded-lg text-sm bg-red-900/30 hover:bg-red-800/30 text-red-300 transition-colors"
          >
            ✕ Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function buildRows(tier: string): ComponentRow[] {
  const base: ComponentRow[] = [
    { id: 'dep_python', label: 'Python 3.11 runtime',   size: '80MB',  bytes: 80*1024*1024,      progress: 0, status: 'queued' },
    { id: 'dep_torch',  label: `PyTorch (ROCm)`,        size: '2.5GB', bytes: 2500*1024*1024,    progress: 0, status: 'queued' },
    { id: 'dep_deps',   label: 'Dependencies',           size: '1.5GB', bytes: 1500*1024*1024,    progress: 0, status: 'queued' },
  ];

  if (tier === 'full') {
    base.push(
      { id: 'model_flux',       label: 'FLUX.1 Dev',        size: '24GB', bytes: 24*1024**3, progress: 0, status: 'queued' },
      { id: 'model_trellis',    label: 'TRELLIS-2',          size: '8GB',  bytes:  8*1024**3, progress: 0, status: 'queued' },
      { id: 'model_ltx',        label: 'LTX-Video 2B',       size: '6GB',  bytes:  6*1024**3, progress: 0, status: 'queued' },
      { id: 'model_chatterbox', label: 'Chatterbox TTS',     size: '2GB',  bytes:  2*1024**3, progress: 0, status: 'queued' },
      { id: 'model_voices',     label: 'Preset Voice Library', size: '50MB', bytes: 50*1024*1024, progress: 0, status: 'queued' },
    );
  } else if (tier === 'lite') {
    base.push(
      { id: 'model_sd35',       label: 'SD 3.5 Medium',      size: '5GB',  bytes:  5*1024**3, progress: 0, status: 'queued' },
      { id: 'model_trellis',    label: 'TRELLIS-2',          size: '8GB',  bytes:  8*1024**3, progress: 0, status: 'queued' },
      { id: 'model_ltx',        label: 'LTX-Video 2B',       size: '6GB',  bytes:  6*1024**3, progress: 0, status: 'queued' },
      { id: 'model_chatterbox', label: 'Chatterbox TTS',     size: '2GB',  bytes:  2*1024**3, progress: 0, status: 'queued' },
      { id: 'model_voices',     label: 'Preset Voice Library', size: '50MB', bytes: 50*1024*1024, progress: 0, status: 'queued' },
    );
  } else {
    // cloud — only chatterbox
    base.push(
      { id: 'model_chatterbox', label: 'Chatterbox TTS',     size: '2GB',  bytes:  2*1024**3, progress: 0, status: 'queued' },
      { id: 'model_voices',     label: 'Preset Voice Library', size: '50MB', bytes: 50*1024*1024, progress: 0, status: 'queued' },
    );
  }

  return base;
}

function modelUrl(id: string, _tier: string): string {
  // In production these would come from studio3d-models.json
  // HuggingFace URLs for direct model downloads are constructed at runtime
  const HF_BASE = 'https://huggingface.co';
  const map: Record<string, string> = {
    'model_flux':       `${HF_BASE}/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors`,
    'model_sd35':       `${HF_BASE}/stabilityai/stable-diffusion-3.5-medium/resolve/main/sd3.5_medium.safetensors`,
    'model_trellis':    `${HF_BASE}/microsoft/TRELLIS-image-large/resolve/main/model.safetensors`,
    'model_ltx':        `${HF_BASE}/Lightricks/LTX-Video-0.9.7-distilled/resolve/main/ltx-video-2b-v0.9.7-distilled.safetensors`,
    'model_chatterbox': `${HF_BASE}/resemble-ai/chatterbox/resolve/main/model.pth`,
  };
  return map[id] ?? '';
}
