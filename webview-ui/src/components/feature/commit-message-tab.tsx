import { GitCommit } from 'lucide-react';
import type {
  Provider,
  CommitMessageSettings,
} from '../../types/api-settings';
import { SettingsModelSelector } from '../ui/settings-model-selector';

interface CommitMessageTabProps {
  commitMessageSettings: CommitMessageSettings;
  onChange: (settings: CommitMessageSettings) => void;
}

export function CommitMessageTab({ commitMessageSettings, onChange }: CommitMessageTabProps) {
  const handleModelChange = (provider: Provider, model: string) => {
    onChange({ ...commitMessageSettings, provider, model });
  };

  const handleCustomPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...commitMessageSettings, customPrompt: e.target.value });
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Commit Message Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <GitCommit size={18} style={{ color: 'var(--vscode-foreground)' }} />
          <h2
            className="text-sm font-bold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Commit Message
          </h2>
        </div>
        <p
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Configure the AI model used to generate Git commit messages from staged changes.
          Select a dedicated model for commit message generation.
        </p>
      </div>

      {/* Model Selector */}
      <div className="space-y-4">
        <h3
          className="text-sm font-bold pb-2 border-b"
          style={{
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)',
          }}
        >
          Model Configuration
        </h3>

        <SettingsModelSelector
          provider={commitMessageSettings.provider}
          model={commitMessageSettings.model}
          onChange={handleModelChange}
          icon={<GitCommit size={14} className="flex-shrink-0" />}
        />

        {/* Status indicator */}
        {commitMessageSettings.model && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl"
            style={{
              backgroundColor: 'var(--vscode-inputValidation-infoBackground)',
              borderColor: 'var(--vscode-inputValidation-infoBorder)',
            }}
          >
            <GitCommit size={14} style={{ color: 'var(--vscode-inputValidation-infoForeground)' }} />
            <span
              className="text-xs"
              style={{ color: 'var(--vscode-inputValidation-infoForeground)' }}
            >
              Commit messages will use <strong>{commitMessageSettings.model}</strong>
            </span>
          </div>
        )}

        {!commitMessageSettings.model && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl"
            style={{
              backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
            }}
          >
            <span
              className="text-xs"
              style={{ color: 'var(--vscode-inputValidation-warningForeground)' }}
            >
              Please select a model to enable commit message generation
            </span>
          </div>
        )}
      </div>

      {/* Custom Prompt Section */}
      <div className="space-y-4">
        <h3
          className="text-sm font-bold pb-2 border-b"
          style={{
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)',
          }}
        >
          Custom Style Prompt (Optional)
        </h3>

        <p
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Add custom instructions to customize the commit message style. 
          This will be appended to the default commit message generation prompt.
        </p>

        <textarea
          value={commitMessageSettings.customPrompt}
          onChange={handleCustomPromptChange}
          placeholder="e.g., Always include ticket numbers like JIRA-123 at the start. Use emoji prefixes for commit types."
          className="w-full h-32 px-3 py-2 text-xs rounded-xl border resize-none"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            borderColor: 'var(--vscode-input-border)',
            color: 'var(--vscode-input-foreground)',
          }}
        />
      </div>
    </div>
  );
}