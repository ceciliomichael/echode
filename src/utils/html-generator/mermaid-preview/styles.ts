/**
 * CSS styles for Mermaid preview panel
 */
export function getMermaidStyles(): string {
  return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: var(--vscode-font-family), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #toolbar {
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--vscode-input-border);
      background: var(--vscode-editor-background);
      flex-shrink: 0;
    }
    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 2px;
      background: transparent;
      border: 1px solid var(--vscode-input-border);
      border-radius: 12px;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .toolbar-group:hover {
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.05);
    }
    .toolbar-divider {
      width: 1px;
      height: 20px;
      background: var(--vscode-input-border);
    }
    button {
      background: transparent;
      color: var(--vscode-foreground);
      border: none;
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 400;
      transition: background 0.1s ease;
      outline: none !important;
      box-shadow: none !important;
    }
    button:hover {
      background: transparent;
    }
    button:active {
      background: transparent;
    }
    button:hover .icon {
      transform: scale(1.05);
    }
    button:active .icon {
      transform: scale(0.95);
    }
    button:focus {
      outline: none !important;
      box-shadow: none !important;
    }
    .save-group {
      display: flex;
      align-items: center;
      padding: 2px;
      background: transparent;
      border: 1px solid var(--vscode-input-border); 
      border-radius: 12px;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .save-group:hover {
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.05);
    }
    .save-group button {
      color: var(--vscode-foreground);
      transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .save-group button:hover {
      background: transparent;
      transform: scale(1.03);
    }
    .save-group button:active {
      transform: scale(0.98);
    }
    .button-divider {
      width: 1px;
      height: 14px;
      background: var(--vscode-input-border);
      margin: 0 2px;
    }
    .save-svg-group {
      display: flex;
      align-items: center;
      padding: 2px;
      background: transparent;
      border: 1px solid var(--vscode-input-border); 
      border-radius: 12px;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .save-svg-group:hover {
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.05);
    }
    .save-svg-group button {
      color: var(--vscode-foreground);
    }
    .save-svg-group button:hover {
      background: transparent;
    }
    #zoom-level {
      font-size: 11px;
      color: var(--vscode-foreground);
      min-width: 40px;
      text-align: center;
      font-weight: 500;
    }
    #container {
      flex: 1;
      overflow: hidden;
      position: relative;
      cursor: grab;
      background: var(--vscode-editor-background);
      user-select: none;
      -webkit-user-select: none;
    }
    #container.panning {
      cursor: grabbing;
    }
    #container * {
      user-select: none;
      -webkit-user-select: none;
    }
    #diagram-wrapper {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      transform-origin: center center;
      transition: transform 0.08s ease-out;
    }
    #footer {
      padding: 8px 16px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      border-top: 1px solid var(--vscode-input-border);
      background: var(--vscode-editor-background);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #footer::before {
      content: '';
      width: 6px;
      height: 6px;
      background: var(--vscode-button-background);
      border-radius: 50%;
      opacity: 0.7;
    }
    /* Icon styling */
    .icon {
      width: 14px;
      height: 14px;
      stroke-width: 2;
      transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
  `;
}