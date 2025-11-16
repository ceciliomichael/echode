/**
 * Centralized VSCode theme style constants
 * Eliminates repetitive inline style objects across components
 */

export const vscodeThemeStyles = {
  input: {
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    borderColor: 'var(--vscode-input-border)',
  },
  
  surface: {
    backgroundColor: 'var(--vscode-chat-surface)',
    borderColor: 'var(--vscode-input-border)',
  },
  
  sidebar: {
    backgroundColor: 'var(--vscode-sideBar-background)',
  },
  
  editor: {
    backgroundColor: 'var(--vscode-editor-background)',
  },
  
  text: {
    primary: {
      color: 'var(--vscode-foreground)',
    },
    description: {
      color: 'var(--vscode-descriptionForeground)',
    },
    error: {
      color: 'var(--vscode-errorForeground)',
    },
  },
  
  border: {
    borderColor: 'var(--vscode-panel-border)',
  },
  
  hover: {
    backgroundColor: 'var(--vscode-list-hoverBackground)',
  },
} as const;

/**
 * Helper function to merge VSCode theme styles
 */
export function mergeVscodeStyles(
  ...styles: Array<React.CSSProperties | undefined>
): React.CSSProperties {
  return Object.assign({}, ...styles.filter(Boolean));
}
