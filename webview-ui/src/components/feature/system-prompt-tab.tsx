interface SystemPromptTabProps {
  value: string;
  onChange: (value: string) => void;
}

export function SystemPromptTab({ value, onChange }: SystemPromptTabProps) {
  return (
    <div className="max-w-2xl space-y-2">
      <label
        htmlFor="systemPrompt"
        className="block text-xs font-semibold"
        style={{ color: 'var(--vscode-foreground)' }}
      >
        Custom Instructions
      </label>
      <textarea
        id="systemPrompt"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="You are a helpful AI assistant..."
        rows={12}
        className="w-full px-3 py-2 text-sm rounded-xl border resize-y transition-colors"
        style={{
          backgroundColor: 'var(--vscode-input-background)',
          color: 'var(--vscode-input-foreground)',
          borderColor: 'var(--vscode-input-border)',
          minHeight: '300px'
        }}
      />
    </div>
  );
}
