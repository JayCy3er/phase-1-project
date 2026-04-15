import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface SystemInfo {
  gpu_name: string;
  vram_gb: number;
  total_ram_gb: number;
  free_disk_gb: number;
  os: string;
  gpu_vendor: string;
  wsl2: boolean;
}

type Status = 'ok' | 'warn' | 'fail';

function grade(value: number, ok: number, warn: number): Status {
  if (value >= ok) return 'ok';
  if (value >= warn) return 'warn';
  return 'fail';
}

const STATUS_ICON: Record<Status, string> = { ok: '✅', warn: '⚠️', fail: '❌' };
const STATUS_COLOR: Record<Status, string> = {
  ok:   'text-green-400',
  warn: 'text-yellow-400',
  fail: 'text-red-400',
};

interface Props {
  onNext: (info: SystemInfo) => void;
  onBack: () => void;
}

export default function SystemScan({ onNext, onBack }: Props) {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    invoke<SystemInfo>('scan_system')
      .then(result => { setInfo(result); setScanning(false); })
      .catch(e => { setError(String(e)); setScanning(false); });
  }, []);

  const rows = info ? [
    { label: 'GPU',  value: `${info.gpu_name} (${info.gpu_vendor})`, sub: `${info.vram_gb.toFixed(0)}GB VRAM`, status: grade(info.vram_gb, 16, 8) },
    { label: 'RAM',  value: `${info.total_ram_gb.toFixed(0)}GB`,      sub: '',                                    status: grade(info.total_ram_gb, 16, 8) },
    { label: 'Disk', value: `${info.free_disk_gb.toFixed(0)}GB free`, sub: '',                                    status: grade(info.free_disk_gb, 60, 30) },
    { label: 'OS',   value: info.os,                                   sub: info.wsl2 ? 'WSL2 ✅' : '',           status: 'ok' as Status },
  ] : [];

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6">
        <h1 className="text-2xl font-bold">Checking your system…</h1>

        {scanning && (
          <div className="flex items-center gap-3 text-white/50">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            Scanning hardware…
          </div>
        )}

        {error && <p className="text-red-400">{error}</p>}

        {info && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
            {rows.map((row, i) => (
              <div
                key={row.label}
                className={`flex items-center gap-4 px-4 py-3 ${i < rows.length - 1 ? 'border-b border-[#2a2a2a]' : ''}`}
              >
                <span className="w-12 text-sm text-white/40 font-mono">{row.label}</span>
                <div className="flex-1">
                  <div className="text-sm text-white">{row.value}</div>
                  {row.sub && <div className="text-xs text-white/40">{row.sub}</div>}
                </div>
                <span className={`text-sm font-semibold ${STATUS_COLOR[row.status]}`}>
                  {STATUS_ICON[row.status]}
                </span>
              </div>
            ))}
          </div>
        )}

        {info && (
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => onNext(info)}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold text-sm transition-colors"
            >
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
