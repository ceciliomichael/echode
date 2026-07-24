export {};

interface VsCodeApi {
  postMessage(message: Record<string, unknown>): void;
  getState(): unknown;
  setState(state: unknown): void;
}

interface MarkdownBootstrapState {
  content: string;
  documentUri: string;
  documentBaseUri: string | null;
  title: string;
  docType: string;
}

declare global {
  interface Window {
    vscode: VsCodeApi;
    __ECHODE_MARKDOWN__: MarkdownBootstrapState;
  }
}
