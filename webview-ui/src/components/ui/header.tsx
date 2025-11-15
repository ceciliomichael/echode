import { Settings } from 'lucide-react';

interface HeaderProps {
  onSettingsClick: () => void;
}

export function Header({ onSettingsClick }: HeaderProps) {
  return (
    <header
      className="flex items-center justify-end px-2 h-8 border-b"
      style={{
        backgroundColor: 'var(--vscode-sideBar-background)',
        borderColor: 'var(--vscode-panel-border)'
      }}
    >
      <button
        onClick={onSettingsClick}
        className="flex items-center justify-center w-8 h-8 rounded transition-opacity"
        style={{
          backgroundColor: 'transparent',
          color: 'var(--vscode-foreground)',
          opacity: 0.7
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.7';
        }}
        aria-label="Open settings"
      >
        <Settings size={14} strokeWidth={1.5} />
      </button>
    </header>
  );
}