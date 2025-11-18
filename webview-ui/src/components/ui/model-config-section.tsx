import { ModelDropdown } from './model-dropdown';

interface ModelConfigSectionProps {
  model: string;
  models: string[];
  loadingModels: boolean;
  onModelChange: (value: string) => void;
  onModelDropdownOpen?: () => void;
  onRefreshModels?: () => void;
}

export function ModelConfigSection({
  model,
  models,
  loadingModels,
  onModelChange,
  onModelDropdownOpen,
  onRefreshModels
}: ModelConfigSectionProps) {
  return (
    <div className="space-y-4">
      <h2 
        className="text-sm font-bold pb-2 border-b"
        style={{ 
          color: 'var(--vscode-foreground)',
          borderColor: 'var(--vscode-panel-border)'
        }}
      >
        Model Configuration
      </h2>

      <div className="space-y-2">
        <label
          htmlFor="model"
          className="block text-xs font-semibold"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Model Name {loadingModels && <span className="text-xs font-normal opacity-60">(Loading...)</span>}
        </label>
        <ModelDropdown
          value={model}
          onChange={onModelChange}
          models={models.length > 0 ? models : [model].filter(Boolean)}
          disabled={loadingModels}
          onOpen={onModelDropdownOpen}
          onRefresh={onRefreshModels}
          isRefreshing={loadingModels}
        />
      </div>
    </div>
  );
}
