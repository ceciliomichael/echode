interface GenerationParamsSectionProps {
  maxTokens: number;
  temperature: number;
  onMaxTokensChange: (value: number) => void;
  onTemperatureChange: (value: number) => void;
}

export function GenerationParamsSection({
  maxTokens,
  temperature,
  onMaxTokensChange,
  onTemperatureChange
}: GenerationParamsSectionProps) {
  return (
    <div className="space-y-4">
      <h2 
        className="text-sm font-bold pb-2 border-b"
        style={{ 
          color: 'var(--vscode-foreground)',
          borderColor: 'var(--vscode-panel-border)'
        }}
      >
        Generation Parameters
      </h2>

      <div className="space-y-2">
        <label
          htmlFor="maxTokens"
          className="block text-xs font-semibold"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Max Tokens (Optional)
        </label>
        <input
          id="maxTokens"
          type="text"
          value={maxTokens || ''}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || /^\d+$/.test(value)) {
              onMaxTokensChange(value === '' ? 8192 : Number(value));
            }
          }}
          placeholder="Default: 8192"
          className="w-full px-3 py-2 text-sm rounded-xl border transition-colors"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)'
          }}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="temperature"
          className="block text-xs font-semibold"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Temperature (Optional)
        </label>
        <input
          id="temperature"
          type="text"
          value={temperature ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || /^\d*\.?\d*$/.test(value)) {
              onTemperatureChange(value === '' ? 0 : Number(value));
            }
          }}
          placeholder="Default: 0"
          className="w-full px-3 py-2 text-sm rounded-xl border transition-colors"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)'
          }}
        />
      </div>
    </div>
  );
}
