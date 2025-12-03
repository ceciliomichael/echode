import { MessageSquare } from 'lucide-react';

interface SystemPromptTabProps {
  value: string;
  onChange: (value: string) => void;
}

export function SystemPromptTab({ value, onChange }: SystemPromptTabProps) {
  return (
    <div className="max-w-3xl">
      <div className="mb-6 sm:mb-8">
        <div 
          className="flex items-center gap-2 mb-2"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          <MessageSquare size={18} strokeWidth={1.5} />
          <h2 className="text-base sm:text-lg font-semibold">System Prompt</h2>
        </div>
        <p 
          className="text-xs sm:text-sm leading-relaxed"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Define custom instructions that shape the AI's behavior and responses. These instructions will be included in every conversation to guide how the assistant interacts with you.
        </p>
      </div>

      <div className="space-y-3">
        <label
          htmlFor="systemPrompt"
          className="block text-xs sm:text-sm font-medium"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Custom Instructions
        </label>
        <textarea
          id="systemPrompt"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your custom instructions here...&#10;&#10;Example:&#10;- Always provide code examples when explaining concepts&#10;- Use concise language and avoid unnecessary explanations&#10;- Focus on best practices and modern patterns"
          rows={14}
          className="w-full px-4 py-3 text-sm rounded-xl border resize-none transition-all font-mono"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)',
            minHeight: '320px',
            lineHeight: '1.6'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--vscode-focusBorder)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--vscode-input-border)';
          }}
        />
        <p 
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Changes are saved automatically. Leave empty to use default behavior.
        </p>
      </div>
    </div>
  );
}
