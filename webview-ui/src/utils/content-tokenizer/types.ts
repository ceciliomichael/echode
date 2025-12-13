/**
 * Content tokenization for stable rendering during streaming
 */

export type ContentToken =
    | { type: 'think'; content: string; index: number; isClosed: boolean }
    | { type: 'tool'; toolName: string; parameters: Record<string, unknown>; rawContent: string; index: number; isClosed: boolean; toolExecutionId: string }
    | { type: 'mermaid'; content: string; index: number; isClosed: boolean }
    | { type: 'text'; content: string; index: number };
