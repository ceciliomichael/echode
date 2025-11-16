import * as vscode from 'vscode';

interface ApiRequestData {
  requestId: number;
  url: string;
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
}

/**
 * Handle API requests from webview through VSCode backend to avoid CORS
 */
export async function handleApiRequest(
  data: unknown,
  webview: vscode.WebviewView | vscode.WebviewPanel
): Promise<void> {
  const { requestId, url, options } = data as ApiRequestData;
  
  try {
    const urlObj = new URL(url);

    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? await import('https') : await import('http');

    const requestOptions: {
      hostname: string;
      port: number;
      path: string;
      method: string;
      headers: Record<string, string>;
    } = {
      hostname: urlObj.hostname,
      port: urlObj.port ? Number(urlObj.port) : (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = httpModule.request(requestOptions, (res: any) => {
      let responseData = '';
      
      res.on('data', (chunk: Buffer) => {
        const textChunk = chunk.toString();
        responseData += textChunk;
        webview.webview.postMessage({
          type: 'apiStreamChunk',
          requestId,
          chunk: textChunk
        });
      });

      res.on('end', () => {
        webview.webview.postMessage({
          type: 'apiResponse',
          requestId,
          status: res.statusCode,
          statusText: res.statusMessage,
          data: responseData
        });
      });
    });

    req.on('error', (error: Error) => {
      webview.webview.postMessage({
        type: 'apiError',
        requestId,
        error: error.message
      });
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  } catch (error) {
    webview.webview.postMessage({
      type: 'apiError',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
