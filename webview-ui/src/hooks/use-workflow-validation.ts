import { useState, useEffect } from 'react';
import { vscode } from '../utils/vscode';

interface Workflow {
    name: string;
    source: 'workspace' | 'global';
}

interface WorkflowsListMessage {
    type: 'workflowsList';
    workflows: Workflow[];
}

/**
 * Hook to fetch and maintain the list of valid workflow command names.
 * Used to validate slash commands (e.g., /[workflow-name]) before highlighting.
 */
export function useWorkflowValidation() {
    const [validWorkflowNames, setValidWorkflowNames] = useState<string[]>([]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'workflowsList') {
                const data = message as WorkflowsListMessage;
                const names = (data.workflows || []).map((w) => w.name);
                setValidWorkflowNames(names);
            }
        };

        window.addEventListener('message', handleMessage);

        // Request workflows on mount
        vscode.postMessage({ type: 'getWorkflows' });

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    return { validWorkflowNames };
}