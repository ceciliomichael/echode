import { useEffect, useRef, useState } from 'react';
import { Check, Code, Hammer } from 'lucide-react';
import type { ChatMode } from '../../types/chat-mode';
import { CHAT_MODE_OPTIONS } from '../../types/chat-mode';

const MODE_ICONS: Record<ChatMode, typeof Code> = {
  agent: Code,
  plan: Hammer,
};

interface ModeDropdownProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  disabled?: boolean;
  direction?: 'up' | 'down';
}

export function ModeDropdown({ mode, onModeChange, disabled = false, direction = 'up' }: ModeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = CHAT_MODE_OPTIONS.find(opt => opt.value === mode);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (newMode: ChatMode) => {
    onModeChange(newMode);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Mode Button - Small container with icon and mode-specific color */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          color: mode === 'agent' ? '#22c55e' : '#f97316',
          backgroundColor: 'transparent',
          borderColor: mode === 'agent' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(249, 115, 22, 0.3)',
        }}
        title={currentOption?.description}
      >
        {(() => {
          const Icon = MODE_ICONS[mode];
          return <Icon className="w-3.5 h-3.5" />;
        })()}
        <span className="font-medium">{currentOption?.label || 'Agent'}</span>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={`absolute left-0 w-52 rounded-lg border p-1.5 z-[100] ${direction === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'}`}
          style={{
            backgroundColor: 'var(--vscode-dropdown-background)',
            borderColor: 'var(--vscode-input-border)',
          }}
        >
          <div className="flex flex-col gap-1">
            {CHAT_MODE_OPTIONS.map((option) => {
              const Icon = MODE_ICONS[option.value];
              const isSelected = option.value === mode;
              
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className="w-full px-2 py-1.5 text-left rounded-lg transition-opacity hover:opacity-80 active:opacity-70 flex items-start gap-1.5 border"
                  style={{
                    backgroundColor:
                      isSelected
                        ? 'var(--vscode-list-activeSelectionBackground)'
                        : 'var(--vscode-input-background)',
                    color:
                      isSelected
                        ? 'var(--vscode-list-activeSelectionForeground)'
                        : 'var(--vscode-foreground)',
                    borderColor: isSelected
                      ? 'var(--vscode-list-activeSelectionBackground)'
                      : 'var(--vscode-input-border)',
                  }}
                >
                  {/* Icon */}
                  <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs leading-tight">{option.label}</div>
                    <div className="text-[10px] opacity-60 leading-tight mt-0.5">
                      {option.description}
                    </div>
                  </div>
                  
                  {/* Checkmark for selected */}
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
