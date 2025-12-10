import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, Cpu, RefreshCcw } from 'lucide-react';
import type { ApiSettings, Provider } from '../../types/api-settings';
import { storageService } from '../../utils/storage';
import { useModelFetcher, requestModelsRefresh } from '../../hooks/use-model-fetcher';
import { buildFilteredModelResults } from '../../utils/model-search';

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
  disabled?: boolean;
}

export function SettingsModelSelector({
  provider: activeProvider,
  model: activeModel,
  onChange,
  label = 'Model',
  icon,
  disabled = false,
}: SettingsModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [openUpward, setOpenUpward] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const DROPDOWN_HEIGHT = 280;

  // Calculate and update dropdown position
  const updatePosition = () => {
    if (buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      setOpenUpward(spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow);
    }
  };

  // Handle dropdown toggle with position detection
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  // Update position on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;

    const handlePositionUpdate = () => {
      if (buttonRef.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;
        setOpenUpward(spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow);
      }
    };

    // Listen to all scroll events (capture phase) and resize
    document.addEventListener('scroll', handlePositionUpdate, true);
    window.addEventListener('resize', handlePositionUpdate);

    return () => {
      document.removeEventListener('scroll', handlePositionUpdate, true);
      window.removeEventListener('resize', handlePositionUpdate);
    };
  }, [isOpen]);

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

  // Fetch for all providers when dropdown opens; useModelFetcher and its
  // shared cache will avoid redundant network calls when data is fresh
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

  const filteredResults = hasSearch
    ? buildFilteredModelResults(searchValue, PROVIDER_OPTIONS, modelsByProvider)
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
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm rounded-xl border transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
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
            className={`absolute w-full rounded-xl border overflow-hidden ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
              }`}
            style={{
              backgroundColor: 'var(--vscode-editor-background)',
              borderColor: 'var(--vscode-input-border)',
              maxHeight: `${DROPDOWN_HEIGHT}px`,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 9999,
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
                  <RefreshCcw className={anyLoading ? 'animate-spin' : ''} size={13} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
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
                  <div className="flex flex-col">
                    {filteredResults.map((item) => {
                      const isSelected =
                        item.provider === activeProvider && item.model === activeModel;

                      return (
                        <button
                          key={`${item.provider}:${item.model}`}
                          type="button"
                          onClick={() => handleSelectModel(item.provider, item.model)}
                          className="w-full px-3 py-2 text-left transition-colors flex items-center justify-between"
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
                          <div className="flex items-center justify-between mb-1 px-3">
                            <span className="text-xs font-semibold opacity-70">
                              {providerOption.label}
                            </span>
                            {isActiveProvider && activeModel && (
                              <span className="text-[10px] opacity-60">Active</span>
                            )}
                          </div>

                          <div className="flex flex-col">
                            {providerModels.map((model) => {
                              const isSelected =
                                provider === activeProvider && model === activeModel;

                              return (
                                <button
                                  key={`${provider}:${model}`}
                                  type="button"
                                  onClick={() => handleSelectModel(provider, model)}
                                  className="w-full px-3 py-2 text-left transition-colors flex items-center justify-between"
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
