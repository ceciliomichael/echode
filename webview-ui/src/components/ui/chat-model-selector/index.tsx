import { memo, useState, useRef, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import { useHoverEffect, hoverPresets } from '../../../hooks/use-hover-effect';
import type { Provider } from '../../../types/api-settings';
import { CustomModelFetcher } from '../custom-model-fetcher';
import { useModelAggregation } from './use-model-aggregation';
import { ModelList } from './model-list';
import type { ChatModelSelectorProps } from './types';

export const PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'megallm', label: 'MEGALLM' },
  { value: 'vscode-lm', label: 'VS Code LM (Copilot)' },
  { value: 'qwen-code', label: 'Qwen Code' },
];

function ChatModelSelectorComponent({ 
  provider: activeProvider, 
  model: activeModel, 
  onChange, 
  disabled = false, 
  direction = 'up' 
}: ChatModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { handleMouseEnter, handleMouseLeave } = useHoverEffect();

  const {
    allModels,
    anyLoading,
    settings,
    handleCustomModelsFetched
  } = useModelAggregation(isOpen);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const handleSelectModel = (provider: Provider, model: string) => {
    onChange(provider, model);
    setIsOpen(false);
  };

  const selectedProviderLabel =
    PROVIDER_OPTIONS.find((p) => p.value === activeProvider)?.label || 'Select model';

  const buttonLabel = activeModel || 'Select model';

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-xl border transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: 'transparent',
          borderColor: 'var(--vscode-input-border)',
          color: 'var(--vscode-input-foreground)',
        }}
        title={selectedProviderLabel}
        onMouseEnter={(e) => !disabled && handleMouseEnter(e, hoverPresets.button.enter)}
        onMouseLeave={(e) => handleMouseLeave(e, hoverPresets.button.leave)}
      >
        <Cpu className="w-3.5 h-3.5" />
        <span className="max-w-[120px] truncate">{buttonLabel}</span>
      </button>

      {/* Render fetchers for custom providers */}
      {settings.customProviders?.map(cp => (
        <CustomModelFetcher
          key={cp.id}
          provider={`custom-${cp.id}` as Provider}
          baseUrl={cp.baseUrl}
          apiKey={cp.apiKey}
          onModelsFetched={handleCustomModelsFetched}
        />
      ))}

      {isOpen && (
        <ModelList
          models={allModels}
          activeProvider={activeProvider}
          activeModel={activeModel}
          onSelect={handleSelectModel}
          loading={anyLoading}
          direction={direction}
        />
      )}
    </div>
  );
}

export const ChatModelSelector = memo(ChatModelSelectorComponent);