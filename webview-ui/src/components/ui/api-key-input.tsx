import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function ApiKeyInput({ value, onChange }: ApiKeyInputProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="space-y-2">
      <label
        htmlFor="apiKey"
        className="block text-xs font-semibold"
        style={{ color: 'var(--vscode-foreground)' }}
      >
        API Key
      </label>
      <div className="relative">
        <input
          id="apiKey"
          type={showApiKey ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-... or your API key"
          className="w-full px-3 py-2 pr-10 text-sm rounded-xl border font-mono transition-colors"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)'
          }}
        />
        <button
          type="button"
          onClick={() => setShowApiKey(!showApiKey)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-xl transition-colors"
          style={{ color: 'var(--vscode-foreground)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
        >
          {showApiKey ? (
            <EyeOff size={16} strokeWidth={1.5} />
          ) : (
            <Eye size={16} strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  );
}
