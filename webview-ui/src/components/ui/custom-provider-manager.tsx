import { useState } from 'react';
import { Plus, Trash2, Edit2, Check } from 'lucide-react';
import type { CustomProvider, ReasoningEffort } from '../../types/api-settings';
import { ApiKeyInput } from './api-key-input';
import { ReasoningEffortDropdown } from './reasoning-effort-dropdown';

interface CustomProviderManagerProps {
  customProviders: CustomProvider[];
  onAddProvider: (provider: CustomProvider) => void;
  onUpdateProvider: (provider: CustomProvider) => void;
  onDeleteProvider: (id: string) => void;
}

interface ProviderFormData {
  name: string;
  baseUrl: string;
  apiKey: string;
  reasoningEffort?: ReasoningEffort;
}

const INITIAL_FORM_DATA: ProviderFormData = {
  name: '',
  baseUrl: '',
  apiKey: '',
  reasoningEffort: undefined,
};

function generateProviderId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function CustomProviderManager({
  customProviders,
  onAddProvider,
  onUpdateProvider,
  onDeleteProvider,
}: CustomProviderManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProviderFormData>(INITIAL_FORM_DATA);

  const handleStartAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData(INITIAL_FORM_DATA);
  };

  const handleStartEdit = (provider: CustomProvider) => {
    setEditingId(provider.id);
    setIsAdding(false);
    setFormData({
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      reasoningEffort: provider.reasoningEffort,
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(INITIAL_FORM_DATA);
  };

  const handleSaveNew = () => {
    if (!formData.name.trim() || !isValidUrl(formData.baseUrl)) {
      return;
    }

    const newProvider: CustomProvider = {
      id: generateProviderId(),
      name: formData.name.trim(),
      baseUrl: formData.baseUrl.trim(),
      apiKey: formData.apiKey,
      reasoningEffort: formData.reasoningEffort,
      model: '',
      maxTokens: 4096,
      temperature: 0.7,
    };

    onAddProvider(newProvider);
    setIsAdding(false);
    setFormData(INITIAL_FORM_DATA);
  };

  const handleSaveEdit = () => {
    if (!editingId || !formData.name.trim() || !isValidUrl(formData.baseUrl)) {
      return;
    }

    const existingProvider = customProviders.find(p => p.id === editingId);
    if (!existingProvider) {
      return;
    }

    const updatedProvider: CustomProvider = {
      ...existingProvider,
      name: formData.name.trim(),
      baseUrl: formData.baseUrl.trim(),
      apiKey: formData.apiKey,
      reasoningEffort: formData.reasoningEffort,
    };

    onUpdateProvider(updatedProvider);
    setEditingId(null);
    setFormData(INITIAL_FORM_DATA);
  };

  const handleDelete = (id: string) => {
    onDeleteProvider(id);
    if (editingId === id) {
      setEditingId(null);
      setFormData(INITIAL_FORM_DATA);
    }
  };

  const renderForm = (isEdit: boolean) => (
    <div
      className="p-3 rounded-xl border space-y-3"
      style={{
        backgroundColor: 'var(--vscode-input-background)',
        borderColor: 'var(--vscode-input-border)',
      }}
    >
      <div className="space-y-1.5">
        <label
          className="block text-xs font-medium"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Provider Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="My Custom Provider"
          className="w-full px-3 py-2 text-sm rounded-lg border"
          style={{
            backgroundColor: 'var(--vscode-editor-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)',
          }}
        />
      </div>

      <div className="space-y-1.5">
        <label
          className="block text-xs font-medium"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Base URL
        </label>
        <input
          type="text"
          value={formData.baseUrl}
          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
          placeholder="http://localhost:1234"
          className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-1"
          style={{
            backgroundColor: 'var(--vscode-editor-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: formData.baseUrl && !isValidUrl(formData.baseUrl)
              ? 'var(--vscode-errorForeground)'
              : 'var(--vscode-input-border)',
            boxShadow: formData.baseUrl && !isValidUrl(formData.baseUrl)
              ? '0 0 0 1px var(--vscode-errorForeground)'
              : 'none',
          }}
        />
        {formData.baseUrl && !isValidUrl(formData.baseUrl) && (
          <p className="text-xs" style={{ color: 'var(--vscode-errorForeground)' }}>
            Please enter a valid URL (e.g., http://localhost:1234)
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          className="block text-xs font-medium"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          API Key (Optional)
        </label>
        <ApiKeyInput
          value={formData.apiKey}
          onChange={(value) => setFormData({ ...formData, apiKey: value })}
        />
      </div>

      <ReasoningEffortDropdown
        value={formData.reasoningEffort}
        onChange={(value) => setFormData({ ...formData, reasoningEffort: value })}
      />

      <div className="flex items-center justify-end gap-2 pt-4 border-t" style={{ borderColor: 'var(--vscode-widget-border)' }}>
        <button
          type="button"
          onClick={handleCancel}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          style={{
            color: 'var(--vscode-textLink-foreground)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={isEdit ? handleSaveEdit : handleSaveNew}
          disabled={!formData.name.trim() || !isValidUrl(formData.baseUrl)}
          className="flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all shadow-sm"
          style={{
            backgroundColor: !formData.name.trim() || !isValidUrl(formData.baseUrl)
              ? 'var(--vscode-button-secondaryBackground)'
              : 'var(--vscode-button-background)',
            color: !formData.name.trim() || !isValidUrl(formData.baseUrl)
              ? 'var(--vscode-button-secondaryForeground)'
              : 'var(--vscode-button-foreground)',
            cursor: !formData.name.trim() || !isValidUrl(formData.baseUrl) ? 'not-allowed' : 'pointer',
            opacity: !formData.name.trim() || !isValidUrl(formData.baseUrl) ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (formData.name.trim() && isValidUrl(formData.baseUrl)) {
              e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
            }
          }}
          onMouseLeave={(e) => {
            if (formData.name.trim() && isValidUrl(formData.baseUrl)) {
              e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
            }
          }}
        >
          <Check size={14} />
          {isEdit ? 'Update Provider' : 'Save Provider'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3
          className="text-xs font-semibold"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Custom Providers
        </h3>
        {!isAdding && !editingId && (
          <button
            type="button"
            onClick={handleStartAdd}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border transition-colors hover:opacity-80"
            style={{
              backgroundColor: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              borderColor: 'transparent',
            }}
          >
            <Plus size={12} />
            Add
          </button>
        )}
      </div>

      {isAdding && renderForm(false)}

      {customProviders.length > 0 && (
        <div className="space-y-2">
          {customProviders.map((provider) => (
            <div key={provider.id}>
              {editingId === provider.id ? (
                renderForm(true)
              ) : (
                <div
                  className="flex items-center justify-between p-3 rounded-xl border"
                  style={{
                    backgroundColor: 'var(--vscode-input-background)',
                    borderColor: 'var(--vscode-input-border)',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--vscode-foreground)' }}
                    >
                      {provider.name}
                    </div>
                    <div
                      className="text-xs truncate"
                      style={{ color: 'var(--vscode-descriptionForeground)' }}
                    >
                      {provider.baseUrl}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(provider)}
                      className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: 'transparent',
                        color: 'var(--vscode-foreground)',
                      }}
                      title="Edit provider"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(provider.id)}
                      className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: 'transparent',
                        color: 'var(--vscode-errorForeground)',
                      }}
                      title="Delete provider"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {customProviders.length === 0 && !isAdding && (
        <div
          className="text-xs text-center py-4"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          No custom providers configured. Add one to use your own OpenAI-compatible API.
        </div>
      )}
    </div>
  );
}