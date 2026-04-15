const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface JobStatus {
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  result_url?: string | null;
  error?: string | null;
  queue_position?: number | null;
}

export interface Voice {
  id: string;
  name: string;
  style: string;
  lang: string;
  category: 'preset' | 'custom';
  preview_url: string;
}

export interface SystemStatus {
  queued_jobs: number;
  running_jobs: number;
  vram_used_gb: number;
  vram_total_gb: number;
  tier: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------
export async function generateImage(params: {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
}): Promise<{ job_id: string }> {
  return post('/generate/image', params);
}

export async function generate3D(params: { image_url: string }): Promise<{ job_id: string }> {
  return post('/generate/3d', params);
}

export async function generateVideo(params: {
  image_url: string;
  duration?: number;
  fps?: number;
}): Promise<{ job_id: string }> {
  return post('/generate/video', params);
}

export async function generateVoice(params: {
  text: string;
  voice_id: string;
  emotion?: number;
  speed?: number;
  language?: string;
}): Promise<{ job_id: string }> {
  return post('/generate/voice', params);
}

export async function generateFinal(params: {
  video_url: string;
  audio_url: string;
}): Promise<{ job_id: string }> {
  return post('/generate/final', params);
}

// ---------------------------------------------------------------------------
// Job polling
// ---------------------------------------------------------------------------
export async function getJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API}/job/${jobId}`);
  if (!res.ok) throw new Error(`Job ${jobId} not found`);
  return res.json();
}

/** Poll until done/error, calling onProgress each tick. */
export function pollJob(
  jobId: string,
  onProgress: (status: JobStatus) => void,
  intervalMs = 2000,
): Promise<JobStatus> {
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const status = await getJob(jobId);
        onProgress(status);
        if (status.status === 'done' || status.status === 'error') {
          resolve(status);
        } else {
          setTimeout(tick, intervalMs);
        }
      } catch (err) {
        reject(err);
      }
    };
    tick();
  });
}

// ---------------------------------------------------------------------------
// System status
// ---------------------------------------------------------------------------
export async function getSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API}/status`);
  if (!res.ok) throw new Error('Failed to fetch system status');
  return res.json();
}

// ---------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------
export async function listVoices(): Promise<Voice[]> {
  const res = await fetch(`${API}/voices`);
  if (!res.ok) throw new Error('Failed to fetch voices');
  return res.json();
}

export async function uploadVoice(file: File, name: string): Promise<{ id: string; name: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('name', name);
  const res = await fetch(`${API}/voices/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('Voice upload failed');
  return res.json();
}

export async function deleteVoice(voiceId: string): Promise<void> {
  const res = await fetch(`${API}/voices/${voiceId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete voice ${voiceId}`);
}

export function voicePreviewUrl(voiceId: string): string {
  return `${API}/voices/${voiceId}/preview`;
}

export function outputUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${API}${path}`;
}
