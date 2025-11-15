interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

interface VsCodeTheme {
  kind: number;
}

interface Window {
  vscode: VsCodeApi;
  vsCodeTheme?: VsCodeTheme;
}

declare function acquireVsCodeApi(): VsCodeApi;