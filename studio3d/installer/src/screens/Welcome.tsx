import React from 'react';

interface Props { onNext: () => void; }

export default function Welcome({ onNext }: Props) {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <div className="space-y-2">
          <div className="text-6xl font-black tracking-tight">
            Studio<span className="text-purple-500">3D</span>
          </div>
          <p className="text-white/50 text-lg">Your local AI creative studio</p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { icon: '🖼', label: 'Image', color: 'bg-purple-900/40 text-purple-300' },
            { icon: '🧊', label: '3D',    color: 'bg-orange-900/40 text-orange-300' },
            { icon: '🎬', label: 'Video', color: 'bg-green-900/40 text-green-300' },
            { icon: '🔊', label: 'Voice', color: 'bg-pink-900/40 text-pink-300' },
          ].map(f => (
            <span key={f.label} className={`px-4 py-1.5 rounded-full text-sm font-medium ${f.color}`}>
              {f.icon} {f.label}
            </span>
          ))}
        </div>

        <p className="text-white/40 text-sm leading-relaxed">
          Generate images, 3D models, videos, and voice — all running locally
          on your GPU. No subscriptions. No cloud fees. Full privacy.
        </p>

        <button
          onClick={onNext}
          className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold text-lg transition-colors"
        >
          Get Started →
        </button>

        <p className="text-white/20 text-xs">
          Requires: 8GB+ VRAM · 16GB+ RAM · 30GB+ disk
        </p>
      </div>
    </div>
  );
}
