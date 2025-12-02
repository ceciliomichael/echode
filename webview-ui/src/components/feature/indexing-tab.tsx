import { useEffect, useState, useRef, useMemo } from 'react';
import { Check, ChevronDown, Search, Cpu } from 'lucide-react';
import type {
  Provider,
  IndexingSettings,
  ApiSettings,
} from '../../types/api-settings';
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

// Default values for indexing settings
const DEFAULTS = {
  maxIterations: 5,
  maxFiles: 100,
  maxSnippets: 20,
};

interface IndexingTabProps {
  indexingSettings: IndexingSettings;
  onChange: (settings: IndexingSettings) => void;
}

export function IndexingTab({ indexingSettings, onChange }: IndexingTabProps) {
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const modelRef = useRef<HTMLDivElement>(null);

  // Input state for controlled editing
  const [maxIterationsInput, setMaxIterationsInput] = useState('');
  const [maxFilesInput, setMaxFilesInput] = useState('');
  const [maxSnippetsInput, setMaxSnippetsInput] = useState('');
  const [isEditingIterations, setIsEditingIterations] = useState(false);
  const [isEditingFiles, setIsEditingFiles] = useState(false);
  const [isEditingSnippets, setIsEditingSnippets] = useState(false);

  // Display values - show empty when equals default
  const maxIterationsDisplay = useMemo(() => {
    if (isEditingIterations) return maxIterationsInput;
    return indexingSettings.maxIterations === DEFAULTS.maxIterations ? '' : String(indexingSettings.maxIterations);
  }, [indexingSettings.maxIterations, isEditingIterations, maxIterationsInput]);

  const maxFilesDisplay = useMemo(() => {
    if (isEditingFiles) return maxFilesInput;
    return indexingSettings.maxFiles === DEFAULTS.maxFiles ? '' : String(indexingSettings.maxFiles);
  }, [indexingSettings.maxFiles, isEditingFiles, maxFilesInput]);

  const maxSnippetsDisplay = useMemo(() => {
    if (isEditingSnippets) return maxSnippetsInput;
    return indexingSettings.maxSnippets === DEFAULTS.maxSnippets ? '' : String(indexingSettings.maxSnippets);
  }, [indexingSettings.maxSnippets, isEditingSnippets, maxSnippetsInput]);

  // Handlers for numeric inputs
  const handleNumericInput = (value: string, setter: (v: string) => void) => {
    if (value === '' || /^\d+$/.test(value)) {
      setter(value);
    }
  };

  const commitMaxIterations = () => {
    setIsEditingIterations(false);
    const parsed = maxIterationsInput === '' ? DEFAULTS.maxIterations : Number(maxIterationsInput);
    if (!Number.isNaN(parsed)) {
      onChange({ ...indexingSettings, maxIterations: parsed });
    }
  };

  const commitMaxFiles = () => {
    setIsEditingFiles(false);
    const parsed = maxFilesInput === '' ? DEFAULTS.maxFiles : Number(maxFilesInput);
    if (!Number.isNaN(parsed)) {
      onChange({ ...indexingSettings, maxFiles: parsed });
    }
  };

  const commitMaxSnippets = () => {
    setIsEditingSnippets(false);
    const parsed = maxSnippetsInput === '' ? DEFAULTS.maxSnippets : Number(maxSnippetsInput);
    if (!Number.isNaN(parsed)) {
      onChange({ ...indexingSettings, maxSnippets: parsed });
    }
  };

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

  // API keys and URLs for all providers
  const anthropicKey = settings.anthropicApiKey || settings.apiKey || '';
  const openaiKey = settings.openaiApiKey || settings.apiKey || '';
  const openaiCompatibleKey = settings.openaiCompatibleApiKey || settings.apiKey || '';
  const megallmKey = settings.megallmApiKey || settings.apiKey || '';

  // Fetch models for all providers
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

  // Fetch all models on mount
  useEffect(() => {
    fetchAnthropic();
    fetchOpenai();
    fetchOpenaiCompatible();
    fetchMegallm();
    fetchVscodeLm();
    fetchQwenCode();
  }, [fetchAnthropic, fetchOpenai, fetchOpenaiCompatible, fetchMegallm, fetchVscodeLm, fetchQwenCode]);

  // Refetch when dropdown opens
  useEffect(() => {
    if (!isModelOpen) return;
    fetchAnthropic();
    fetchOpenai();
    fetchOpenaiCompatible();
    fetchMegallm();
    fetchVscodeLm();
    fetchQwenCode();
  }, [isModelOpen, fetchAnthropic, fetchOpenai, fetchOpenaiCompatible, fetchMegallm, fetchVscodeLm, fetchQwenCode]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(event.target as Node)) {
        setIsModelOpen(false);
        setModelSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleModelChange = (provider: Provider, model: string) => {
    onChange({ ...indexingSettings, provider, model });
    setIsModelOpen(false);
    setModelSearch('');
  };

  // Search filtering - split into words for flexible matching
  const searchValue = modelSearch.trim().toLowerCase();
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
    <div className="max-w-2xl space-y-6">
      {/* Sub-agent Model Configuration */}
      <div className="space-y-4">
        <h2
          className="text-sm font-bold pb-2 border-b"
          style={{
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)',
          }}
        >
          Sub-Agent Model
        </h2>
        <p
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Configure the AI model used by the echo_search sub-agent for code exploration.
          This model will iteratively search your codebase to find relevant context.
        </p>

        {/* Model Selector */}
        <div className="space-y-2">
          <label
            className="block text-xs font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Model
          </label>
          <div ref={modelRef} className="relative">
            <button
              type="button"
              onClick={() => setIsModelOpen(!isModelOpen)}
              className="w-full px-3 py-2 text-sm rounded-xl border transition-colors flex items-center justify-between"
              style={{
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                borderColor: 'var(--vscode-input-border)',
              }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Cpu size={14} className="flex-shrink-0" />
                <span className="truncate">
                  {indexingSettings.model || 'Select model...'}
                </span>
              </span>
              <ChevronDown size={14} className="flex-shrink-0" />
            </button>

            {isModelOpen && (
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
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
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
                            item.provider === indexingSettings.provider && item.model === indexingSettings.model;

                          return (
                            <button
                              key={`${item.provider}:${item.model}`}
                              type="button"
                              onClick={() => handleModelChange(item.provider, item.model)}
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
                          const isActiveProvider = provider === indexingSettings.provider;

                          return (
                            <div key={provider} className="pt-1">
                              <div className="flex items-center justify-between mb-1.5 px-1">
                                <span className="text-xs font-semibold opacity-70">
                                  {providerOption.label}
                                </span>
                                {isActiveProvider && indexingSettings.model && (
                                  <span className="text-[10px] opacity-60">Active</span>
                                )}
                              </div>

                              <div className="flex flex-col gap-1">
                                {providerModels.map((model) => {
                                  const isSelected =
                                    provider === indexingSettings.provider && model === indexingSettings.model;

                                  return (
                                    <button
                                      key={`${provider}:${model}`}
                                      type="button"
                                      onClick={() => handleModelChange(provider, model)}
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
      </div>

      {/* Search Behavior Configuration */}
      <div className="space-y-4">
        <h2
          className="text-sm font-bold pb-2 border-b"
          style={{
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)',
          }}
        >
          Search Behavior
        </h2>

        {/* Max Iterations */}
        <div className="space-y-2">
          <label
            className="block text-xs font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Max Iterations (Optional)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={maxIterationsDisplay}
            onChange={(e) => handleNumericInput(e.target.value, setMaxIterationsInput)}
            onFocus={() => {
              setIsEditingIterations(true);
              setMaxIterationsInput(indexingSettings.maxIterations === DEFAULTS.maxIterations ? '' : String(indexingSettings.maxIterations));
            }}
            onBlur={commitMaxIterations}
            placeholder={String(DEFAULTS.maxIterations)}
            className="w-full px-3 py-2 text-sm rounded-xl border"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              borderColor: 'var(--vscode-input-border)',
            }}
          />
        </div>

        {/* Max Files */}
        <div className="space-y-2">
          <label
            className="block text-xs font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Max Files to Scan (Optional)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={maxFilesDisplay}
            onChange={(e) => handleNumericInput(e.target.value, setMaxFilesInput)}
            onFocus={() => {
              setIsEditingFiles(true);
              setMaxFilesInput(indexingSettings.maxFiles === DEFAULTS.maxFiles ? '' : String(indexingSettings.maxFiles));
            }}
            onBlur={commitMaxFiles}
            placeholder={String(DEFAULTS.maxFiles)}
            className="w-full px-3 py-2 text-sm rounded-xl border"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              borderColor: 'var(--vscode-input-border)',
            }}
          />
        </div>

        {/* Max Snippets */}
        <div className="space-y-2">
          <label
            className="block text-xs font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Max Snippets to Return (Optional)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={maxSnippetsDisplay}
            onChange={(e) => handleNumericInput(e.target.value, setMaxSnippetsInput)}
            onFocus={() => {
              setIsEditingSnippets(true);
              setMaxSnippetsInput(indexingSettings.maxSnippets === DEFAULTS.maxSnippets ? '' : String(indexingSettings.maxSnippets));
            }}
            onBlur={commitMaxSnippets}
            placeholder={String(DEFAULTS.maxSnippets)}
            className="w-full px-3 py-2 text-sm rounded-xl border"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              borderColor: 'var(--vscode-input-border)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
