import { describe, expect, it } from 'vitest';
import { createApp } from '../src/index.ts';

describe('companion', () => {
  it('GET /health answers', async () => {
    const res = await createApp().request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, name: 'ibasho-companion', routes: ['GET /health'] });
  });
});
