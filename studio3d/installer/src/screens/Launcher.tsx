import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { InstallConfig } from '../App';

interface ServiceStatus { redis: boolean; api: boolean; worker: boolean; }
interface VramInfo { used_gb: number; total_gb: number; }
interface ModelUpdate { id: string; name: string; current_version: string; latest_version: string; size_gb: number; changelog: string; }

interface Props { config: InstallConfig; }

export default function Launcher({ config }: Props) {
  const [services, setServices]   = useState<ServiceStatus>({ redis: false, api: false, worker: false });
  const [vram, setVram]           = useState<VramInfo>({ used_gb: 0, total_gb: 24 });
  const [updates, setUpdates]     = useState<ModelUpdate[]>([]);
  const [loading, setLoading]     = useState(false);
  const [lastChecked, setLastChecked] = useState('');

  useEffect(() => {
    // Poll service status + VRAM every 5 seconds
    const poll = async () => {
      const [svc, vramInfo] = await Promise.all([
        invoke<ServiceStatus>('get_service_status').catch(() => ({ redis: false, api: false, worker: false })),
        invoke<VramInfo>('get_vram_usage').catch(() => ({ used_gb: 0, total_gb: 24 })),
      ]);
      setServices(svc);
      setVram(vramInfo);
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  const handleStart = async () => {
    setLoading(true);
    const svc = await invoke<ServiceStatus>('start_services', { installDir: config.installDir || '.' }).catch(() => null);
    if (svc) setServices(svc);
    setLoading(false);
  };

  const handleStop = async () => {
    await invoke('stop_services');
    setServices({ redis: false, api: false, worker: false });
  };

  const handleCheckUpdates = async () => {
    const result = await invoke<{ updates: ModelUpdate[] }>('check_updates', {
      manifestUrl: 'https://yourdomain.com/studio3d-models.json',
      installDir: config.installDir || '.',
      tier: config.tier,
    }).catch(() => null);
    if (result) setUpdates(result.updates);
    setLastChecked(new Date().toLocaleTimeString());
  };

  const openStudio = () => {
    window.open('http://localhost:3000', '_blank');
  };

  const vramPct = vram.total_gb > 0 ? (vram.used_gb / vram.total_gb) * 100 : 0;
  const allRunning = services.redis && services.api && services.worker;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-sm w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold">🎨 Studio3D</span>
          <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/50">
            {config.tier === 'full' ? 'Full' : config.tier === 'lite' ? 'Lite' : 'Cloud'} v1.0.0
          </span>
        </div>

        {/* Services */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-2">
          {[
            { label: 'Backend API',   running: services.api,    detail: 'port 8000' },
            { label: 'Celery Worker', running: services.worker, detail: '' },
            { label: 'Redis',         running: services.redis,  detail: '' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.running ? 'bg-green-400' : 'bg-white/20'}`} />
              <span className="text-sm flex-1">{s.label}</span>
              {s.running && s.detail && <span className="text-xs text-white/30">({s.detail})</span>}
              {!s.running && <span className="text-xs text-white/30">Stopped</span>}
            </div>
          ))}
        </div>

        {/* VRAM */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-xs text-white/40 mb-1">GPU: VRAM Usage</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${vramPct}%` }}
              />
            </div>
            <span className="text-xs text-white/60 whitespace-nowrap">
              {vram.used_gb.toFixed(1)} / {vram.total_gb.toFixed(0)} GB
            </span>
          </div>
        </div>

        {/* Updates panel */}
        {updates.length > 0 && (
          <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-4 space-y-2">
            <div className="text-sm font-semibold text-blue-300">
              🔄 {updates.length} Model Update{updates.length > 1 ? 's' : ''} Available
            </div>
            {updates.map(u => (
              <div key={u.id} className="text-xs text-white/60 flex justify-between">
                <span>• {u.name}</span>
                <span>{u.current_version} → {u.latest_version} ({u.size_gb}GB)</span>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setUpdates([])} className="px-3 py-1 text-xs bg-white/5 rounded text-white/50">
                Skip
              </button>
              <button className="flex-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white font-medium transition-colors">
                Update Selected ▶
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={openStudio}
            disabled={!allRunning}
            className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
          >
            🚀 Open Studio3D
          </button>
          {allRunning ? (
            <button onClick={handleStop} className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-white/70 transition-colors">
              ⏹ Stop Services
            </button>
          ) : (
            <button onClick={handleStart} disabled={loading} className="w-full py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-xl text-sm text-white/70 transition-colors">
              {loading ? 'Starting…' : '▶ Start Services'}
            </button>
          )}
          <button onClick={handleCheckUpdates} className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-white/70 transition-colors">
            🔄 Check Updates
          </button>
        </div>

        {lastChecked && (
          <p className="text-[10px] text-white/20 text-center">Last checked: {lastChecked}</p>
        )}
      </div>
    </div>
  );
}
