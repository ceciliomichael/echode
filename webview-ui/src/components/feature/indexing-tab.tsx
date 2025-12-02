import { useState, useMemo } from 'react';
import { Cpu } from 'lucide-react';
import type {
  Provider,
  IndexingSettings,
} from '../../types/api-settings';
import { SettingsModelSelector } from '../ui/settings-model-selector';

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

  const handleModelChange = (provider: Provider, model: string) => {
    onChange({ ...indexingSettings, provider, model });
  };

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
        <SettingsModelSelector
          provider={indexingSettings.provider}
          model={indexingSettings.model}
          onChange={handleModelChange}
          icon={<Cpu size={14} className="flex-shrink-0" />}
        />
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
