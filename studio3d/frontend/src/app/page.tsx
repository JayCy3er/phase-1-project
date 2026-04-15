'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TopBar from '@/components/TopBar';
import Toolbar from '@/components/Toolbar';
import PromptNode from '@/components/nodes/PromptNode';
import ImageUploadNode from '@/components/nodes/ImageUploadNode';
import FluxNode from '@/components/nodes/FluxNode';
import TrellisNode from '@/components/nodes/TrellisNode';
import LTXVideoNode from '@/components/nodes/LTXVideoNode';
import ChatterboxNode from '@/components/nodes/ChatterboxNode';
import MergeNode from '@/components/nodes/MergeNode';
import OutputNode from '@/components/nodes/OutputNode';

import {
  runWorkflow,
  saveWorkflow,
  loadWorkflow,
  autoSave,
  loadFromLocalStorage,
  buildDefaultTemplate,
  type NodeStateMap,
} from '@/lib/workflow';

// ---------------------------------------------------------------------------
// Node type registry
// ---------------------------------------------------------------------------
const NODE_TYPES: NodeTypes = {
  prompt:      PromptNode,
  imageupload: ImageUploadNode,
  flux:        FluxNode,
  trellis:     TrellisNode,
  ltxvideo:    LTXVideoNode,
  chatterbox:  ChatterboxNode,
  merge:       MergeNode,
  output:      OutputNode,
};

// Default data for new nodes dropped from the toolbar
const DEFAULT_NODE_DATA: Record<string, Record<string, unknown>> = {
  prompt:      { label: 'Prompt',        text: '' },
  imageupload: { label: 'Image Upload' },
  flux:        { label: 'FLUX Image Gen', width: 1024, height: 1024 },
  trellis:     { label: 'TRELLIS 3D' },
  ltxvideo:    { label: 'LTX Video',     duration: 4, fps: 24 },
  chatterbox:  { label: 'Chatterbox Voice', voiceId: 'narrator', emotion: 0.5, speed: 1.0, language: 'en' },
  merge:       { label: 'FFmpeg Merge' },
  output:      { label: 'Output' },
};

let _nodeIdCounter = 100;
function nextId() { return `node_${++_nodeIdCounter}`; }

// ---------------------------------------------------------------------------
// Inner canvas (needs ReactFlowProvider)
// ---------------------------------------------------------------------------
function Studio3DCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [nodeStates, setNodeStates] = useState<NodeStateMap>({});
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Merge _state into each node's data before rendering
  const nodesWithState = nodes.map(n => ({
    ...n,
    data: { ...n.data, _state: nodeStates[n.id] ?? { status: 'idle', progress: 0 } },
  }));

  // ---------------------------------------------------------------------------
  // Load initial workflow
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const saved = loadFromLocalStorage();
    if (saved) {
      setNodes(saved.nodes);
      setEdges(saved.edges);
    } else {
      const { nodes: dn, edges: de } = buildDefaultTemplate();
      setNodes(dn);
      setEdges(de);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-save
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      autoSave(nodes, edges);
    }, 30_000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [nodes, edges]);

  // ---------------------------------------------------------------------------
  // Edge connection
  // ---------------------------------------------------------------------------
  const onConnect = useCallback(
    (params: Connection) => setEdges(es => addEdge({ ...params, animated: false }, es)),
    [setEdges],
  );

  // ---------------------------------------------------------------------------
  // Drag-and-drop from toolbar
  // ---------------------------------------------------------------------------
  const onDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/studio3d-node', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/studio3d-node');
      if (!type || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 110,
        y: event.clientY - bounds.top - 40,
      };

      const newNode: Node = {
        id: nextId(),
        type,
        position,
        data: { ...(DEFAULT_NODE_DATA[type] ?? { label: type }) },
      };
      setNodes(ns => [...ns, newNode]);
    },
    [setNodes],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // ---------------------------------------------------------------------------
  // Run workflow
  // ---------------------------------------------------------------------------
  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);

    // Reset all node states
    setNodeStates({});

    try {
      await runWorkflow(nodes, edges, {
        onNodeStateChange: (nodeId, state) => {
          setNodeStates(prev => ({ ...prev, [nodeId]: state }));
        },
        onEdgeAnimating: (edgeId, animating) => {
          setEdges(es => es.map(e =>
            e.id === edgeId ? { ...e, className: animating ? 'edge-flowing' : '' } : e,
          ));
        },
        onError: (msg) => {
          alert(`Workflow error:\n${msg}`);
        },
      });
    } catch {
      // Individual node errors are shown in their UI
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, nodes, edges, setEdges]);

  // ---------------------------------------------------------------------------
  // Save / Load / Clear
  // ---------------------------------------------------------------------------
  const handleSave = useCallback(() => saveWorkflow(nodes, edges), [nodes, edges]);

  const handleLoad = useCallback(async () => {
    try {
      const snapshot = await loadWorkflow();
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      setNodeStates({});
    } catch (err) {
      alert(String(err));
    }
  }, [setNodes, setEdges]);

  const handleClear = useCallback(() => {
    if (window.confirm('Clear the canvas? This cannot be undone.')) {
      setNodes([]);
      setEdges([]);
      setNodeStates({});
    }
  }, [setNodes, setEdges]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="w-screen h-screen bg-canvas overflow-hidden relative" ref={reactFlowWrapper}>
      <TopBar
        onRun={handleRun}
        onSave={handleSave}
        onLoad={handleLoad}
        onClear={handleClear}
        isRunning={isRunning}
      />

      <div className="absolute inset-0 pt-12">
        <ReactFlow
          nodes={nodesWithState}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={NODE_TYPES}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#2a2a2a" gap={24} />
          <Controls className="!bg-node !border-border !text-white" />
          <MiniMap
            className="!bg-node !border-border"
            nodeColor={() => '#2a2a2a'}
            maskColor="rgba(0,0,0,0.6)"
          />
        </ReactFlow>
      </div>

      <Toolbar onDragStart={onDragStart} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export (wraps in ReactFlowProvider)
// ---------------------------------------------------------------------------
export default function Page() {
  return (
    <ReactFlowProvider>
      <Studio3DCanvas />
    </ReactFlowProvider>
  );
}
