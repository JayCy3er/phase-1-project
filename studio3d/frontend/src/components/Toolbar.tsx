'use client';
import React from 'react';

interface NodeButton {
  type: string;
  label: string;
  icon: string;
  accentColor: string;
}

const NODE_BUTTONS: NodeButton[] = [
  { type: 'prompt',      label: 'Prompt',      icon: '📝', accentColor: '#3b82f6' },
  { type: 'imageupload', label: 'Image Upload', icon: '📁', accentColor: '#6b7280' },
  { type: 'flux',        label: 'Image Gen',    icon: '🖼', accentColor: '#8b5cf6' },
  { type: 'trellis',     label: '3D Model',     icon: '🧊', accentColor: '#f97316' },
  { type: 'ltxvideo',    label: 'Video',        icon: '🎬', accentColor: '#22c55e' },
  { type: 'chatterbox',  label: 'Voice',        icon: '🔊', accentColor: '#ec4899' },
  { type: 'merge',       label: 'Merge',        icon: '🔀', accentColor: '#eab308' },
  { type: 'output',      label: 'Output',       icon: '⬇', accentColor: '#14b8a6' },
];

interface Props {
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}

export default function Toolbar({ onDragStart }: Props) {
  return (
    <aside className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1.5">
      {NODE_BUTTONS.map(btn => (
        <div
          key={btn.type}
          draggable
          onDragStart={e => onDragStart(e, btn.type)}
          className="flex flex-col items-center gap-0.5 w-14 py-2 px-1 rounded-xl cursor-grab active:cursor-grabbing bg-node border border-border hover:border-white/20 transition-colors select-none"
          title={btn.label}
        >
          <div
            className="w-1 h-5 rounded-full mb-1 self-center"
            style={{ background: btn.accentColor }}
          />
          <span className="text-base leading-none">{btn.icon}</span>
          <span className="text-[9px] text-white/50 text-center leading-tight mt-0.5">
            {btn.label}
          </span>
        </div>
      ))}
    </aside>
  );
}
