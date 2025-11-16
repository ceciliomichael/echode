import { useState, useEffect } from 'react';
import { SetupPage } from './components/feature/setup-page';
import { ChatContainer } from './components/feature/chat-container';
import { storageService } from './utils/storage';
import type { ApiSettings } from './types/api-settings';

declare global {
  interface Window {
    isSettingsPanel?: boolean;
  }
}

function App() {
  const [settings, setSettings] = useState<ApiSettings>(storageService.getSettings());
  const [showSetup, setShowSetup] = useState(() => {
    return window.isSettingsPanel || !storageService.hasSettings();
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'settingsSaved') {
        storageService.saveSettings(message.settings);
        setSettings(message.settings);
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