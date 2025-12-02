import { useState, useEffect, useCallback } from 'react';
import type { ChatMode } from '../types/chat-mode';
import { CHAT_MODE_OPTIONS } from '../types/chat-mode';
import { storageService } from '../utils/storage';

interface ChatModeState {
  mode: ChatMode;
  handleModeChange: (newMode: ChatMode) => void;
}

export function useChatMode(): ChatModeState {
  const [mode, setMode] = useState<ChatMode>(() => storageService.getChatMode());

  const handleModeChange = useCallback((newMode: ChatMode) => {
    setMode(newMode);
    storageService.setChatMode(newMode);
  }, []);

  // Ctrl+. hotkey to cycle through modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault();
        setMode((currentMode) => {
          const currentIndex = CHAT_MODE_OPTIONS.findIndex(opt => opt.value === currentMode);
          const nextIndex = (currentIndex + 1) % CHAT_MODE_OPTIONS.length;
          const nextMode = CHAT_MODE_OPTIONS[nextIndex].value;
          storageService.setChatMode(nextMode);
          return nextMode;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    mode,
    handleModeChange,
  };
}
