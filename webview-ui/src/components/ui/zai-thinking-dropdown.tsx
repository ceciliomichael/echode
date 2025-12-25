import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface ZaiThinkingDropdownProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

const THINKING_OPTIONS: { value: boolean; label: string }[] = [
  { value: false, label: 'Disabled' },
  { value: true, label: 'Enabled' },
];

export function ZaiThinkingDropdown({ value, onChange }: ZaiThinkingDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (selectedValue: boolean) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  const selectedLabel = THINKING_OPTIONS.find(opt => opt.value === value)?.label || 'Disabled';

  const renderOptionButton = (option: { value: boolean; label: string }) => (
    <button
      key={option.label}
      type="button"
      onClick={() => handleSelect(option.value)}
      className="w-full px-3 py-2 text-sm text-left transition-colors"
      style={{
        backgroundColor: option.value === value ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
        color: option.value === value ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-input-foreground)'
      }}
      onMouseEnter={(e) => {
        if (option.value !== value) {
          e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
        }
      }}
      onMouseLeave={(e) => {
        if (option.value !== value) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      {option.label}
    </button>
  );

  return (
    <div className="space-y-1.5">
      <label
        className="block text-xs font-semibold"
        style={{ color: 'var(--vscode-foreground)' }}
      >
        Thinking (Z.ai)
      </label>
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
              backgroundColor: 'var(--vscode-editor-background)',
              borderColor: 'var(--vscode-input-border)',
              maxHeight: '300px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div
              className="overflow-y-auto"
              style={{
                maxHeight: '240px'
              }}
            >
              {THINKING_OPTIONS.map(renderOptionButton)}
            </div>
          </div>
        )}
      </div>
      <p className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        Enable or disable the model's thinking process.
      </p>
    </div>
  );
}