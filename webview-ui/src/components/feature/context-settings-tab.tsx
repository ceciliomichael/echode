import { Brain } from 'lucide-react';
import type {
  ContextSettings,
} from '../../types/api-settings';

interface ContextSettingsTabProps {
  contextSettings: ContextSettings;
  onChange: (settings: ContextSettings) => void;
}

export function ContextSettingsTab({ contextSettings, onChange }: ContextSettingsTabProps) {
  const handleMaxTokensChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1000) {
      onChange({ ...contextSettings, maxContextTokens: numValue });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Brain size={18} style={{ color: 'var(--vscode-foreground)' }} />
          <h2
            className="text-sm font-bold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Context Management
          </h2>
        </div>
        <p
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Configure context window settings.
        </p>
      </div>

      {/* Context Limits */}
      <div className="space-y-4">
        <div className="p-4 rounded-xl border space-y-2"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            borderColor: 'var(--vscode-input-border)',
          }}
        >
          <label
            className="text-xs font-medium"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Max Context Tokens
          </label>
          <input
            type="number"
            value={contextSettings.maxContextTokens}
            onChange={(e) => handleMaxTokensChange(e.target.value)}
            min={1000}
            step={1000}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              border: '1px solid var(--vscode-input-border)',
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
