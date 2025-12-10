import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { useHoverEffect, hoverPresets } from '../../hooks/use-hover-effect';
import { Check, Cpu, Search, RefreshCcw } from 'lucide-react';
import type { ApiSettings, Provider } from '../../types/api-settings';
import { storageService } from '../../utils/storage';
import { useModelFetcher, requestModelsRefresh } from '../../hooks/use-model-fetcher';

const PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'megallm', label: 'MEGALLM' },
  { value: 'vscode-lm', label: 'VS Code LM (Copilot)' },
  { value: 'qwen-code', label: 'Qwen Code' },
];

interface ChatModelSelectorProps {
  provider: Provider;
  model: string;
  onChange: (provider: Provider, model: string) => void;
  disabled?: boolean;
  direction?: 'up' | 'down';
}

function ChatModelSelectorComponent({ provider: activeProvider, model: activeModel, onChange, disabled = false, direction = 'up' }: ChatModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { handleMouseEnter, handleMouseLeave } = useHoverEffect();

  const [settings, setSettings] = useState<ApiSettings>(() => storageService.getSettings());

  // Note: we intentionally do NOT sync active provider/model from settingsSaved events,
  // so the chat header model selector state is decoupled from the settings page provider.

  useEffect(() => {
    const handleSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<ApiSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      } else {
        setSettings(storageService.getSettings());
      }
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdated as EventListener);

    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdated as EventListener);
    };
  }, []);

  // For model fetching, only use provider-specific keys (no global fallback)
  // This prevents unwanted API calls when a provider isn't explicitly configured
  const anthropicKey = settings.anthropicApiKey || '';
  const openaiKey = settings.openaiApiKey || '';
  const openaiCompatibleKey = settings.openaiCompatibleApiKey || '';
  const megallmKey = settings.megallmApiKey || '';

  const {
    models: anthropicModels,
    loadingModels: loadingAnthropic,
    fetchModels: fetchAnthropic,
  } = useModelFetcher('anthropic', settings.anthropicCustomUrl, anthropicKey);

  const {
    models: openaiModels,
    loadingModels: loadingOpenai,
    fetchModels: fetchOpenai,
  } = useModelFetcher('openai', settings.openaiCustomUrl, openaiKey);

  const {
    models: openaiCompatibleModels,
    loadingModels: loadingOpenaiCompatible,
    fetchModels: fetchOpenaiCompatible,
  } = useModelFetcher('openai-compatible', settings.openaiCompatibleCustomUrl, openaiCompatibleKey);

  const {
    models: megallmModels,
    loadingModels: loadingMegallm,
    fetchModels: fetchMegallm,
  } = useModelFetcher('megallm', settings.megallmCustomUrl, megallmKey);

  const {
    models: vscodeLmModels,
    loadingModels: loadingVscodeLm,
    fetchModels: fetchVscodeLm,
  } = useModelFetcher('vscode-lm', undefined, '');

  const {
    models: qwenCodeModels,
    loadingModels: loadingQwenCode,
    fetchModels: fetchQwenCode,
  } = useModelFetcher('qwen-code', undefined, '');

  const anyLoading =
    loadingAnthropic ||
    loadingOpenai ||
    loadingOpenaiCompatible ||
    loadingMegallm ||
    loadingVscodeLm ||
    loadingQwenCode;

  useEffect(() => {
    fetchAnthropic();
    fetchOpenai();
    fetchOpenaiCompatible();
    fetchMegallm();
    fetchVscodeLm();
    fetchQwenCode();
  }, [fetchAnthropic, fetchOpenai, fetchOpenaiCompatible, fetchMegallm, fetchVscodeLm, fetchQwenCode]);

  useEffect(() => {
    if (!isOpen) return;

    fetchAnthropic();
    fetchOpenai();
    fetchOpenaiCompatible();
    fetchMegallm();
    fetchVscodeLm();
    fetchQwenCode();
  }, [isOpen, fetchAnthropic, fetchOpenai, fetchOpenaiCompatible, fetchMegallm, fetchVscodeLm, fetchQwenCode]);

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
    setSearch('');
  };

  const selectedProviderLabel =
    PROVIDER_OPTIONS.find((p) => p.value === activeProvider)?.label || 'Select model';

  const buttonLabel = activeModel || 'Select model';

  // Flatten all models into a single array
  const allModels = useMemo(() => {
    const models: Array<{ provider: Provider; providerLabel: string; model: string }> = [];

    if (anthropicModels) models.push(...anthropicModels.map(m => ({ provider: 'anthropic' as Provider, providerLabel: 'Anthropic', model: m })));
    if (openaiModels) models.push(...openaiModels.map(m => ({ provider: 'openai' as Provider, providerLabel: 'OpenAI', model: m })));
    if (openaiCompatibleModels) models.push(...openaiCompatibleModels.map(m => ({ provider: 'openai-compatible' as Provider, providerLabel: 'OpenAI Compatible', model: m })));
    if (megallmModels) models.push(...megallmModels.map(m => ({ provider: 'megallm' as Provider, providerLabel: 'MEGALLM', model: m })));
    if (vscodeLmModels) models.push(...vscodeLmModels.map(m => ({ provider: 'vscode-lm' as Provider, providerLabel: 'VS Code LM (Copilot)', model: m })));
    if (qwenCodeModels) models.push(...qwenCodeModels.map(m => ({ provider: 'qwen-code' as Provider, providerLabel: 'Qwen Code', model: m })));

    return models;
  }, [anthropicModels, openaiModels, openaiCompatibleModels, megallmModels, vscodeLmModels, qwenCodeModels]);

  const searchValue = search.trim().toLowerCase();
  const hasSearch = searchValue.length > 0;

  // Simple filtering - matches model name OR provider label
  const filteredResults = useMemo(() => {
    if (!hasSearch) return allModels;
    return allModels.filter(item =>
      item.model.toLowerCase().includes(searchValue) ||
      item.providerLabel.toLowerCase().includes(searchValue)
    );
  }, [allModels, hasSearch, searchValue]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
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

      {isOpen && (
        <div
          className={`absolute left-0 w-52 rounded-xl border z-[100] ${direction === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'
            }`}
          style={{
            backgroundColor: 'var(--vscode-editor-background)',
            borderColor: 'var(--vscode-input-border)',
          }}
        >
          <div
            className="p-2 border-b"
            style={{ borderColor: 'var(--vscode-input-border)' }}
          >
            <div className="flex items-center gap-1">
              <div
                className="relative flex-1 rounded-md border"
                style={{
                  backgroundColor: 'var(--vscode-input-background)',
                  borderColor: 'var(--vscode-input-border)',
                }}
              >
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models..."
                  className="w-full bg-transparent text-xs border-0 rounded-md py-1.5 pl-6 pr-2 placeholder-opacity-50"
                  style={{
                    color: 'var(--vscode-input-foreground)',
                    outline: 'none',
                  }}
                  autoFocus
                />
                <Search
                  className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--vscode-input-foreground)', opacity: 0.6 }}
                />
              </div>
              <button
                type="button"
                onClick={requestModelsRefresh}
                className="flex items-center justify-center rounded-md border px-1.5 py-1 text-[10px] min-w-[28px] h-7"
                style={{
                  backgroundColor: 'var(--vscode-input-background)',
                  borderColor: 'var(--vscode-input-border)',
                  color: 'var(--vscode-input-foreground)',
                }}
                title="Refresh models"
              >
                <RefreshCcw className={`w-3 h-3 ${anyLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div
            className="overflow-y-auto max-h-48 overflow-hidden rounded-b-xl"
            style={{ backgroundColor: 'transparent' }}
          >
            {anyLoading && filteredResults.length === 0 && (
              <div className="px-2 py-1.5 text-[11px] opacity-70">
                Loading models...
              </div>
            )}

            {filteredResults.length === 0 && !anyLoading ? (
              <div className="px-2 py-1.5 text-[11px] opacity-70">
                {hasSearch ? 'No models match your search.' : 'No providers configured.'}
              </div>
            ) : (
              <div key={`list-${searchValue}`} className="flex flex-col">
                {filteredResults.map((item, index) => {
                  const isSelected =
                    item.provider === activeProvider && item.model === activeModel;
                  const isLast = index === filteredResults.length - 1;

                  return (
                    <button
                      key={`${item.provider}:${item.model}`}
                      type="button"
                      onClick={() => handleSelectModel(item.provider, item.model)}
                      className={`w-full px-3 py-1.5 text-left transition-colors flex items-center justify-between ${isLast ? 'rounded-b-xl' : ''}`}
                      style={{
                        backgroundColor: isSelected
                          ? 'var(--vscode-list-activeSelectionBackground)'
                          : 'transparent',
                        color: isSelected
                          ? 'var(--vscode-list-activeSelectionForeground)'
                          : 'var(--vscode-foreground)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="text-xs leading-tight truncate">{item.model}</div>
                        <div className="text-[10px] opacity-60 leading-tight mt-0.5 truncate">
                          {item.providerLabel}
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const ChatModelSelector = memo(ChatModelSelectorComponent);
