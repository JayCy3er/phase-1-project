'use client';
import React, { useCallback, useRef } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { NodeBase } from './NodeBase';
import type { NodeState } from '@/lib/workflow';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface Props {
  id: string;
  data: { label?: string; uploadedUrl?: string; thumbnail?: string; _state?: NodeState };
}

export default function ImageUploadNode({ id, data }: Props) {
  const { updateNodeData } = useReactFlow();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // Upload to backend outputs via a simple form-data POST
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API}/upload/image`, { method: 'POST', body: form });
      if (res.ok) {
        const { url } = await res.json();
        updateNodeData(id, { uploadedUrl: url, thumbnail: url });
      } else {
        // Fallback: create object URL for local preview
        const objectUrl = URL.createObjectURL(file);
        updateNodeData(id, { uploadedUrl: objectUrl, thumbnail: objectUrl });
      }
    },
    [id, updateNodeData],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <NodeBase id={id} accentColor="#6b7280" label="Image Upload" state={data._state}>
      <div
        className="border-2 border-dashed border-white/20 rounded-lg p-3 text-center cursor-pointer hover:border-white/40 transition-colors"
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        {data.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.thumbnail} alt="Uploaded" className="max-h-32 mx-auto rounded" />
        ) : (
          <span className="text-xs text-white/40">Drop PNG/JPG/WEBP here<br />or click to upload</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onInput}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        style={{ background: '#8b5cf6', width: 10, height: 10 }}
      />
    </NodeBase>
  );
}
