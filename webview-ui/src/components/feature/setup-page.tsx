import { useState, useEffect } from 'react';
import { Settings, FileText } from 'lucide-react';
import { ModelDropdown } from '../ui/model-dropdown';
import type { ApiSettings } from '../../types/api-settings';

interface SetupPageProps {
  initialSettings: ApiSettings;
  onSave: (settings: ApiSettings) => void;
  onClose?: () => void;
}

export function SetupPage({ initialSettings, onSave }: SetupPageProps) {
  const [baseUrl, setBaseUrl] = useState(initialSettings.baseUrl);
  const [model, setModel] = useState(initialSettings.model);
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [systemPrompt, setSystemPrompt] = useState(initialSettings.systemPrompt || '');
  const [activeTab, setActiveTab] = useState<'api' | 'system'>('api');
  const [models, setModels] = useState<string[]>([]);
  const [_loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    setBaseUrl(initialSettings.baseUrl);
    setModel(initialSettings.model);
    setApiKey(initialSettings.apiKey);
    setSystemPrompt(initialSettings.systemPrompt || '');
  }, [initialSettings]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSave({ baseUrl, model, apiKey, systemPrompt });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [baseUrl, model, apiKey, systemPrompt, onSave]);

  useEffect(() => {
    const fetchModels = async () => {
      if (!baseUrl || !apiKey) return;
      
      setLoadingModels(true);
      
      const modelsUrl = baseUrl.replace(/\/chat\/completions\s*$/, '').replace(/\/$/, '') + '/models';
      
      const requestId = Date.now();
      const handleResponse = (event: MessageEvent) => {
        const message = event.data;
        if (message.requestId === requestId) {
          if (message.type === 'apiResponse') {
            try {
              const data = JSON.parse(message.data);
              if (data.data && Array.isArray(data.data)) {
                setModels(data.data.map((m: { id: string }) => m.id));
              } else {
                setModels([]);
              }
            } catch (_error) {
              setModels([]);
            }
            setLoadingModels(false);
          } else if (message.type === 'apiError') {
            setModels([]);
            setLoadingModels(false);
          }
        }
      };

      window.addEventListener('message', handleResponse);
      
      window.vscode.postMessage({
        type: 'apiRequest',
        requestId,
        url: modelsUrl,
        options: {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      });

      return () => {
        window.removeEventListener('message', handleResponse);
      };
    };

    const timeoutId = setTimeout(fetchModels, 500);
    return () => clearTimeout(timeoutId);
  }, [baseUrl, apiKey]);


  return (
    <div
      className="flex flex-col sm:flex-row h-screen"
      style={{ backgroundColor: 'var(--vscode-editor-background)' }}
    >
      <div
        className="w-full sm:w-56 lg:w-64 border-b sm:border-b-0 sm:border-r shrink-0"
        style={{
          borderColor: 'var(--vscode-panel-border)',
          backgroundColor: 'var(--vscode-sideBar-background)'
        }}
      >
        <div className="p-3 sm:p-4">
          <div
            className="flex items-center gap-2 mb-4"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            <Settings size={16} strokeWidth={1.5} />
            <h2 className="text-sm font-semibold">
              Settings
            </h2>
          </div>
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('api')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-lg transition-all border"
              style={{
                backgroundColor: activeTab === 'api' ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
                color: activeTab === 'api' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
                borderColor: activeTab === 'api' ? 'var(--vscode-focusBorder)' : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'api') {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'api') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Settings size={14} strokeWidth={1.5} />
              <span className="font-medium">API Configuration</span>
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-lg transition-all border"
              style={{
                backgroundColor: activeTab === 'system' ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
                color: activeTab === 'system' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
                borderColor: activeTab === 'system' ? 'var(--vscode-focusBorder)' : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'system') {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'system') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <FileText size={14} strokeWidth={1.5} />
              <span className="font-medium">System Prompt</span>
            </button>
          </nav>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="flex items-center px-4 sm:px-5 h-12 sm:h-14 border-b shrink-0"
          style={{
            borderColor: 'var(--vscode-panel-border)',
            backgroundColor: 'var(--vscode-editor-background)'
          }}
        >
          <h1
            className="text-sm sm:text-base font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            {activeTab === 'api' ? 'API Configuration' : 'System Prompt'}
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto py-4 sm:py-6 px-4 sm:px-5">
          {activeTab === 'api' && (
            <div className="max-w-2xl space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="baseUrl"
                  className="block text-xs font-semibold"
                  style={{ color: 'var(--vscode-foreground)' }}
                >
                  Base URL
                </label>
                <input
                  id="baseUrl"
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
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
                  htmlFor="apiKey"
                  className="block text-xs font-semibold"
                  style={{ color: 'var(--vscode-foreground)' }}
                >
                  API Key
                </label>
                <input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-... or your API key"
                  className="w-full px-3 py-2 text-sm rounded-xl border font-mono transition-colors"
                  style={{
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    borderColor: 'var(--vscode-input-border)'
                  }}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="model"
                  className="block text-xs font-semibold"
                  style={{ color: 'var(--vscode-foreground)' }}
                >
                  Model Name
                </label>
                <ModelDropdown
                  value={model}
                  onChange={setModel}
                  models={models.length > 0 ? models : [model].filter(Boolean)}
                  disabled={false}
                />
              </div>

            </div>
          )}

          {activeTab === 'system' && (
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
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
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
          )}
        </div>
      </div>
    </div>
  );
}