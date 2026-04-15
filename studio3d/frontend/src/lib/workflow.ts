/**
 * DAG execution engine for Studio3D.
 *
 * Responsibilities:
 *  - Validate all required connections
 *  - Topological sort (Kahn's algorithm)
 *  - Find parallel groups
 *  - Execute groups sequentially, nodes within a group in parallel
 *  - Persist / restore workflows from JSON + localStorage
 */
import type { Node, Edge } from '@xyflow/react';
import {
  generateImage,
  generate3D,
  generateVideo,
  generateVoice,
  generateFinal,
  pollJob,
  type JobStatus,
} from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type NodeStatus = 'idle' | 'queued' | 'running' | 'done' | 'error';

export interface NodeState {
  jobId?: string;
  status: NodeStatus;
  progress: number;
  resultUrl?: string;
  error?: string;
  queuePosition?: number;
}

export type NodeStateMap = Record<string, NodeState>;

export interface WorkflowCallbacks {
  onNodeStateChange: (nodeId: string, state: NodeState) => void;
  onEdgeAnimating: (edgeId: string, animating: boolean) => void;
  onError: (message: string) => void;
}

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm)
// ---------------------------------------------------------------------------
function topoSort(nodes: Node[], edges: Edge[]): string[][] {
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  for (const n of nodes) {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  }
  for (const e of edges) {
    adj[e.source].push(e.target);
    inDegree[e.target] = (inDegree[e.target] ?? 0) + 1;
  }

  const queue: string[] = Object.entries(inDegree)
    .filter(([, d]) => d === 0)
    .map(([id]) => id);

  const layers: string[][] = [];
  while (queue.length > 0) {
    layers.push([...queue]);
    const next: string[] = [];
    for (const id of queue) {
      for (const neighbor of adj[id]) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) next.push(neighbor);
      }
    }
    queue.length = 0;
    queue.push(...next);
  }

  const processed = layers.flat().length;
  if (processed !== nodes.length) {
    throw new Error('Workflow has a cycle — cannot execute.');
  }

  return layers;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validate(nodes: Node[], edges: Edge[]): string[] {
  const errors: string[] = [];
  const REQUIRED_INPUTS: Record<string, string[]> = {
    flux:       ['text'],
    trellis:    ['image'],
    ltxvideo:   ['image'],
    chatterbox: ['text'],
    merge:      ['video', 'audio'],
  };

  const connectedTargets = new Set(edges.map(e => `${e.target}::${e.targetHandle}`));

  for (const node of nodes) {
    const required = REQUIRED_INPUTS[node.type ?? ''] ?? [];
    for (const handle of required) {
      if (!connectedTargets.has(`${node.id}::${handle}`)) {
        errors.push(`Node "${node.data?.label ?? node.id}" is missing required input: ${handle}`);
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Result passing between nodes
// ---------------------------------------------------------------------------
function getUpstreamResult(
  nodeId: string,
  handle: string,
  edges: Edge[],
  results: Record<string, string>,
): string | undefined {
  const edge = edges.find(e => e.target === nodeId && e.targetHandle === handle);
  if (!edge) return undefined;
  return results[edge.source];
}

// ---------------------------------------------------------------------------
// Node dispatch
// ---------------------------------------------------------------------------
async function executeNode(
  node: Node,
  edges: Edge[],
  results: Record<string, string>,
  onProgress: (status: JobStatus) => void,
): Promise<string | undefined> {
  const data = node.data as Record<string, unknown>;

  switch (node.type) {
    case 'prompt':
      // Prompt node has no job — its value flows directly
      return (data.text as string) ?? '';

    case 'imageupload':
      // Upload node — result is the already-uploaded URL
      return (data.uploadedUrl as string) ?? undefined;

    case 'flux': {
      const text = getUpstreamResult(node.id, 'text', edges, results) ?? '';
      const { job_id } = await generateImage({
        prompt: text,
        negative_prompt: (data.negativePrompt as string) ?? '',
        width: (data.width as number) ?? 1024,
        height: (data.height as number) ?? 1024,
      });
      const final = await pollJob(job_id, onProgress);
      return final.result_url ?? undefined;
    }

    case 'trellis': {
      const imageUrl = getUpstreamResult(node.id, 'image', edges, results) ?? '';
      const { job_id } = await generate3D({ image_url: imageUrl });
      const final = await pollJob(job_id, onProgress);
      return final.result_url ?? undefined;
    }

    case 'ltxvideo': {
      const imageUrl = getUpstreamResult(node.id, 'image', edges, results) ?? '';
      const { job_id } = await generateVideo({
        image_url: imageUrl,
        duration: (data.duration as number) ?? 4,
        fps: (data.fps as number) ?? 24,
      });
      const final = await pollJob(job_id, onProgress);
      return final.result_url ?? undefined;
    }

    case 'chatterbox': {
      const text = getUpstreamResult(node.id, 'text', edges, results) ?? '';
      const { job_id } = await generateVoice({
        text,
        voice_id: (data.voiceId as string) ?? 'narrator',
        emotion: (data.emotion as number) ?? 0.5,
        speed: (data.speed as number) ?? 1.0,
        language: (data.language as string) ?? 'en',
      });
      const final = await pollJob(job_id, onProgress);
      return final.result_url ?? undefined;
    }

    case 'merge': {
      const videoUrl = getUpstreamResult(node.id, 'video', edges, results) ?? '';
      const audioUrl = getUpstreamResult(node.id, 'audio', edges, results) ?? '';
      const { job_id } = await generateFinal({ video_url: videoUrl, audio_url: audioUrl });
      const final = await pollJob(job_id, onProgress);
      return final.result_url ?? undefined;
    }

    case 'output':
      return getUpstreamResult(node.id, 'input', edges, results);

    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Main workflow runner
// ---------------------------------------------------------------------------
export async function runWorkflow(
  nodes: Node[],
  edges: Edge[],
  callbacks: WorkflowCallbacks,
): Promise<void> {
  // 1. Validate
  const errors = validate(nodes, edges);
  if (errors.length > 0) {
    callbacks.onError(errors.join('\n'));
    return;
  }

  // 2. Topological sort
  const layers = topoSort(nodes, edges);
  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
  const results: Record<string, string> = {};

  // 3. Execute layer by layer (parallel within each layer)
  for (const layer of layers) {
    await Promise.all(
      layer.map(async nodeId => {
        const node = nodeById[nodeId];
        callbacks.onNodeStateChange(nodeId, { status: 'running', progress: 0 });

        try {
          const resultUrl = await executeNode(
            node,
            edges,
            results,
            (jobStatus) => {
              callbacks.onNodeStateChange(nodeId, {
                status: jobStatus.status === 'done' ? 'done'
                       : jobStatus.status === 'error' ? 'error'
                       : 'running',
                progress: jobStatus.progress,
                resultUrl: jobStatus.result_url ?? undefined,
                error: jobStatus.error ?? undefined,
                queuePosition: jobStatus.queue_position ?? undefined,
              });

              // Animate outgoing edges while running
              const outEdges = edges.filter(e => e.source === nodeId);
              for (const edge of outEdges) {
                callbacks.onEdgeAnimating(edge.id, jobStatus.status === 'running');
              }
            },
          );

          if (resultUrl) results[nodeId] = resultUrl;

          callbacks.onNodeStateChange(nodeId, {
            status: 'done',
            progress: 100,
            resultUrl,
          });

          // Stop edge animations
          const outEdges = edges.filter(e => e.source === nodeId);
          for (const edge of outEdges) callbacks.onEdgeAnimating(edge.id, false);

        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          callbacks.onNodeStateChange(nodeId, { status: 'error', progress: 0, error: message });
          throw err;
        }
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
const LS_KEY = 'studio3d_workflow';
const AUTO_SAVE_INTERVAL_MS = 30_000;

export interface WorkflowSnapshot {
  nodes: Node[];
  edges: Edge[];
  savedAt: string;
}

export function saveWorkflow(nodes: Node[], edges: Edge[]): void {
  const snapshot: WorkflowSnapshot = { nodes, edges, savedAt: new Date().toISOString() };
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `studio3d-workflow-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function loadWorkflow(): Promise<WorkflowSnapshot> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file selected'));
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result as string));
        } catch {
          reject(new Error('Invalid workflow JSON'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

export function autoSave(nodes: Node[], edges: Edge[]): void {
  const snapshot: WorkflowSnapshot = { nodes, edges, savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage full — ignore
  }
}

export function loadFromLocalStorage(): WorkflowSnapshot | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Default template
// ---------------------------------------------------------------------------
export function buildDefaultTemplate(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    { id: 'prompt1', type: 'prompt',      position: { x: 60,  y: 80  }, data: { label: 'Prompt', text: 'A majestic dragon soaring over a misty mountain range' } },
    { id: 'flux1',   type: 'flux',        position: { x: 360, y: 80  }, data: { label: 'FLUX Image Gen', width: 1024, height: 1024 } },
    { id: 'trellis', type: 'trellis',     position: { x: 680, y: 80  }, data: { label: 'TRELLIS 3D' } },
    { id: 'out3d',   type: 'output',      position: { x: 960, y: 80  }, data: { label: 'Output (GLB)' } },
    { id: 'ltx1',    type: 'ltxvideo',   position: { x: 680, y: 300 }, data: { label: 'LTX Video', duration: 4, fps: 24 } },
    { id: 'prompt2', type: 'prompt',      position: { x: 60,  y: 380 }, data: { label: 'Voice Script', text: 'Behold, the mighty dragon awakens from its ancient slumber.' } },
    { id: 'chat1',   type: 'chatterbox',  position: { x: 360, y: 380 }, data: { label: 'Chatterbox Voice', voiceId: 'narrator', emotion: 0.5, speed: 1.0 } },
    { id: 'merge1',  type: 'merge',       position: { x: 960, y: 300 }, data: { label: 'FFmpeg Merge' } },
    { id: 'outfin',  type: 'output',      position: { x: 1240, y: 300 }, data: { label: 'Final Video' } },
  ];

  const edges: Edge[] = [
    { id: 'e1', source: 'prompt1', target: 'flux1',   sourceHandle: 'text',  targetHandle: 'text'  },
    { id: 'e2', source: 'flux1',   target: 'trellis', sourceHandle: 'image', targetHandle: 'image' },
    { id: 'e3', source: 'trellis', target: 'out3d',   sourceHandle: 'model', targetHandle: 'input' },
    { id: 'e4', source: 'flux1',   target: 'ltx1',    sourceHandle: 'image', targetHandle: 'image' },
    { id: 'e5', source: 'ltx1',    target: 'merge1',  sourceHandle: 'video', targetHandle: 'video' },
    { id: 'e6', source: 'prompt2', target: 'chat1',   sourceHandle: 'text',  targetHandle: 'text'  },
    { id: 'e7', source: 'chat1',   target: 'merge1',  sourceHandle: 'audio', targetHandle: 'audio' },
    { id: 'e8', source: 'merge1',  target: 'outfin',  sourceHandle: 'video', targetHandle: 'input' },
  ];

  return { nodes, edges };
}
