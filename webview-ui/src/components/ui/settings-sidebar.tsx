import { Settings, FileText } from 'lucide-react';

interface SettingsSidebarProps {
  activeTab: 'api' | 'system';
  onTabChange: (tab: 'api' | 'system') => void;
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <div
      className="hidden sm:block w-56 lg:w-64 border-r shrink-0"
      style={{
        borderColor: 'var(--vscode-panel-border)',
        backgroundColor: 'var(--vscode-sideBar-background)'
      }}
    >
      <div className="p-3 sm:p-4">
        <div
          className="flex items-center gap-2 mb-4"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          <Settings size={16} strokeWidth={1.5} />
          <h2 className="text-sm font-semibold">Settings</h2>
        </div>
        <nav className="space-y-1.5">
          <button
            onClick={() => onTabChange('api')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-lg transition-all border"
            style={{
              backgroundColor: activeTab === 'api' ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
              color: activeTab === 'api' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
              borderColor: activeTab === 'api' ? 'var(--vscode-focusBorder)' : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'api') {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'api') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <Settings size={14} strokeWidth={1.5} />
            <span className="font-medium">API Configuration</span>
          </button>
          <button
            onClick={() => onTabChange('system')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-lg transition-all border"
            style={{
              backgroundColor: activeTab === 'system' ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
              color: activeTab === 'system' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
              borderColor: activeTab === 'system' ? 'var(--vscode-focusBorder)' : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'system') {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'system') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <FileText size={14} strokeWidth={1.5} />
            <span className="font-medium">System Prompt</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
