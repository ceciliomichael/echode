import { PlanViewer } from './components/feature/plan-viewer';

declare global {
  interface Window {
    vscode?: {
      postMessage: (message: Record<string, unknown>) => void;
      getState: () => unknown;
      setState: (state: unknown) => void;
    };
    isPlanViewer?: boolean;
    planContent?: string;
  }
}

function App() {
  return <PlanViewer />;
}

export default App;
