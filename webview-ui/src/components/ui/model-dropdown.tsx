import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface ModelDropdownProps {
  value: string;
  onChange: (value: string) => void;
  models: string[];
  disabled?: boolean;
}

export function ModelDropdown({ value, onChange, models, disabled = false }: ModelDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customModel, setCustomModel] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
        setCustomModel('');
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
    setCustomModel('');
  };

  const handleCustomModelAdd = () => {
    if (customModel.trim()) {
      onChange(customModel.trim());
      setIsOpen(false);
      setSearch('');
      setCustomModel('');
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
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
              <div className="p-3 space-y-2">
                <div
                  className="text-xs text-center mb-2"
                  style={{ color: 'var(--vscode-input-foreground)', opacity: 0.7 }}
                >
                  No models found. Enter custom model name:
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCustomModelAdd();
                      }
                    }}
                    placeholder="gpt-4, claude-3-opus, etc."
                    className="flex-1 px-3 py-2 text-sm rounded-lg border"
                    style={{
                      backgroundColor: 'var(--vscode-editor-background)',
                      color: 'var(--vscode-input-foreground)',
                      borderColor: 'var(--vscode-input-border)',
                      outline: 'none'
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCustomModelAdd}
                    disabled={!customModel.trim()}
                    className="px-3 py-2 text-xs rounded-lg border transition-opacity disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                      borderColor: 'var(--vscode-input-border)'
                    }}
                  >
                    Add
                  </button>
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