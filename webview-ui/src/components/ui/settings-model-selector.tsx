import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, Cpu } from 'lucide-react';
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

interface SettingsModelSelectorProps {
  provider: Provider;
  model: string;
  onChange: (provider: Provider, model: string) => void;
  label?: string;
  icon?: React.ReactNode;
}

export function SettingsModelSelector({
  provider: activeProvider,
  model: activeModel,
  onChange,
  label = 'Model',
  icon,
}: SettingsModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<ApiSettings>(() => storageService.getSettings());

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
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdated as EventListener);
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

  // Check if any models are already loaded from cache
  const hasAnyModels =
    anthropicModels.length > 0 ||
    openaiModels.length > 0 ||
    openaiCompatibleModels.length > 0 ||
    megallmModels.length > 0 ||
    vscodeLmModels.length > 0 ||
    qwenCodeModels.length > 0;

  // Only fetch when dropdown opens AND no models are cached yet
  useEffect(() => {
    if (!isOpen || hasAnyModels) return;
    fetchAnthropic();
    fetchOpenai();
    fetchOpenaiCompatible();
    fetchMegallm();
    fetchVscodeLm();
    fetchQwenCode();
  }, [isOpen, hasAnyModels, fetchAnthropic, fetchOpenai, fetchOpenaiCompatible, fetchMegallm, fetchVscodeLm, fetchQwenCode]);

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

  const handleSelectModel = (provider: Provider, model: string) => {
    onChange(provider, model);
    setIsOpen(false);
    setSearch('');
  };

  const searchValue = search.trim().toLowerCase();
  const hasSearch = searchValue.length > 0;
  const searchWords = searchValue.split(/\s+/).filter(Boolean);

  const filteredResults = hasSearch
    ? PROVIDER_OPTIONS.flatMap((providerOption) => {
        const providerModels = modelsByProvider[providerOption.value] || [];
        return providerModels
          .filter((model) => {
            const modelLower = model.toLowerCase();
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
    <div className="space-y-2">
      <label
        className="block text-xs font-semibold"
        style={{ color: 'var(--vscode-foreground)' }}
      >
        {label}
      </label>
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-sm rounded-xl border transition-colors flex items-center justify-between"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)',
          }}
        >
          <span className="flex items-center gap-2 min-w-0">
            {icon || <Cpu size={14} className="flex-shrink-0" />}
            <span className="truncate">
              {activeModel || 'Select model...'}
            </span>
          </span>
          <ChevronDown size={14} className="flex-shrink-0" />
        </button>

        {isOpen && (
          <div
            className="absolute z-10 w-full mt-1 rounded-xl border overflow-hidden"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              borderColor: 'var(--vscode-input-border)',
              maxHeight: '360px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
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
                  borderColor: 'var(--vscode-input-border)',
                }}
              >
                <Search size={14} style={{ color: 'var(--vscode-input-foreground)', opacity: 0.6 }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models..."
                  className="flex-1 bg-transparent text-sm border-0 p-0"
                  style={{
                    color: 'var(--vscode-input-foreground)',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto p-2" style={{ maxHeight: '280px' }}>
              {anyLoading && !hasSearch && (
                <div className="px-2 py-1.5 text-xs opacity-70">
                  Loading models...
                </div>
              )}

              {hasSearch ? (
                filteredResults.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs opacity-70">
                    No models match your search.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {filteredResults.map((item) => {
                      const isSelected =
                        item.provider === activeProvider && item.model === activeModel;

                      return (
                        <button
                          key={`${item.provider}:${item.model}`}
                          type="button"
                          onClick={() => handleSelectModel(item.provider, item.model)}
                          className="w-full px-3 py-2 text-left rounded-lg transition-colors flex items-center justify-between border"
                          style={{
                            backgroundColor: isSelected
                              ? 'var(--vscode-list-activeSelectionBackground)'
                              : 'transparent',
                            color: isSelected
                              ? 'var(--vscode-list-activeSelectionForeground)'
                              : 'var(--vscode-foreground)',
                            borderColor: isSelected
                              ? 'var(--vscode-list-activeSelectionBackground)'
                              : 'var(--vscode-input-border)',
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
                            <div className="text-sm leading-tight truncate">{item.model}</div>
                            <div className="text-[10px] opacity-60 leading-tight mt-0.5 truncate">
                              {item.providerLabel}
                            </div>
                          </div>
                          {isSelected && <Check size={14} className="flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="flex flex-col gap-2">
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
                          <div className="flex items-center justify-between mb-1.5 px-1">
                            <span className="text-xs font-semibold opacity-70">
                              {providerOption.label}
                            </span>
                            {isActiveProvider && activeModel && (
                              <span className="text-[10px] opacity-60">Active</span>
                            )}
                          </div>

                          <div className="flex flex-col gap-1">
                            {providerModels.map((model) => {
                              const isSelected =
                                provider === activeProvider && model === activeModel;

                              return (
                                <button
                                  key={`${provider}:${model}`}
                                  type="button"
                                  onClick={() => handleSelectModel(provider, model)}
                                  className="w-full px-3 py-2 text-left rounded-lg transition-colors flex items-center justify-between border"
                                  style={{
                                    backgroundColor: isSelected
                                      ? 'var(--vscode-list-activeSelectionBackground)'
                                      : 'transparent',
                                    color: isSelected
                                      ? 'var(--vscode-list-activeSelectionForeground)'
                                      : 'var(--vscode-foreground)',
                                    borderColor: isSelected
                                      ? 'var(--vscode-list-activeSelectionBackground)'
                                      : 'var(--vscode-input-border)',
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
                                  <span className="text-sm leading-tight truncate">{model}</span>
                                  {isSelected && <Check size={14} className="flex-shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  {PROVIDER_OPTIONS.every((p) => (modelsByProvider[p.value] || []).length === 0) && !anyLoading && (
                    <div className="px-2 py-1.5 text-xs opacity-70">
                      No providers configured. Add API keys in API Configuration.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
