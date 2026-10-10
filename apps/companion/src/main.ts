import { serve } from '@hono/node-server';
import { COMPANION_HOST, COMPANION_PORT, createApp } from './index.ts';

serve({ fetch: createApp().fetch, hostname: COMPANION_HOST, port: COMPANION_PORT }, (info) => {
  console.log(`ibasho companion on http://${info.address}:${info.port}`);
});
