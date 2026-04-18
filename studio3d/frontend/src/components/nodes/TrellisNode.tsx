'use client';
import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeBase } from './NodeBase';
import { outputUrl } from '@/lib/api';
import type { NodeState } from '@/lib/workflow';

interface Props {
  id: string;
  data: { label?: string; _state?: NodeState };
}

export default function TrellisNode({ id, data }: Props) {
  const [expanded, setExpanded] = useState(false);
  const state = data._state;
  const resultUrl = state?.resultUrl ? outputUrl(state.resultUrl) : undefined;

  return (
    <NodeBase id={id} accentColor="#f97316" label="TRELLIS 3D" state={state}>
      <Handle type="target" position={Position.Left} id="image"
        style={{ background: '#8b5cf6', width: 10, height: 10 }} />

      {resultUrl && (
        <div className="mt-2">
          <div
            className="cursor-pointer"
            style={{ width: expanded ? 300 : 200, height: expanded ? 300 : 200 }}
            onClick={() => setExpanded(v => !v)}
          >
            {/* model-viewer web component — loaded via CDN in layout.tsx */}
            {/* @ts-expect-error model-viewer is a custom element */}
            <model-viewer
              src={resultUrl}
              auto-rotate
              camera-controls
              style={{ width: '100%', height: '100%', background: 'transparent' }}
            />
          </div>
          <a
            href={resultUrl}
            download="trellis_result.glb"
            className="mt-1 block text-center text-[10px] text-orange-400 hover:text-orange-300"
          >
            Download GLB
          </a>
        </div>
      )}

      {state?.error && (
        <p className="text-[10px] text-red-400 mt-1 break-words">{state.error}</p>
      )}

      <Handle type="source" position={Position.Right} id="model"
        style={{ background: '#f97316', width: 10, height: 10 }} />
    </NodeBase>
  );
}
