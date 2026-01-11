/**
 * JavaScript functionality for Mermaid preview panel
 */
export function getMermaidScripts(theme: string, themeVariables: any): string {
  return `
    const vscode = acquireVsCodeApi();
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: ${JSON.stringify(themeVariables)},
      securityLevel: 'loose',
    });

    // Render mermaid diagram manually
    async function renderMermaid() {
      const codeElement = document.getElementById('mermaid-code');
      const outputElement = document.getElementById('mermaid-output');
      
      if (!codeElement || !outputElement) {
        console.error('Mermaid elements not found');
        return;
      }

      const code = codeElement.textContent.trim();
      
      try {
        // Validate syntax first
        const parseResult = await mermaid.parse(code, { suppressErrors: true });
        if (parseResult.success === false) {
          outputElement.innerHTML = '<div style="color: var(--vscode-errorForeground); padding: 20px; text-align: center;">Invalid Mermaid syntax</div>';
          return;
        }

        // Render the diagram
        const { svg } = await mermaid.render('mermaid-diagram', code);
        outputElement.innerHTML = svg;
        
        // Wait for SVG to be ready then auto-fit
        waitForSvgAndFit();
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        outputElement.innerHTML = '<div style="color: var(--vscode-errorForeground); padding: 20px; text-align: center;">Failed to render diagram</div>';
      }
    }

    // Pan/Zoom state
    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    const container = document.getElementById('container');
    const wrapper = document.getElementById('diagram-wrapper');
    const zoomLabel = document.getElementById('zoom-level');

    function updateTransform() {
      wrapper.style.transform = 'translate(-50%, -50%) translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    }

    function zoomIn() {
      scale = Math.min(5, scale + 0.2);
      updateTransform();
    }

    function zoomOut() {
      scale = Math.max(0.1, scale - 0.2);
      updateTransform();
    }

    function resetView() {
      scale = 1;
      panX = 0;
      panY = 0;
      updateTransform();
    }

    function fitToView() {
      const svg = container.querySelector('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      // Get original dimensions by dividing by current scale
      const originalWidth = rect.width / scale;
      const originalHeight = rect.height / scale;
      const scaleX = (containerRect.width - 40) / originalWidth;
      const scaleY = (containerRect.height - 40) / originalHeight;
      scale = Math.min(scaleX, scaleY, 2);
      panX = 0;
      panY = 0;
      updateTransform();
    }

    // Mouse wheel zoom
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      scale = Math.max(0.1, Math.min(5, scale + delta));
      updateTransform();
    });

    // Pan with mouse drag
    container.addEventListener('mousedown', (e) => {
      isPanning = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      container.classList.add('panning');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      updateTransform();
    });

    window.addEventListener('mouseup', () => {
      isPanning = false;
      container.classList.remove('panning');
    });

    // Double-click to reset
    container.addEventListener('dblclick', resetView);

    function saveSvg() {
      const svg = container.querySelector('svg');
      if (svg) {
        vscode.postMessage({
          type: 'saveMermaidSvg',
          svg: svg.outerHTML
        });
      }
    }

    // Initial auto-fit after render - wait for SVG to be ready
    function waitForSvgAndFit() {
      const svg = container.querySelector('svg');
      if (svg && svg.getBoundingClientRect().width > 0) {
        fitToView();
        vscode.postMessage({ type: 'mermaidPreviewReady' });
      } else {
        requestAnimationFrame(waitForSvgAndFit);
      }
    }
    
    // Render the diagram on load
    renderMermaid();

    // Listen for close event
    window.addEventListener('beforeunload', () => {
      vscode.postMessage({ type: 'mermaidPreviewClosed' });
    });
  `;
}