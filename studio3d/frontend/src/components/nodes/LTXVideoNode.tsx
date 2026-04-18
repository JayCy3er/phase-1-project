'use client';
import React from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { NodeBase } from './NodeBase';
import { outputUrl } from '@/lib/api';
import type { NodeState } from '@/lib/workflow';

interface Props {
  id: string;
  data: { label?: string; duration?: number; fps?: number; _state?: NodeState };
}

export default function LTXVideoNode({ id, data }: Props) {
  const { updateNodeData } = useReactFlow();
  const state = data._state;
  const resultUrl = state?.resultUrl ? outputUrl(state.resultUrl) : undefined;

  return (
    <NodeBase id={id} accentColor="#22c55e" label="LTX Video" state={state}>
      <Handle type="target" position={Position.Left} id="image"
        style={{ background: '#8b5cf6', width: 10, height: 10 }} />

      <div className="flex gap-3 mb-2">
        <label className="flex-1 text-[10px] text-white/50">
          Duration (s)
          <input
            type="range" min={2} max={8} step={1}
            value={data.duration ?? 4}
            onChange={e => updateNodeData(id, { duration: Number(e.target.value) })}
            className="w-full mt-0.5 accent-green-500"
          />
          <span className="text-white">{data.duration ?? 4}s</span>
        </label>
        <label className="flex-1 text-[10px] text-white/50">
          FPS
          <select
            value={data.fps ?? 24}
            onChange={e => updateNodeData(id, { fps: Number(e.target.value) })}
            className="w-full mt-0.5 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-xs text-white"
          >
            <option value={24}>24</option>
            <option value={30}>30</option>
          </select>
        </label>
      </div>

      {resultUrl && (
        <div className="mt-2">
          <video
            src={resultUrl}
            muted loop autoPlay playsInline
            className="max-w-full rounded border border-white/10"
          />
          <a
            href={resultUrl}
            download="ltx_result.mp4"
            className="mt-1 block text-center text-[10px] text-green-400 hover:text-green-300"
          >
            Download MP4
          </a>
        </div>
      )}

      {state?.error && (
        <p className="text-[10px] text-red-400 mt-1 break-words">{state.error}</p>
      )}

      <Handle type="source" position={Position.Right} id="video"
        style={{ background: '#22c55e', width: 10, height: 10 }} />
    </NodeBase>
  );
}
