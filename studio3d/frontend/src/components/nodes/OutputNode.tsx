'use client';
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeBase } from './NodeBase';
import { outputUrl } from '@/lib/api';
import type { NodeState } from '@/lib/workflow';

interface Props {
  id: string;
  data: { label?: string; _state?: NodeState };
}

function fileIcon(url: string): string {
  if (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.webp')) return '🖼';
  if (url.endsWith('.mp4')) return '🎬';
  if (url.endsWith('.glb')) return '🧊';
  if (url.endsWith('.wav') || url.endsWith('.mp3')) return '🔊';
  return '📄';
}

function fileName(url: string): string {
  return url.split('/').pop() ?? url;
}

export default function OutputNode({ id, data }: Props) {
  const state = data._state;
  const resultUrl = state?.resultUrl ? outputUrl(state.resultUrl) : undefined;

  const copyUrl = () => {
    if (resultUrl) navigator.clipboard.writeText(resultUrl);
  };

  return (
    <NodeBase accentColor="#14b8a6" label={data.label ?? 'Output'} state={state}>
      <Handle type="target" position={Position.Left} id="input"
        style={{ background: '#14b8a6', width: 10, height: 10 }} />

      {resultUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg">{fileIcon(resultUrl)}</span>
            <span className="text-white/70 text-xs truncate">{fileName(resultUrl)}</span>
          </div>
          <a
            href={resultUrl}
            download
            className="block w-full text-center py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-xs font-semibold text-white transition-colors"
          >
            ⬇ Download
          </a>
          <button
            onClick={copyUrl}
            className="block w-full text-center py-1 text-[10px] text-teal-400 hover:text-teal-300"
          >
            Copy URL
          </button>
        </div>
      ) : (
        <p className="text-[10px] text-white/30">Waiting for result…</p>
      )}

      {state?.error && (
        <p className="text-[10px] text-red-400 mt-1 break-words">{state.error}</p>
      )}
    </NodeBase>
  );
}
