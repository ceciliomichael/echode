import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, RotateCw } from 'lucide-react';

interface ModelDropdownProps {
  value: string;
  onChange: (value: string) => void;
  models: string[];
  disabled?: boolean;
  onOpen?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function ModelDropdown({ value, onChange, models, disabled = false, onOpen, onRefresh, isRefreshing = false }: ModelDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = models.filter(model =>
    model.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (model: string) => {
    onChange(model);
    setIsOpen(false);
    setSearch('');
  };

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen && onOpen) {
        onOpen();
      }
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm rounded-xl border transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: 'var(--vscode-input-background)',
          color: 'var(--vscode-input-foreground)',
          borderColor: 'var(--vscode-input-border)'
        }}
      >
        <span className={!value ? 'opacity-50' : ''}>
          {value || 'Select a model...'}
        </span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div
          className="absolute z-10 w-full mt-1 rounded-xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            borderColor: 'var(--vscode-input-border)',
            maxHeight: '300px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div
            className="p-2 border-b"
            style={{ borderColor: 'var(--vscode-input-border)' }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
              style={{
                backgroundColor: 'var(--vscode-editor-background)',
                borderColor: 'var(--vscode-input-border)'
              }}
            >
              <Search size={14} style={{ color: 'var(--vscode-input-foreground)', opacity: 0.6 }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="flex-1 bg-transparent text-sm border-0 p-0 placeholder-opacity-50"
                style={{
                  color: 'var(--vscode-input-foreground)',
                  outline: 'none'
                }}
                autoFocus
              />
              {onRefresh && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefresh();
                  }}
                  disabled={isRefreshing}
                  className="p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    color: 'var(--vscode-input-foreground)',
                    opacity: isRefreshing ? 0.5 : 0.8
                  }}
                  onMouseEnter={(e) => {
                    if (!isRefreshing) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Refresh models"
                >
                  <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
          </div>

          <div
            className="overflow-y-auto"
            style={{
              maxHeight: '240px',
              backgroundColor: 'var(--vscode-input-background)'
            }}
          >
            {filteredModels.length === 0 ? (
              <div className="p-4 text-center">
                <div
                  className="text-xs"
                  style={{ color: 'var(--vscode-input-foreground)', opacity: 0.7 }}
                >
                  No models available
                </div>
              </div>
            ) : (
              filteredModels.map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => handleSelect(model)}
                  className="w-full px-3 py-2 text-sm text-left transition-colors"
                  style={{
                    backgroundColor: model === value ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
                    color: model === value ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-input-foreground)'
                  }}
                  onMouseEnter={(e) => {
                    if (model !== value) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-editor-background)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (model !== value) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {model}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}