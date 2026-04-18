'use client';
import React from 'react';
import { useReactFlow } from '@xyflow/react';
import type { NodeState } from '@/lib/workflow';

interface NodeBaseProps {
  id: string;
  accentColor: string;
  label: string;
  state?: NodeState;
  children: React.ReactNode;
}

export function NodeBase({ id, accentColor, label, state, children }: NodeBaseProps) {
  const { deleteElements } = useReactFlow();

  return (
    <div className="studio-node" style={{ minWidth: 220 }}>
      <div className="studio-node-accent" style={{ background: accentColor }} />
      <div className="px-3 pt-5 pb-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
            {label}
          </span>
          <div className="flex items-center gap-1.5">
            <StatusDot state={state} />
            <button
              onClick={() => deleteElements({ nodes: [{ id }] })}
              className="w-4 h-4 flex items-center justify-center rounded text-white/30 hover:text-red-400 hover:bg-white/10 transition-colors"
              title="Delete node"
            >
              ✕
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusDot({ state }: { state?: NodeState }) {
  if (!state || state.status === 'idle') {
    return <span className="w-2.5 h-2.5 rounded-full bg-white/25 inline-block" />;
  }
  if (state.status === 'queued') {
    return (
      <span className="text-[10px] font-bold text-amber-400">
        #{state.queuePosition ?? '?'}
      </span>
    );
  }
  if (state.status === 'running') {
    return (
      <svg className="w-4 h-4 text-amber-400 status-spinner" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" />
      </svg>
    );
  }
  if (state.status === 'done') {
    return (
      <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state.status === 'error') {
    return (
      <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none">
        <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}
