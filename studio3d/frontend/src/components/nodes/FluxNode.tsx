'use client';
import React from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { NodeBase } from './NodeBase';
import { outputUrl } from '@/lib/api';
import type { NodeState } from '@/lib/workflow';

const SIZES = [512, 768, 1024];

interface Props {
  id: string;
  data: {
    label?: string;
    width?: number;
    height?: number;
    guidanceScale?: number;
    steps?: number;
    _state?: NodeState;
  };
}

export default function FluxNode({ id, data }: Props) {
  const { updateNodeData } = useReactFlow();
  const state = data._state;
  const resultUrl = state?.resultUrl ? outputUrl(state.resultUrl) : undefined;

  return (
    <NodeBase accentColor="#8b5cf6" label="FLUX Image Gen" state={state}>
      <Handle type="target" position={Position.Left} id="text"
        style={{ background: '#3b82f6', width: 10, height: 10 }} />

      {/* Settings */}
      <div className="flex gap-2 mb-2">
        <label className="flex-1 text-[10px] text-white/50">
          W
          <select
            value={data.width ?? 1024}
            onChange={e => updateNodeData(id, { width: Number(e.target.value) })}
            className="w-full mt-0.5 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-xs text-white"
          >
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex-1 text-[10px] text-white/50">
          H
          <select
            value={data.height ?? 1024}
            onChange={e => updateNodeData(id, { height: Number(e.target.value) })}
            className="w-full mt-0.5 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-xs text-white"
          >
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {/* Result thumbnail */}
      {resultUrl && (
        <div className="mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="Generated" className="max-w-[200px] rounded border border-white/10 mx-auto block" />
          <a
            href={resultUrl}
            download="flux_result.png"
            className="mt-1 block text-center text-[10px] text-purple-400 hover:text-purple-300"
          >
            Download PNG
          </a>
        </div>
      )}

      {state?.error && (
        <p className="text-[10px] text-red-400 mt-1 break-words">{state.error}</p>
      )}

      <Handle type="source" position={Position.Right} id="image"
        style={{ background: '#8b5cf6', width: 10, height: 10 }} />
    </NodeBase>
  );
}
