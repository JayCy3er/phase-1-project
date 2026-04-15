import React from 'react';
import type { InstallConfig } from '../App';

interface Props {
  config: InstallConfig;
  onChange: (partial: Partial<InstallConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function CloudAPIKeys({ config, onChange, onNext, onBack }: Props) {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Enter your API keys</h1>
          <p className="text-white/50 text-sm mt-1">
            Studio3D uses these services for AI generation. You only pay when you generate.
          </p>
        </div>

        <div className="space-y-4">
          <KeyField
            label="fal.ai API Key"
            value={config.falApiKey}
            onChange={v => onChange({ falApiKey: v })}
            placeholder="fal_…"
            linkText="Get free API key →"
            linkHref="#"
          />
          <KeyField
            label="3D AI Studio API Key"
            value={config.threedApiKey}
            onChange={v => onChange({ threedApiKey: v })}
            placeholder="3das_…"
            linkText="Get API key →"
            linkHref="#"
          />
          <KeyField
            label="HuggingFace Token"
            value={config.hfToken}
            onChange={v => onChange({ hfToken: v })}
            placeholder="hf_…"
            linkText="Get token →"
            linkHref="#"
          />
        </div>

        <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
          💡 Chatterbox TTS (voice) downloads locally for free — no API key needed.
          Estimated cost per full run: ~$0.25–$0.75.
        </div>

        <div className="bg-white/5 rounded-lg p-3 text-xs text-white/40">
          Estimated cost per generation:
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
            <span>Image (FLUX)</span><span>~$0.05</span>
            <span>3D Model</span><span>~$0.10</span>
            <span>Video (LTX)</span><span>~$0.10–0.30</span>
            <span>Voice (local)</span><span>$0.00</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onBack} className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-white/60 transition-colors">
            ← Back
          </button>
          <button
            onClick={onNext}
            disabled={!config.falApiKey || !config.threedApiKey}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold text-sm transition-colors"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

function KeyField({
  label, value, onChange, placeholder, linkText, linkHref,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  linkText: string;
  linkHref: string;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-white/80">{label}</label>
        <a href={linkHref} className="text-xs text-purple-400 hover:text-purple-300">{linkText}</a>
      </div>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500 pr-12"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs"
        >
          {show ? 'hide' : 'show'}
        </button>
      </div>
    </div>
  );
}
