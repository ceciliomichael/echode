import { useState, useEffect } from 'react';
import { SetupPage } from './components/feature/setup-page';
import { ChatContainer } from './components/feature/chat-container';
import { PlanViewer } from './components/feature/plan-viewer';
import { storageService, initializeSettings } from './utils/storage';
import { prefetchAllModels } from './hooks/use-model-fetcher';
import { useMcpToolSync } from './hooks/use-mcp-tool-sync';
import type { ApiSettings } from './types/api-settings';
import { DEFAULT_API_SETTINGS } from './types/api-settings';

declare global {
  interface Window {
    isSettingsPanel?: boolean;
    isPlanViewer?: boolean;
    planContent?: string;
  }
}

function App() {
  const [settings, setSettings] = useState<ApiSettings>(DEFAULT_API_SETTINGS);
  const [showSetup, setShowSetup] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Enable MCP tool synchronization
  useMcpToolSync();

  // Initialize settings from backend on mount
  useEffect(() => {
    initializeSettings().then((loadedSettings) => {
      setSettings(loadedSettings);
      setShowSetup(window.isSettingsPanel || !storageService.hasSettings());
      setIsLoading(false);
      // Prefetch models once settings are loaded to populate cache
      prefetchAllModels(loadedSettings);
    });
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'settingsSaved') {
        const current = storageService.getSettings();
        const incoming = message.settings as ApiSettings;

        // Preserve active provider and model selection from the chat sidebar.
        // Settings panel is for API configuration only and should not change models.
        // IMPORTANT: Also preserve modeModelSettings which stores per-mode model selections.
        const merged: ApiSettings = {
          ...incoming,
          provider: current.provider,
          model: current.model,
          anthropicModel: current.anthropicModel,
          openaiModel: current.openaiModel,
          openaiCompatibleModel: current.openaiCompatibleModel,
          megallmModel: current.megallmModel,
          vscodeLmModel: current.vscodeLmModel,
          qwenCodeModel: current.qwenCodeModel,
          modeModelSettings: current.modeModelSettings,
        };

        storageService.saveSettings(merged);
        setSettings(merged);
        setShowSetup(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSaveSettings = (newSettings: ApiSettings) => {
    storageService.saveSettings(newSettings);
    setSettings(newSettings);
    
    if (window.isSettingsPanel && window.vscode) {
      window.vscode.postMessage({
        type: 'saveSettings',
        settings: newSettings
      });
    } else {
      setShowSetup(false);
    }
  };

  const handleCloseSettings = () => {
    if (window.isSettingsPanel && window.vscode) {
      window.vscode.postMessage({ type: 'closeSettings' });
    } else if (storageService.hasSettings()) {
      setShowSetup(false);
    }
  };

  // Plan Viewer mode - render plan content directly
  if (window.isPlanViewer) {
    return <PlanViewer />;
  }

  // Show nothing while loading settings from backend
  if (isLoading) {
    return <div className="h-screen" />;
  }

  if (window.isSettingsPanel || showSetup) {
    return (
      <div className="h-screen">
        <SetupPage
          initialSettings={settings}
          onSave={handleSaveSettings}
          onClose={window.isSettingsPanel ? handleCloseSettings : undefined}
        />
      </div>
    );
  }

  return (
    <div className="h-screen">
      <ChatContainer />
    </div>
  );
}

export default App;