import { useState, useEffect } from 'react';

export function useModelFetcher(baseUrl: string, apiKey: string) {
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    // Clear models immediately when endpoint changes
    setModels([]);
    
    const fetchModels = async () => {
      if (!baseUrl || !apiKey) {
        setLoadingModels(false);
        return;
      }
      
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

  return { models, loadingModels };
}
