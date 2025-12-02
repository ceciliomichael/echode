import { useEffect, useRef } from 'react';
import type { ChatMode } from '../types/chat-mode';

interface PlanEventsConfig {
  mode: ChatMode;
  handleModeChange: (mode: ChatMode) => void;
  handleSendHiddenMessage: (content: string) => Promise<void>;
  updateToolResultData: (
    toolName: string,
    updater: (data: unknown) => unknown
  ) => void;
}

export function usePlanEvents(config: PlanEventsConfig): void {
  const { mode, handleModeChange, handleSendHiddenMessage, updateToolResultData } = config;
  const autoStartImplementationRef = useRef(false);

  // Listen for plan navigator quick questions
  useEffect(() => {
    const handleQuickQuestion = (event: Event) => {
      const custom = event as CustomEvent<{ question: string; selectedIndex: number }>;
      const question = custom.detail?.question;
      const selectedIndex = custom.detail?.selectedIndex;
      if (!question) return;
      
      if (selectedIndex !== undefined) {
        updateToolResultData('plan_navigator', (data) => ({
          ...(typeof data === 'object' && data !== null ? data : {}),
          selectedIndex,
        }));
      }
      
      void handleSendHiddenMessage(question);
    };

    window.addEventListener('echode:quickQuestion', handleQuickQuestion as EventListener);
    return () => window.removeEventListener('echode:quickQuestion', handleQuickQuestion as EventListener);
  }, [handleSendHiddenMessage, updateToolResultData]);

  // Listen for plan implementation handoff
  useEffect(() => {
    const handleImplementHandoff = (event: Event) => {
      const customEvent = event as CustomEvent<{ markAsClicked?: boolean }>;
      const shouldMarkClicked = customEvent.detail?.markAsClicked;
      
      if (shouldMarkClicked) {
        updateToolResultData('plan_handoff', (data) => ({
          ...(typeof data === 'object' && data !== null ? data : {}),
          clicked: true,
        }));
      }
      
      handleModeChange('agent');
      autoStartImplementationRef.current = true;
    };

    window.addEventListener('echode:planImplementHandoff', handleImplementHandoff as EventListener);
    return () => window.removeEventListener('echode:planImplementHandoff', handleImplementHandoff as EventListener);
  }, [handleModeChange, updateToolResultData]);

  // Auto-start implementation after mode switches to Agent
  useEffect(() => {
    if (mode !== 'agent' || !autoStartImplementationRef.current) {
      return;
    }

    autoStartImplementationRef.current = false;

    setTimeout(() => {
      void handleSendHiddenMessage('Yes, proceed with the implementation as planned.');
    }, 0);
  }, [mode, handleSendHiddenMessage]);
}
