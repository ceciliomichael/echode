import { useState, useRef, useEffect } from 'react';
import { useHoverEffect, hoverPresets } from '../../hooks/use-hover-effect';
import { Check, Cpu, Search } from 'lucide-react';
import type { ApiSettings, Provider } from '../../types/api-settings';
import { storageService } from '../../utils/storage';
import { useModelFetcher } from '../../hooks/use-model-fetcher';

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

export function ChatModelSelector({ provider: activeProvider, model: activeModel, onChange, disabled = false, direction = 'up' }: ChatModelSelectorProps) {
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

  const anthropicKey = settings.anthropicApiKey || settings.apiKey || '';
  const openaiKey = settings.openaiApiKey || settings.apiKey || '';
  const openaiCompatibleKey = settings.openaiCompatibleApiKey || settings.apiKey || '';
  const megallmKey = settings.megallmApiKey || settings.apiKey || '';

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

  const modelsByProvider: Record<Provider, string[]> = {
    anthropic: anthropicModels,
    openai: openaiModels,
    'openai-compatible': openaiCompatibleModels,
    megallm: megallmModels,
    'vscode-lm': vscodeLmModels,
    'qwen-code': qwenCodeModels,
  };

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

  const searchValue = search.trim().toLowerCase();
  const hasSearch = searchValue.length > 0;

  // Split search into words for flexible matching (e.g., "claude sonnet" matches "claude-3-5-sonnet")
  const searchWords = searchValue.split(/\s+/).filter(Boolean);

  const filteredResults = hasSearch
    ? PROVIDER_OPTIONS.flatMap((providerOption) => {
        const providerModels = modelsByProvider[providerOption.value] || [];
        return providerModels
          .filter((model) => {
            const modelLower = model.toLowerCase();
            // Match if ALL search words are found anywhere in the model name
            return searchWords.every((word) => modelLower.includes(word));
          })
          .map((model) => ({
            provider: providerOption.value,
            providerLabel: providerOption.label,
            model,
          }));
      })
    : [];

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
          className={`absolute left-0 w-52 rounded-xl border z-[100] ${
            direction === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'
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
            <div
              className="relative rounded-md border"
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
          </div>

          <div
            className="overflow-y-auto max-h-48 overflow-hidden rounded-b-xl"
            style={{ backgroundColor: 'transparent' }}
          >
            {anyLoading && !hasSearch && (
              <div className="px-2 py-1.5 text-[11px] opacity-70">
                Loading models...
              </div>
            )}

            {hasSearch ? (
              filteredResults.length === 0 ? (
                <div className="px-2 py-1.5 text-[11px] opacity-70">
                  No models match your search.
                </div>
              ) : (
                <div className="flex flex-col">
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
              )
            ) : (
              <div className="flex flex-col">
                {PROVIDER_OPTIONS
                  .filter((providerOption) => {
                    const providerModels = modelsByProvider[providerOption.value] || [];
                    return providerModels.length > 0;
                  })
                  .map((providerOption) => {
                    const provider = providerOption.value;
                    const providerModels = modelsByProvider[provider] || [];
                    const isActiveProvider = provider === activeProvider;

                    return (
                      <div key={provider} className="pt-1">
                        <div className="flex items-center justify-between mb-0.5 px-3">
                          <span className="text-[11px] font-semibold opacity-70">
                            {providerOption.label}
                          </span>
                          {isActiveProvider && activeModel && (
                            <span className="text-[10px] opacity-60">Active</span>
                          )}
                        </div>

                        <div className="flex flex-col">
                          {providerModels.map((model, modelIndex) => {
                            const isSelected =
                              provider === activeProvider && model === activeModel;
                            const isLastModel = modelIndex === providerModels.length - 1;

                            return (
                              <button
                                key={`${provider}:${model}`}
                                type="button"
                                onClick={() => handleSelectModel(provider, model)}
                                className={`w-full px-3 py-1.5 text-left transition-colors flex items-center justify-between ${isLastModel ? 'rounded-b-xl' : ''}`}
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
                                <span className="text-xs leading-tight truncate">{model}</span>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                {PROVIDER_OPTIONS.every((p) => (modelsByProvider[p.value] || []).length === 0) && !anyLoading && (
                  <div className="px-2 py-1.5 text-[11px] opacity-70">
                    No providers configured.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
