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

export default function MergeNode({ id, data }: Props) {
  const state = data._state;
  const resultUrl = state?.resultUrl ? outputUrl(state.resultUrl) : undefined;

  return (
    <NodeBase accentColor="#eab308" label="FFmpeg Merge" state={state}>
      {/* Two input handles */}
      <Handle type="target" position={Position.Left} id="video"
        style={{ background: '#22c55e', width: 10, height: 10, top: '35%' }} />
      <Handle type="target" position={Position.Left} id="audio"
        style={{ background: '#ec4899', width: 10, height: 10, top: '65%' }} />

      <div className="text-[10px] text-white/30 mb-2 space-y-0.5">
        <div>▸ video <span className="text-green-400">● </span></div>
        <div>▸ audio <span className="text-pink-400">● </span></div>
      </div>

      {resultUrl && (
        <div className="mt-1">
          <video
            src={resultUrl}
            controls
            className="max-w-full rounded border border-white/10"
          />
          <a
            href={resultUrl}
            download="final_result.mp4"
            className="mt-1 block text-center text-[10px] text-yellow-400 hover:text-yellow-300"
          >
            Download Final MP4
          </a>
        </div>
      )}

      {state?.error && (
        <p className="text-[10px] text-red-400 mt-1 break-words">{state.error}</p>
      )}

      <Handle type="source" position={Position.Right} id="video"
        style={{ background: '#eab308', width: 10, height: 10 }} />
    </NodeBase>
  );
}
