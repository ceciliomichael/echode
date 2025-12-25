import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface ZaiUrlDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

const ZAI_URL_OPTIONS: { value: string; label: string }[] = [
  { value: 'https://api.z.ai/api/coding/paas/v4', label: 'Coding (Default)' },
  { value: 'https://api.z.ai/api/paas/v4', label: 'Standard' },
];

export function ZaiUrlDropdown({ value, onChange }: ZaiUrlDropdownProps) {
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

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  // If the current value matches one of our options, show its label.
  // Otherwise, if it's empty, default to the first option's label (Coding).
  // If it's a custom string (not in options), show that custom string or a "Custom" label.
  // Given the requirement is strict about these two options, we'll try to match them.
  // If the value is empty/undefined, we treat it as the default (Coding).
  const effectiveValue = value || ZAI_URL_OPTIONS[0].value;
  const selectedLabel = ZAI_URL_OPTIONS.find(opt => opt.value === effectiveValue)?.label || effectiveValue;

  const renderOptionButton = (option: { value: string; label: string }) => (
    <button
      key={option.value}
      type="button"
      onClick={() => handleSelect(option.value)}
      className="w-full px-3 py-2 text-sm text-left transition-colors"
      style={{
        backgroundColor: option.value === effectiveValue ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
        color: option.value === effectiveValue ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-input-foreground)'
      }}
      onMouseEnter={(e) => {
        if (option.value !== effectiveValue) {
          e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
        }
      }}
      onMouseLeave={(e) => {
        if (option.value !== effectiveValue) {
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
        API Endpoint
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
              {ZAI_URL_OPTIONS.map(renderOptionButton)}
            </div>
          </div>
        )}
      </div>
      <p className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        Select the Z.ai API endpoint to use.
      </p>
    </div>
  );
}