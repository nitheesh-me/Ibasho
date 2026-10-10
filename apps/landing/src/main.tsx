/**
 * Entry. Owner: WP-09 (Content and landing). SKELETON (G0): renders a blank Andon page. Chapters come from `@ibasho/content`.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './andon-blank.css';

function Blank() {
  return <main data-andon="blank" aria-label="Ibasho" />;
}

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(
  <StrictMode>
    <Blank />
  </StrictMode>,
);
