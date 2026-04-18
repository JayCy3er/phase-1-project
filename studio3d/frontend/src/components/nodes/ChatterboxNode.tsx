'use client';
import React, { useEffect, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { NodeBase } from './NodeBase';
import { listVoices, deleteVoice, uploadVoice, voicePreviewUrl, outputUrl, type Voice } from '@/lib/api';
import type { NodeState } from '@/lib/workflow';

interface Props {
  id: string;
  data: {
    label?: string;
    voiceId?: string;
    emotion?: number;
    speed?: number;
    language?: string;
    _state?: NodeState;
  };
}

const LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh'];

export default function ChatterboxNode({ id, data }: Props) {
  const { updateNodeData } = useReactFlow();
  const state = data._state;
  const resultUrl = state?.resultUrl ? outputUrl(state.resultUrl) : undefined;

  const [voices, setVoices] = useState<Voice[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);

  useEffect(() => {
    listVoices().then(setVoices).catch(() => {});
  }, []);

  const handleUpload = async () => {
    const name = window.prompt('Voice name:');
    if (!name) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/wav,audio/mpeg';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const result = await uploadVoice(file, name);
      setVoices(v => [...v, { id: result.id, name: result.name, style: 'Custom', lang: 'en', category: 'custom', preview_url: voicePreviewUrl(result.id) }]);
    };
    input.click();
  };

  const handleDelete = async (voiceId: string) => {
    if (!window.confirm('Delete this voice?')) return;
    await deleteVoice(voiceId);
    setVoices(v => v.filter(x => x.id !== voiceId));
  };

  const selectedVoice = voices.find(v => v.id === (data.voiceId ?? 'narrator'));

  return (
    <NodeBase id={id} accentColor="#ec4899" label="Chatterbox Voice" state={state}>
      <Handle type="target" position={Position.Left} id="text"
        style={{ background: '#3b82f6', width: 10, height: 10 }} />

      {/* Selected voice display */}
      <button
        onClick={() => setShowLibrary(v => !v)}
        className="w-full text-left text-xs bg-black/40 border border-white/10 rounded px-2 py-1.5 mb-2 flex items-center justify-between"
      >
        <span>{selectedVoice?.name ?? 'Select voice…'}</span>
        <span className="text-white/40">▾</span>
      </button>

      {/* Voice library panel */}
      {showLibrary && (
        <div className="mb-2 border border-white/10 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
          <div className="px-2 py-1 bg-white/5 text-[10px] text-white/50 font-semibold uppercase tracking-wider flex justify-between items-center">
            Voice Library
            <button onClick={handleUpload} className="text-pink-400 hover:text-pink-300">+ Add</button>
          </div>
          {['preset', 'custom'].map(cat => {
            const group = voices.filter(v => v.category === cat);
            if (group.length === 0) return null;
            return (
              <div key={cat}>
                <div className="px-2 py-0.5 text-[10px] text-white/30 uppercase tracking-wider bg-white/3">
                  {cat === 'preset' ? 'Presets' : 'Custom'}
                </div>
                {group.map(v => (
                  <div
                    key={v.id}
                    className={`flex items-center gap-1 px-2 py-1 hover:bg-white/5 cursor-pointer ${v.id === data.voiceId ? 'bg-pink-500/10' : ''}`}
                    onClick={() => { updateNodeData(id, { voiceId: v.id }); setShowLibrary(false); }}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); new Audio(voicePreviewUrl(v.id)).play(); }}
                      className="text-white/40 hover:text-white mr-1"
                    >▶</button>
                    <span className="flex-1 text-xs text-white">{v.name}</span>
                    <span className="text-[10px] text-white/30 w-28 truncate">{v.style}</span>
                    <span className="text-[10px] text-white/30 uppercase w-6">{v.lang}</span>
                    {v.id === data.voiceId && <span className="text-pink-400 text-xs">✓</span>}
                    {cat === 'custom' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(v.id); }}
                        className="text-red-400/60 hover:text-red-400 ml-1 text-xs"
                      >🗑</button>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Emotion slider */}
      <label className="text-[10px] text-white/50 block mb-1">
        Emotion: Neutral → Dramatic
        <input
          type="range" min={0} max={1} step={0.05}
          value={data.emotion ?? 0.5}
          onChange={e => updateNodeData(id, { emotion: Number(e.target.value) })}
          className="w-full mt-0.5 accent-pink-500"
        />
      </label>

      {/* Speed slider */}
      <label className="text-[10px] text-white/50 block mb-1">
        Speed: {data.speed ?? 1.0}×
        <input
          type="range" min={0.5} max={1.5} step={0.05}
          value={data.speed ?? 1.0}
          onChange={e => updateNodeData(id, { speed: Number(e.target.value) })}
          className="w-full mt-0.5 accent-pink-500"
        />
      </label>

      {/* Language */}
      <label className="text-[10px] text-white/50 block mb-2">
        Language
        <select
          value={data.language ?? 'en'}
          onChange={e => updateNodeData(id, { language: e.target.value })}
          className="w-full mt-0.5 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-xs text-white"
        >
          {LANGUAGES.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </label>

      {/* Result player */}
      {resultUrl && (
        <div className="mt-1">
          <audio controls src={resultUrl} className="w-full h-8" />
          <a
            href={resultUrl}
            download="voice_result.wav"
            className="mt-1 block text-center text-[10px] text-pink-400 hover:text-pink-300"
          >
            Download WAV
          </a>
        </div>
      )}

      {state?.error && (
        <p className="text-[10px] text-red-400 mt-1 break-words">{state.error}</p>
      )}

      <Handle type="source" position={Position.Right} id="audio"
        style={{ background: '#ec4899', width: 10, height: 10 }} />
    </NodeBase>
  );
}
