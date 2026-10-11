/**
 * Run a lens kernel in a module worker when one can start, else inline on the next task.
 * Owner: WP-07.
 */
import { handle, type KernelRequest, type KernelResult } from './kernels.worker.ts';

let worker: Worker | null | undefined;
let seq = 0;
const waiting = new Map<number, { resolve: (r: KernelResult) => void; req: KernelRequest }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker =
      typeof Worker === 'undefined'
        ? null
        : new Worker(new URL('./kernels.worker.ts', import.meta.url), { type: 'module' });
    worker?.addEventListener('message', (e: MessageEvent<{ id: number; result: KernelResult }>) => {
      waiting.get(e.data.id)?.resolve(e.data.result);
      waiting.delete(e.data.id);
    });
    worker?.addEventListener('error', () => {
      // The worker failed to start or crashed: finish what was asked inline, then stay inline.
      worker = null;
      for (const [id, w] of waiting) {
        waiting.delete(id);
        setTimeout(() => w.resolve(handle(w.req)), 0);
      }
    });
  } catch {
    worker = null;
  }
  return worker;
}

export function runKernel(req: KernelRequest): Promise<KernelResult> {
  const w = getWorker();
  if (!w) return new Promise((resolve) => setTimeout(() => resolve(handle(req)), 0));
  const id = ++seq;
  return new Promise((resolve) => {
    waiting.set(id, { resolve, req });
    w.postMessage({ id, req });
  });
}
