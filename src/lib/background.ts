// src/lib/background.ts — Work that may finish after the response is sent.
// On Cloudflare a plain fire-and-forget promise can be cut off once the response is out;
// waitUntil keeps the Worker alive until it settles.

export function inBackground(locals: unknown, task: Promise<unknown>, label: string): void {
  const safe = task.catch((err) => console.error(`[${label}] failed:`, err));
  (locals as any)?.cfContext?.waitUntil?.(safe);
}
