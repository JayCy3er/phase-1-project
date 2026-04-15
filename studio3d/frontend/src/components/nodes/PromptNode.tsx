'use client';
import React, { useCallback } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { NodeBase } from './NodeBase';
import type { NodeState } from '@/lib/workflow';

interface Props {
  id: string;
  data: { label?: string; text?: string; _state?: NodeState };
}

export default function PromptNode({ id, data }: Props) {
  const { updateNodeData } = useReactFlow();
  const text = data.text ?? '';

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { text: e.target.value });
    },
    [id, updateNodeData],
  );

  return (
    <NodeBase accentColor="#3b82f6" label="Prompt" state={data._state}>
      <textarea
        value={text}
        onChange={onChange}
        rows={4}
        placeholder="Enter your prompt…"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-blue-500"
      />
      <div className="text-[10px] text-white/30 text-right mt-0.5">{text.length} chars</div>
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        style={{ background: '#3b82f6', width: 10, height: 10 }}
      />
    </NodeBase>
  );
}
