import { useState, useMemo } from 'react';
import type { ContextSettings } from '../../types/api-settings';

interface ContextSettingsTabProps {
  contextSettings: ContextSettings;
  onChange: (settings: ContextSettings) => void;
}

export function ContextSettingsTab({ contextSettings, onChange }: ContextSettingsTabProps) {
  const [isEditingTokens, setIsEditingTokens] = useState(false);
  const [tokensInputValue, setTokensInputValue] = useState('');

  // Max context tokens display value
  const tokensDisplayValue = useMemo(() => {
    return isEditingTokens ? tokensInputValue :
      (contextSettings.maxContextTokens === undefined ||
        Number.isNaN(contextSettings.maxContextTokens) ||
        contextSettings.maxContextTokens === 128000 ? '' : String(contextSettings.maxContextTokens));
  }, [contextSettings.maxContextTokens, isEditingTokens, tokensInputValue]);

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
    </div>
  );
}