import { Settings, FileText, Wrench, Search, Zap, Brain, GitCommit } from 'lucide-react';

type TabType = 'api' | 'system' | 'tools' | 'indexing' | 'autocomplete' | 'context' | 'commit-message';

interface SettingsSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
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
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-xl transition-all border"
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
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-xl transition-all border"
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
          <button
            onClick={() => onTabChange('tools')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-xl transition-all border"
            style={{
              backgroundColor: activeTab === 'tools' ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
              color: activeTab === 'tools' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
              borderColor: activeTab === 'tools' ? 'var(--vscode-focusBorder)' : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'tools') {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'tools') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <Wrench size={14} strokeWidth={1.5} />
            <span className="font-medium">Tools</span>
          </button>
          <button
            onClick={() => onTabChange('indexing')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-xl transition-all border"
            style={{
              backgroundColor: activeTab === 'indexing' ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
              color: activeTab === 'indexing' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
              borderColor: activeTab === 'indexing' ? 'var(--vscode-focusBorder)' : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'indexing') {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'indexing') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <Search size={14} strokeWidth={1.5} />
            <span className="font-medium">Indexing</span>
          </button>
          <button
            onClick={() => onTabChange('autocomplete')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-xl transition-all border"
            style={{
              backgroundColor: activeTab === 'autocomplete' ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
              color: activeTab === 'autocomplete' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
              borderColor: activeTab === 'autocomplete' ? 'var(--vscode-focusBorder)' : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'autocomplete') {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'autocomplete') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <Zap size={14} strokeWidth={1.5} />
            <span className="font-medium">Autocomplete</span>
          </button>
          <button
            onClick={() => onTabChange('context')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-xl transition-all border"
            style={{
              backgroundColor: activeTab === 'context' ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
              color: activeTab === 'context' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
              borderColor: activeTab === 'context' ? 'var(--vscode-focusBorder)' : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'context') {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'context') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <Brain size={14} strokeWidth={1.5} />
            <span className="font-medium">Context</span>
          </button>
          <button
            onClick={() => onTabChange('commit-message')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-xl transition-all border"
            style={{
              backgroundColor: activeTab === 'commit-message' ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
              color: activeTab === 'commit-message' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
              borderColor: activeTab === 'commit-message' ? 'var(--vscode-focusBorder)' : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'commit-message') {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'commit-message') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <GitCommit size={14} strokeWidth={1.5} />
            <span className="font-medium">Commit Message</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
