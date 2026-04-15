import React from 'react';
import type { SystemInfo } from './SystemScan';

type Tier = 'full' | 'lite' | 'cloud';

interface TierCard {
  id: Tier;
  title: string;
  size: string;
  description: string;
  models: string[];
  requires: string;
  accent: string;
  minVram: number;
  minDisk: number;
}

const TIERS: TierCard[] = [
  {
    id: 'full',
    title: 'Full Install',
    size: '~45GB',
    description: 'Best quality. All models run locally.',
    models: [
      'FLUX.1 Dev — Best image quality (24GB)',
      'TRELLIS-2 — 3D model generation (8GB)',
      'LTX-Video 2B — Video generation (6GB)',
      'Chatterbox TTS — Voice synthesis (2GB)',
    ],
    requires: '60GB+ disk, 16GB+ VRAM',
    accent: 'border-purple-500',
    minVram: 16,
    minDisk: 60,
  },
  {
    id: 'lite',
    title: 'Lite Install',
    size: '~25GB',
    description: 'Great quality. Faster download.',
    models: [
      'SD 3.5 Medium — Good image quality (5GB)',
      'TRELLIS-2 — 3D model generation (8GB)',
      'LTX-Video 2B — Video generation (6GB)',
      'Chatterbox TTS — Voice synthesis (2GB)',
    ],
    requires: '30GB+ disk, 8GB+ VRAM',
    accent: 'border-blue-500',
    minVram: 8,
    minDisk: 30,
  },
  {
    id: 'cloud',
    title: 'Cloud Mode',
    size: '~0GB',
    description: 'No downloads. Uses API keys.',
    models: [
      'fal.ai — Image + video generation',
      '3D AI Studio — 3D models',
      'Chatterbox TTS — Voice (2GB, local)',
    ],
    requires: 'Any GPU · ~$0.25–0.75/generation',
    accent: 'border-gray-500',
    minVram: 0,
    minDisk: 2,
  },
];

interface Props {
  systemInfo: SystemInfo | null;
  selected: Tier;
  onSelect: (tier: Tier) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function TierSelect({ systemInfo, selected, onSelect, onNext, onBack }: Props) {
  const recommended = ((): Tier => {
    if (!systemInfo) return 'full';
    if (systemInfo.vram_gb >= 16 && systemInfo.free_disk_gb >= 60) return 'full';
    if (systemInfo.vram_gb >= 8  && systemInfo.free_disk_gb >= 30) return 'lite';
    return 'cloud';
  })();

  const canSelect = (tier: TierCard): boolean => {
    if (!systemInfo) return true;
    return systemInfo.vram_gb >= tier.minVram && systemInfo.free_disk_gb >= tier.minDisk;
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-6">
        <h1 className="text-2xl font-bold">Choose your install type</h1>

        <div className="space-y-3">
          {TIERS.map(tier => {
            const enabled = canSelect(tier);
            const isRecommended = tier.id === recommended;
            const isSelected = selected === tier.id;

            return (
              <button
                key={tier.id}
                onClick={() => enabled && onSelect(tier.id)}
                disabled={!enabled}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected ? tier.accent : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                } ${!enabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} bg-[#1a1a1a]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                      isSelected ? 'border-purple-400 bg-purple-400' : 'border-white/20'
                    }`} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{tier.title}</span>
                        <span className="text-xs text-white/40">{tier.size}</span>
                        {isRecommended && enabled && (
                          <span className="text-[10px] bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded-full font-medium">
                            RECOMMENDED FOR YOUR SYSTEM
                          </span>
                        )}
                        {!enabled && (
                          <span className="text-[10px] bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full">
                            INSUFFICIENT HARDWARE
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/50 mt-0.5">{tier.description}</p>
                      <ul className="mt-2 space-y-0.5">
                        {tier.models.map(m => (
                          <li key={m} className="text-xs text-white/40">• {m}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-white/30 mt-2">Requires: {tier.requires}</p>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={onBack} className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-white/60 transition-colors">
            ← Back
          </button>
          <button onClick={onNext} className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold text-sm transition-colors">
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
