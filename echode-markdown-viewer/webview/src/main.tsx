import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MarkdownViewer } from './markdown-viewer';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MarkdownViewer />
  </StrictMode>,
);
