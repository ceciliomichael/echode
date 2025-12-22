import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { type ReasoningEffort } from '../../types/api-settings';

interface ReasoningEffortDropdownProps {
  value?: ReasoningEffort;
  onChange: (value: ReasoningEffort | undefined) => void;
}

const REASONING_EFFORT_OPTIONS: { value: ReasoningEffort | undefined; label: string }[] = [
  { value: undefined, label: 'None' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'extra_high', label: 'Extra High' },
];

export function ReasoningEffortDropdown({ value, onChange }: ReasoningEffortDropdownProps) {
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

  const handleSelect = (selectedValue: ReasoningEffort | undefined) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  const selectedLabel = REASONING_EFFORT_OPTIONS.find(opt => opt.value === value)?.label || 'None';

  const renderOptionButton = (option: { value: ReasoningEffort | undefined; label: string }) => (
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
        Reasoning Effort (Optional)
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
              {REASONING_EFFORT_OPTIONS.map(renderOptionButton)}
            </div>
          </div>
        )}
      </div>
      <p className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        Controls the model's reasoning effort.
      </p>
    </div>
  );
}