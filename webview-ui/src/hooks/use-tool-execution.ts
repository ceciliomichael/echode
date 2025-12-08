/**
 * Tool Execution Hook
 * 
 * Re-exports from the refactored tool-execution module.
 * This file is kept for backward compatibility with existing imports.
 * 
 * @see ./tool-execution/index.ts for the implementation
 */
export { useToolExecution } from './tool-execution';
export type { ToolExecutionHookProps, ToolExecutionContext, TodoItem } from './tool-execution';