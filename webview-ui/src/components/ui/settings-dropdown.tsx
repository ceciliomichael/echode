import { Settings, FileText, Wrench, ChevronDown, Search, Zap } from 'lucide-react';

type TabType = 'api' | 'system' | 'tools' | 'indexing' | 'autocomplete';

interface SettingsDropdownProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function SettingsDropdown({ activeTab, onTabChange, isOpen, onToggle }: SettingsDropdownProps) {
  return (
    <div className="sm:hidden relative">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: 'var(--vscode-panel-border)',
          backgroundColor: 'var(--vscode-sideBar-background)',
          color: 'var(--vscode-foreground)'
        }}
      >
        <div className="flex items-center gap-2">
          <Settings size={16} strokeWidth={1.5} />
          <span className="text-sm font-semibold">
            {activeTab === 'api' ? 'API Configuration' : activeTab === 'system' ? 'System Prompt' : activeTab === 'tools' ? 'Tools' : activeTab === 'indexing' ? 'Indexing' : 'Autocomplete'}
          </span>
        </div>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className="transition-transform"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 z-50 border-b shadow-lg"
          style={{
            borderColor: 'var(--vscode-panel-border)',
            backgroundColor: 'var(--vscode-sideBar-background)'
          }}
        >
          <nav className="p-3 space-y-1.5">
            <button
              onClick={() => {
                onTabChange('api');
                onToggle();
              }}
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
              onClick={() => {
                onTabChange('system');
                onToggle();
              }}
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
              onClick={() => {
                onTabChange('tools');
                onToggle();
              }}
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
              onClick={() => {
                onTabChange('indexing');
                onToggle();
              }}
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
              onClick={() => {
                onTabChange('autocomplete');
                onToggle();
              }}
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
          </nav>
        </div>
      )}
    </div>
  );
}
