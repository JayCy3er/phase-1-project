'use client';
import React, { useEffect, useState } from 'react';
import { getSystemStatus, type SystemStatus } from '@/lib/api';

interface Props {
  onRun: () => void;
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  isRunning: boolean;
}

export default function TopBar({ onRun, onSave, onLoad, onClear, isRunning }: Props) {
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    const poll = () => {
      getSystemStatus().then(setSysStatus).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  const vramPct = sysStatus
    ? Math.round((sysStatus.vram_used_gb / sysStatus.vram_total_gb) * 100)
    : 0;

  return (
    <header className="absolute top-0 left-0 right-0 z-10 flex items-center h-12 px-4 bg-node border-b border-border">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-6">
        <span className="text-lg font-bold tracking-tight text-white">Studio3D</span>
        <span className="text-[10px] text-white/30 font-mono">v1.0.0</span>
      </div>

      {/* Run button + queue status */}
      <div className="flex-1 flex items-center justify-center gap-3">
        <button
          onClick={onRun}
          disabled={isRunning}
          className={`px-5 py-1.5 rounded-lg font-semibold text-sm transition-colors ${
            isRunning
              ? 'bg-green-800 text-green-200 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-500 text-white'
          }`}
        >
          {isRunning ? '⏳ Running…' : '▶ Run Workflow'}
        </button>

        {sysStatus && (
          <span className="text-[10px] text-white/40">
            {sysStatus.queued_jobs + sysStatus.running_jobs > 0
              ? `${sysStatus.queued_jobs + sysStatus.running_jobs} job(s) · `
              : ''}
            GPU: {sysStatus.vram_used_gb.toFixed(1)} / {sysStatus.vram_total_gb.toFixed(0)}GB
            <span className="ml-1.5 inline-block w-16 h-1.5 bg-white/10 rounded-full align-middle">
              <span
                className="inline-block h-full bg-green-500 rounded-full"
                style={{ width: `${vramPct}%` }}
              />
            </span>
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <TopBarBtn onClick={onSave} label="💾 Save" />
        <TopBarBtn onClick={onLoad} label="📂 Load" />
        <TopBarBtn onClick={onClear} label="🗑 Clear" danger />
      </div>
    </header>
  );
}

function TopBarBtn({
  onClick,
  label,
  danger,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
        danger
          ? 'bg-red-900/40 hover:bg-red-700/40 text-red-300'
          : 'bg-white/5 hover:bg-white/10 text-white/70'
      }`}
    >
      {label}
    </button>
  );
}
