import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { Provider } from '../../types/api-settings';

interface ProviderDropdownProps {
  value: Provider;
  onChange: (value: Provider) => void;
}

const PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'megallm', label: 'MEGALLM' },
  { value: 'vscode-lm', label: 'VS Code LM (Copilot)' },
  { value: 'qwen-code', label: 'Qwen Code' },
];

export function ProviderDropdown({ value, onChange }: ProviderDropdownProps) {
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

  const filteredProviders = PROVIDER_OPTIONS.filter(provider =>
    provider.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (provider: Provider) => {
    onChange(provider);
    setIsOpen(false);
    setSearch('');
  };

  const selectedLabel = PROVIDER_OPTIONS.find(p => p.value === value)?.label || 'Select provider...';

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-sm rounded-xl border transition-colors flex items-center justify-between"
        style={{
          backgroundColor: 'var(--vscode-input-background)',
          color: 'var(--vscode-input-foreground)',
          borderColor: 'var(--vscode-input-border)'
        }}
      >
        <span>{selectedLabel}</span>
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
                placeholder="Search providers..."
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
            {filteredProviders.length === 0 ? (
              <div className="p-4 text-center">
                <div
                  className="text-xs"
                  style={{ color: 'var(--vscode-input-foreground)', opacity: 0.7 }}
                >
                  No providers found
                </div>
              </div>
            ) : (
              filteredProviders.map((provider) => (
                <button
                  key={provider.value}
                  type="button"
                  onClick={() => handleSelect(provider.value)}
                  className="w-full px-3 py-2 text-sm text-left transition-colors"
                  style={{
                    backgroundColor: provider.value === value ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
                    color: provider.value === value ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-input-foreground)'
                  }}
                  onMouseEnter={(e) => {
                    if (provider.value !== value) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-editor-background)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (provider.value !== value) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {provider.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
