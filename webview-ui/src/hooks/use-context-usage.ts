import { useState, useEffect, useRef } from 'react';
import type { Message } from '../types/chat';
import type { ChatMode } from '../types/chat-mode';
import type { ContextSettings } from '../types/api-settings';
import { DEFAULT_CONTEXT_SETTINGS } from '../types/api-settings';
import { formatToolResultForAI } from '../utils/tool-execution-helpers';
import { stripUnavailableToolCalls, isToolAvailableInMode } from '../utils/tool-history-filter';
import { removeThinkBlocks } from '../utils/think-block-parser';

/**
 * Estimate token count from text using ~4 characters per token
 * This is a conservative estimate that works well for English/code
 */
function estimateTokens(text: string): number {
  if (!text) {return 0;}
  // ~4 characters per token is a reasonable estimate
  return Math.ceil(text.length / 4);
}

export interface ContextUsageResult {
  systemPromptTokens: number;
  historyTokens: number;
  compressedHistoryTokens: number;
  toolResultsTokens: number;
  totalTokens: number;
  maxTokens: number;
  isCalculating?: boolean;
}

interface UseContextUsageOptions {
  systemPrompt: string;
  messages: Message[];
  mode?: ChatMode;
  currentToolResultText?: string;
  contextSettings?: ContextSettings;
  revertPreviewMessageId?: string | null;
}

function calculateContextUsage({
  systemPrompt,
  messages,
  mode = 'agent',
  currentToolResultText = '',
  contextSettings = DEFAULT_CONTEXT_SETTINGS,
  revertPreviewMessageId = null,
}: UseContextUsageOptions): ContextUsageResult {
  // Calculate effective messages based on revert preview state
  let effectiveMessages = messages;

  if (revertPreviewMessageId) {
    const revertIndex = messages.findIndex(msg => msg.id === revertPreviewMessageId);
    if (revertIndex !== -1) {
      // Slice to get messages that will remain after revert
      effectiveMessages = messages.slice(0, revertIndex);
    }
  }

  // Calculate system prompt tokens
  const systemPromptTokens = estimateTokens(systemPrompt);

  // Calculate history tokens (messages without their tool executions)
  let historyTokens = 0;
  let compressedHistoryTokens = 0;
  let toolResultsTokens = 0;

  effectiveMessages.forEach((message) => {
    // Check for compressed history
    if (message.content.includes('<compressed_history>')) {
      const contentTokens = estimateTokens(message.content);
      compressedHistoryTokens += contentTokens;
    } else {
      // Apply filtering to content to match what is sent to LLM
      // Remove think blocks first, then strip unavailable tool calls (mirrors chat-history-builder.ts)
      const contentWithoutThink = removeThinkBlocks(message.content);
      const filteredContent = stripUnavailableToolCalls(contentWithoutThink, mode);
      historyTokens += estimateTokens(filteredContent);
    }

    // Calculate tool results separately
    if (message.toolExecutions && message.toolExecutions.size > 0) {
      message.toolExecutions.forEach((execution) => {
        // Skip tools that are not available in current mode
        if (!isToolAvailableInMode(execution.toolName, mode)) {
          return;
        }

        toolResultsTokens += estimateTokens(execution.toolName);
        toolResultsTokens += estimateTokens(JSON.stringify(execution.parameters || {}));

        if (execution.result) {
          // Use the same formatter as the actual AI prompt to get accurate token counts
          // This prevents massive over-estimation for file tools (apply_diff, write_to_file)
          // which return full file content in the result object but truncate it for the AI
          const formattedResult = formatToolResultForAI(execution.toolName, execution.result);
          toolResultsTokens += estimateTokens(formattedResult);
        }
      });
    }
  });

  // Add current tool result text if any
  if (currentToolResultText) {
    toolResultsTokens += estimateTokens(currentToolResultText);
  }

  const totalTokens = systemPromptTokens + historyTokens + toolResultsTokens;
  const maxTokens = contextSettings.maxContextTokens;

  return {
    systemPromptTokens,
    historyTokens,
    compressedHistoryTokens,
    toolResultsTokens,
    totalTokens,
    maxTokens,
  };
}

/**
 * Hook to calculate current context usage in tokens
 * Throttled to prevent UI blocking during high-frequency updates (streaming)
 */
export function useContextUsage(options: UseContextUsageOptions): ContextUsageResult {
  const [result, setResult] = useState<ContextUsageResult>(() => calculateContextUsage(options));
  const lastRun = useRef<number>(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  // Track the latest options with a ref to avoid stale closures in setTimeout
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const THROTTLE_MS = 1000;
    const now = Date.now();
    const timeSinceLastRun = now - lastRun.current;

    const execute = () => {
      if (!mounted.current) return;
      // Use the LATEST options from the ref
      setResult(calculateContextUsage(optionsRef.current));
      lastRun.current = Date.now();
      timeoutRef.current = null;
    };

    if (timeSinceLastRun >= THROTTLE_MS) {
      // If enough time passed, execute immediately
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      execute();
    } else {
      // Otherwise schedule it
      // Clear existing timeout to reschedule with potentially newer closure/time (or just let it run)
      // Actually, if we have a pending timeout, we DON'T need to reschedule if we rely on optionsRef.
      // But we should ensure the timeout triggers eventually.
      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(execute, THROTTLE_MS - timeSinceLastRun);
      }
    }

    return () => {
      // Don't clear timeout on deps change, we want the scheduled update to happen
      // only on unmount (handled by mounted ref check mostly)
      // But standard practice is cleanup. If we cleanup, we lose the pending update if deps changed fast.
      // So we rely on the fact that the effect runs again.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [
    // We list individual fields to trigger the effect
    options.systemPrompt,
    options.messages,
    options.mode,
    options.currentToolResultText,
    options.contextSettings,
    options.revertPreviewMessageId
  ]);

  return result;
}