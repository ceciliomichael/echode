import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatMode } from '../types/chat-mode';
import { CHAT_MODE_OPTIONS } from '../types/chat-mode';
import { storageService } from '../utils/storage';

interface ChatModeState {
  mode: ChatMode;
  handleModeChange: (newMode: ChatMode) => void;
  setHotkeyDisabled: (disabled: boolean) => void;
}

/**
 * Hook to manage unified chat mode
 * Uses a single global mode stored in settings
 */
export function useChatMode(): ChatModeState {
  const [mode, setMode] = useState<ChatMode>(() => storageService.getChatMode());
  const isDisabledRef = useRef(false);

  const handleModeChange = useCallback((newMode: ChatMode) => {
    setMode(newMode);
    storageService.setChatMode(newMode);
  }, []);

  // Callback to update the disabled state from external components
  const setHotkeyDisabled = useCallback((disabled: boolean) => {
    isDisabledRef.current = disabled;
  }, []);

  // Ctrl+. hotkey to cycle through modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip mode switching when AI is actively streaming or executing tools
      if (isDisabledRef.current) {return;}

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
    setHotkeyDisabled,
  };
}