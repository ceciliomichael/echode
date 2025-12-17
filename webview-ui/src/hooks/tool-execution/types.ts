/**
 * Shared types for tool execution modules
 */
import type { Message, ImageAttachment } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import type { ChatMode } from '../../types/chat-mode';
import type { ToolExecutionState } from '../../types/tool';
import type { WorkspaceContext } from '../../types/workspace';

/**
 * Todo item structure
 */
export interface TodoItem {
  id: string;
  content: string;
  status: string;
}

/**
 * Props for the main tool execution hook
 */
export interface ToolExecutionHookProps {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  isStreamingRef: React.MutableRefObject<boolean>;
  isStoppingRef: React.MutableRefObject<boolean>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  sendingMessageRef: React.MutableRefObject<boolean>;
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void;
  messagesRef: React.MutableRefObject<Message[]>;
  currentTodos?: TodoItem[];
  saveSession: () => void;
  mode: ChatMode;
}

/**
 * Context for tool execution operations - passed to executor functions
 */
export interface ToolExecutionContext {
  workspace: WorkspaceContext | null;
  isStoppingRef: React.MutableRefObject<boolean>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  isStreamingRef: React.MutableRefObject<boolean>;
  sendingMessageRef: React.MutableRefObject<boolean>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void;
  messagesRef: React.MutableRefObject<Message[]>;
  currentTodos: TodoItem[];
  saveSession: () => void;
  mode: ChatMode;
}

/**
 * Parameters for continuation stream
 */
export interface ContinuationStreamParams {
  assistantContent: string;
  assistantMessageId: string;
  continuationHistory: ChatMessage[];
  messagesToSend: Message[];
  userContent: string;
  toolIndex: number;
  userAttachments?: ImageAttachment[];
}

/**
 * Tool block structure from parser
 * Matches ParsedToolBlock from lib/tool-parser
 */
export interface ToolBlock {
  type: 'tool';
  toolName: string;
  parameters: Record<string, unknown>;
  rawContent: string;
}

/**
 * Result from tool execution
 */
export interface ExecutionResult {
  toolResultText: string;
  wasStopped: boolean;
  isPlanningTool?: boolean;
  nextToolIndex: number;
}

/**
 * Executed tool with result and state
 */
export interface ExecutedToolWithState {
  toolName: string;
  result?: { success: boolean; data?: unknown };
  state: ToolExecutionState;
}

/**
 * Function signature for executeToolAndContinue callback
 */
export type ExecuteToolAndContinueFn = (
  assistantContent: string,
  assistantMessageId: string,
  previousHistory: ChatMessage[],
  messagesToSend: Message[],
  userContent: string,
  toolIndex?: number,
  userAttachments?: ImageAttachment[],
  bufferedToolResults?: string[]
) => Promise<void>;

/**
 * UI update function type
 */
export type UpdateUIFn = () => void;