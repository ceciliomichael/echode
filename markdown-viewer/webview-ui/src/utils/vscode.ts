export const vscode = {
    postMessage: (message: Record<string, unknown>) => {
        if (typeof window !== 'undefined' && window.vscode) {
            window.vscode.postMessage(message);
        }
    },
    getState: () => {
        if (typeof window !== 'undefined' && window.vscode) {
            return window.vscode.getState();
        }
        return undefined;
    },
    setState: (state: unknown) => {
        if (typeof window !== 'undefined' && window.vscode) {
            window.vscode.setState(state);
        }
    }
};
