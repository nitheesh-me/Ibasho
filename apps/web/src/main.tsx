/**
 * Entry. Owner: WP-08 (everything except `public/assets/**`, which is WP-11). SKELETON (G0): renders a blank Andon page. The module manifest is in `manifest.ts`.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './andon-blank.css';
import { manifest } from './manifest.ts';

function Blank() {
  const modules = manifest.engine.length + manifest.ui.length;
  return <main data-andon="blank" data-modules={modules} aria-label="Ibasho" />;
}

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(
  <StrictMode>
    <Blank />
  </StrictMode>,
);
