import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { InstallConfig } from '../App';

interface Props {
  config: InstallConfig;
  onLaunch: () => void;
}

export default function Complete({ config, onLaunch }: Props) {
  const [launchOnStartup, setLaunchOnStartup] = useState(false);

  const handleLaunch = async () => {
    // Start services then open browser
    await invoke('start_services', { installDir: config.installDir || '.' });
    onLaunch();
  };

  const sizeLabel = config.tier === 'full' ? '~45GB' : config.tier === 'lite' ? '~25GB' : '~2GB';
  const tierLabel = config.tier === 'full' ? 'Full Install' : config.tier === 'lite' ? 'Lite Install' : 'Cloud Mode';

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Success checkmark */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-400" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold">Studio3D is ready!</h1>
          <p className="text-white/40 text-sm mt-1">Installation complete</p>
        </div>

        {/* Summary */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 text-left space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-white/40">Tier</span>
            <span className="text-white font-medium">{tierLabel}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/40">Total size</span>
            <span className="text-white font-medium">{sizeLabel}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/40">Location</span>
            <span className="text-white font-medium truncate ml-4">{config.installDir || '~/studio3d'}</span>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-white/50 justify-center cursor-pointer">
          <input
            type="checkbox"
            checked={launchOnStartup}
            onChange={e => setLaunchOnStartup(e.target.checked)}
            className="rounded"
          />
          Launch Studio3D on startup
        </label>

        <button
          onClick={handleLaunch}
          className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-semibold text-lg transition-colors"
        >
          🚀 Launch Studio3D
        </button>

        <button
          onClick={() => invoke('open_folder', { path: config.installDir || '.' }).catch(() => {})}
          className="text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          Open Install Folder
        </button>
      </div>
    </div>
  );
}
