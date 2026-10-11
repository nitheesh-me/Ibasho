/**
 * Entry. Owner: WP-08. Andon styles, then the router under `/app/`.
 */
import '@ibasho/ui/andon.css';
import '@ibasho/editor/editor.css';
import './app.css';
import './studio/studio.css';
import { loadAndonFonts } from '@ibasho/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { createRouter } from './routes.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
// Fonts first (capped), so the first screen paints in the Andon faces without a swap (B-m12).
void loadAndonFonts().then(() =>
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={createRouter()} />
    </StrictMode>,
  ),
);
