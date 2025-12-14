import { useState, useMemo } from 'react';
import type { ContextSettings, Provider } from '../../types/api-settings';
import { ToggleSwitch } from '../ui/toggle-switch';
import { SettingsModelSelector } from '../ui/settings-model-selector';

interface ContextSettingsTabProps {
  contextSettings: ContextSettings;
  onChange: (settings: ContextSettings) => void;
}

export function ContextSettingsTab({ contextSettings, onChange }: ContextSettingsTabProps) {
  const [isEditingTokens, setIsEditingTokens] = useState(false);
  const [tokensInputValue, setTokensInputValue] = useState('');
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [thresholdInputValue, setThresholdInputValue] = useState('');

  // Max context tokens display value
  const tokensDisplayValue = useMemo(() => {
    return isEditingTokens ? tokensInputValue :
      (contextSettings.maxContextTokens === undefined ||
        Number.isNaN(contextSettings.maxContextTokens) ||
        contextSettings.maxContextTokens === 128000 ? '' : String(contextSettings.maxContextTokens));
  }, [contextSettings.maxContextTokens, isEditingTokens, tokensInputValue]);

  // Threshold display value (show as percentage)
  const thresholdDisplayValue = useMemo(() => {
    if (isEditingThreshold) return thresholdInputValue;
    const threshold = contextSettings.summarizationThreshold ?? 0.85;
    return String(Math.round(threshold * 100));
  }, [contextSettings.summarizationThreshold, isEditingThreshold, thresholdInputValue]);

  const handleTokensFocus = () => {
    setIsEditingTokens(true);
    setTokensInputValue(
      contextSettings.maxContextTokens === undefined ||
        Number.isNaN(contextSettings.maxContextTokens) ||
        contextSettings.maxContextTokens === 128000 ? '' : String(contextSettings.maxContextTokens)
    );
  };

  const handleTokensChange = (value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setTokensInputValue(value);
    }
  };

  const handleTokensCommit = () => {
    setIsEditingTokens(false);
    if (tokensInputValue === '') {
      onChange({ ...contextSettings, maxContextTokens: 128000 });
      return;
    }

    const parsed = Number(tokensInputValue);
    if (!Number.isNaN(parsed)) {
      onChange({ ...contextSettings, maxContextTokens: parsed });
    }
  };

  const handleThresholdFocus = () => {
    setIsEditingThreshold(true);
    const threshold = contextSettings.summarizationThreshold ?? 0.85;
    setThresholdInputValue(String(Math.round(threshold * 100)));
  };

  const handleThresholdChange = (value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setThresholdInputValue(value);
    }
  };

  const handleThresholdCommit = () => {
    setIsEditingThreshold(false);
    if (thresholdInputValue === '') {
      onChange({ ...contextSettings, summarizationThreshold: 0.85 });
      return;
    }

    const parsed = Number(thresholdInputValue);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      onChange({ ...contextSettings, summarizationThreshold: parsed / 100 });
    }
  };

  const handleSummarizationToggle = () => {
    onChange({ ...contextSettings, summarizationEnabled: !contextSettings.summarizationEnabled });
  };

  const handleModelChange = (provider: Provider, model: string) => {
    onChange({
      ...contextSettings,
      summarizationProvider: provider,
      summarizationModel: model,
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Context Management Section */}
      <div className="space-y-4">
        <h2
          className="text-sm font-bold pb-2 border-b"
          style={{
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)'
          }}
        >
          Context Management
        </h2>

        <div className="space-y-2">
          <label
            htmlFor="maxContextTokens"
            className="block text-xs font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Max Context Tokens (Optional)
          </label>
          <input
            id="maxContextTokens"
            type="text"
            inputMode="numeric"
            value={tokensDisplayValue}
            onChange={(e) => handleTokensChange(e.target.value)}
            onFocus={handleTokensFocus}
            onBlur={handleTokensCommit}
            placeholder="128000"
            className="w-full px-3 py-2 text-sm rounded-xl border transition-colors"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              borderColor: 'var(--vscode-input-border)',
            }}
          />
          <p
            className="text-xs"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            Maximum tokens for context window
          </p>
        </div>
      </div>

      {/* Auto-Summarization Section */}
      <div className="space-y-4">
        <h2
          className="text-sm font-bold pb-2 border-b"
          style={{
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)'
          }}
        >
          Auto-Summarization
        </h2>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <label
              className="block text-xs font-semibold"
              style={{ color: 'var(--vscode-foreground)' }}
            >
              Enable Auto-Summarization
            </label>
            <p
              className="text-xs"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              Automatically compress context when threshold is reached
            </p>
          </div>
          <ToggleSwitch
            checked={contextSettings.summarizationEnabled ?? false}
            onChange={handleSummarizationToggle}
          />
        </div>

        {/* Summarization Model Selector */}
        <div
          className={`space-y-4 transition-opacity ${contextSettings.summarizationEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}
        >
          <SettingsModelSelector
            provider={contextSettings.summarizationProvider ?? 'anthropic'}
            model={contextSettings.summarizationModel ?? ''}
            onChange={handleModelChange}
            label="Summarization Model"
            disabled={!contextSettings.summarizationEnabled}
          />

          {/* Threshold Input */}
          <div className="space-y-2">
            <label
              htmlFor="summarizationThreshold"
              className="block text-xs font-semibold"
              style={{ color: 'var(--vscode-foreground)' }}
            >
              Summarization Threshold (%)
            </label>
            <input
              id="summarizationThreshold"
              type="text"
              inputMode="numeric"
              value={thresholdDisplayValue}
              onChange={(e) => handleThresholdChange(e.target.value)}
              onFocus={handleThresholdFocus}
              onBlur={handleThresholdCommit}
              placeholder="85"
              disabled={!contextSettings.summarizationEnabled}
              className="w-full px-3 py-2 text-sm rounded-xl border transition-colors disabled:opacity-50"
              style={{
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                borderColor: 'var(--vscode-input-border)',
              }}
            />
            <p
              className="text-xs"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              Trigger summarization when context usage reaches this percentage (1-100)
            </p>
          </div>

          {/* Info Box */}
          <div
            className="p-3 rounded-xl border text-xs space-y-2"
            style={{
              backgroundColor: 'var(--vscode-textBlockQuote-background)',
              borderColor: 'var(--vscode-panel-border)',
              color: 'var(--vscode-descriptionForeground)',
            }}
          >
            <p className="font-medium" style={{ color: 'var(--vscode-foreground)' }}>
              How it works:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>When context usage exceeds the threshold, middle messages are summarized</li>
              <li>First message (original context) and recent messages are preserved</li>
              <li>Summary is used as context for continued conversation</li>
              <li>Summarization can happen multiple times as conversation grows</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}