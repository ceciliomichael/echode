import { ITool, ToolExecutionResult, ToolProgressCallback, ChatMode } from './tool.interface';
import { TerminalManager } from '../terminal/terminal-manager';

const DEFAULT_TIMEOUT_SECONDS = 5 * 60; // 5 minutes max

export class RunTerminalTool implements ITool {
    name = 'run_terminal';

    async execute(
        parameters: Record<string, unknown>,
        onProgress?: ToolProgressCallback,
        _signal?: AbortSignal,
        _mode?: ChatMode
    ): Promise<ToolExecutionResult> {
        try {
            const command = parameters.command as string;
            const id = (parameters.id as string) || 'default';
            const timeout = Number(parameters.timeout) || DEFAULT_TIMEOUT_SECONDS;
            const manager = TerminalManager.getInstance();

            if (!command) {
                return {
                    success: false,
                    error: 'Parameter "command" is required'
                };
            }

            // Command prompt prefix for display
            const commandPrefix = `$ ${command}\n`;
            
            // Show the command being executed
            if (onProgress) {
                onProgress(commandPrefix);
            }

            // Execute command (spawns process directly)
            manager.executeCommand(id, command);

            // Wait for output with streaming until process exits or timeout
            const result = await manager.waitForOutput(id, timeout, (data) => {
                if (onProgress) {
                    onProgress(data);
                }
            });

            // Handle timeout case
            if (result.timedOut) {
                manager.killSession(id);
                const timeoutMsg = `\n[Process killed after ${timeout}s timeout]`;
                if (onProgress) {
                    onProgress(timeoutMsg + '\n');
                }
                return {
                    success: true,
                    data: commandPrefix + result.output + timeoutMsg
                };
            }

            // Process finished normally - include command prefix in result
            return {
                success: result.exitCode === 0 || result.exitCode === null,
                data: commandPrefix + (result.output || '(No output)')
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error executing terminal command'
            };
        }
    }
}