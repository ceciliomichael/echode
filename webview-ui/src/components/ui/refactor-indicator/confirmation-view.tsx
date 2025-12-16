import { getFileIconConfig } from '../../../utils/file-icon-mapper';

interface ConfirmationViewProps {
  selectedFile: string;
  onConfirm: (e: React.MouseEvent) => void;
  onCancel: (e: React.MouseEvent) => void;
}

/**
 * Confirmation dialog for refactoring a selected file
 */
export function ConfirmationView({ selectedFile, onConfirm, onCancel }: ConfirmationViewProps) {
  const iconConfig = getFileIconConfig(selectedFile);
  const Icon = iconConfig.icon;
  const fileName = selectedFile.split(/[/\\]/).pop();

  return (
    <div className="flex flex-col gap-3">
      <p
        className="text-xs"
        style={{ color: 'var(--vscode-foreground)' }}
      >
        Refactor this file?
      </p>
      
      <div 
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs"
        style={{ 
          backgroundColor: 'var(--vscode-list-hoverBackground)'
        }}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color: iconConfig.color }} />
        <span className="truncate font-medium">{fileName}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 px-3 py-1.5 rounded-xl text-xs transition-all border"
          style={{ 
            backgroundColor: 'var(--vscode-button-background)', 
            color: 'var(--vscode-button-foreground)',
            borderColor: 'var(--vscode-button-background)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
            e.currentTarget.style.borderColor = 'var(--vscode-button-hoverBackground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
            e.currentTarget.style.borderColor = 'var(--vscode-button-background)';
          }}
        >
          Yes, Refactor
        </button>
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-1.5 rounded-xl text-xs transition-all border"
          style={{ 
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-input-border)',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            e.currentTarget.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.3)';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--vscode-input-border)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}