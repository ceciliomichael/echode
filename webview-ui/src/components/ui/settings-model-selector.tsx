import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, Cpu, RefreshCcw } from 'lucide-react';
import type { ApiSettings, Provider } from '../../types/api-settings';
import { storageService } from '../../utils/storage';
import { useModelFetcher, requestModelsRefresh } from '../../hooks/use-model-fetcher';
import { CustomModelFetcher } from './custom-model-fetcher';

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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const DROPDOWN_HEIGHT = 200;

  // Calculate and update dropdown position
  const updatePosition = () => {
    if (buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      const isUpward = spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow;

      setDropdownStyle({
        position: 'fixed',
        top: isUpward ? 'auto' : `${buttonRect.bottom + 4}px`,
        bottom: isUpward ? `${window.innerHeight - buttonRect.top + 4}px` : 'auto',
        left: `${buttonRect.left}px`,
        width: `${buttonRect.width}px`,
        maxHeight: `${DROPDOWN_HEIGHT}px`,
        zIndex: 9999,
      });
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
      updatePosition();
    };

    // Listen to all scroll events (capture phase) and resize
    document.addEventListener('scroll', handlePositionUpdate, true);
    window.addEventListener('resize', handlePositionUpdate);
    // Also update immediately
    handlePositionUpdate();

    return () => {
      document.removeEventListener('scroll', handlePositionUpdate, true);
      window.removeEventListener('resize', handlePositionUpdate);
    };
  }, [isOpen]);

  const [settings, setSettings] = useState<ApiSettings>(() => storageService.getSettings());
  const [customModels, setCustomModels] = useState<Record<string, { models: string[]; loading: boolean }>>({});

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

  const anyLoading =
    loadingAnthropic ||
    loadingOpenai ||
    loadingOpenaiCompatible ||
    loadingMegallm ||
    loadingVscodeLm ||
    loadingQwenCode ||
    Object.values(customModels).some(m => m.loading);

  const handleCustomModelsFetched = useCallback((provider: Provider, models: string[], loading: boolean) => {
    setCustomModels(prev => {
      // Only update if changed to avoid render loops
      const current = prev[provider];
      if (current && current.loading === loading && JSON.stringify(current.models) === JSON.stringify(models)) {
        return prev;
      }
      return {
        ...prev,
        [provider]: { models, loading }
      };
    });
  }, []);

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
      const target = event.target as Node;
      const clickedOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      const clickedOutsidePortal = portalRef.current && !portalRef.current.contains(target);

      if (clickedOutsideDropdown && clickedOutsidePortal) {
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

  // Flatten all models into a single array
  const allModels = useMemo(() => {
    const models: Array<{ provider: Provider; providerLabel: string; model: string }> = [];

    if (anthropicModels) models.push(...anthropicModels.map(m => ({ provider: 'anthropic' as Provider, providerLabel: 'Anthropic', model: m })));
    if (openaiModels) models.push(...openaiModels.map(m => ({ provider: 'openai' as Provider, providerLabel: 'OpenAI', model: m })));
    if (openaiCompatibleModels) models.push(...openaiCompatibleModels.map(m => ({ provider: 'openai-compatible' as Provider, providerLabel: 'OpenAI Compatible', model: m })));
    if (megallmModels) models.push(...megallmModels.map(m => ({ provider: 'megallm' as Provider, providerLabel: 'MEGALLM', model: m })));
    if (vscodeLmModels) models.push(...vscodeLmModels.map(m => ({ provider: 'vscode-lm' as Provider, providerLabel: 'VS Code LM (Copilot)', model: m })));
    if (qwenCodeModels) models.push(...qwenCodeModels.map(m => ({ provider: 'qwen-code' as Provider, providerLabel: 'Qwen Code', model: m })));

    // Add custom provider models
    if (settings.customProviders) {
      settings.customProviders.forEach(cp => {
        const providerId = `custom-${cp.id}`;
        const data = customModels[providerId];
        if (data && data.models) {
          models.push(...data.models.map(m => ({
            provider: providerId as Provider,
            providerLabel: cp.name,
            model: m
          })));
        }
      });
    }

    return models;
  }, [anthropicModels, openaiModels, openaiCompatibleModels, megallmModels, vscodeLmModels, qwenCodeModels, customModels, settings.customProviders]);

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

        {isOpen && createPortal(
          <div
            ref={portalRef}
            className="fixed rounded-xl border overflow-hidden"
            style={{
              backgroundColor: 'var(--vscode-editor-background)',
              borderColor: 'var(--vscode-input-border)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              ...dropdownStyle,
            }}
          >
            <div
              className="p-2 border-b"
              style={{ borderColor: 'var(--vscode-input-border)' }}
            >
              <div className="flex items-center gap-1">
                <div
                  className="relative flex-1 rounded-xl border"
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
                    className="w-full bg-transparent text-xs border-0 rounded-xl py-1.5 pl-6 pr-2 placeholder-opacity-50"
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
                  className="flex items-center justify-center rounded-xl border px-1.5 py-1 text-[10px] min-w-[28px] h-7"
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

            <div className="overflow-y-auto" style={{ maxHeight: `${DROPDOWN_HEIGHT - 60}px` }}>
              {anyLoading && filteredResults.length === 0 && (
                <div className="px-2 py-1.5 text-xs opacity-70">
                  Loading models...
                </div>
              )}

              {filteredResults.length === 0 && !anyLoading ? (
                <div className="px-2 py-1.5 text-xs opacity-70">
                  {hasSearch ? 'No models match your search.' : 'No providers configured. Add API keys in API Configuration.'}
                </div>
              ) : (
                <div key={`list-${searchValue}`} className="flex flex-col">
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
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
