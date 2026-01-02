import { ITool, ToolExecutionResult, ToolProgressCallback, ChatMode, ToolConfirmation } from './tool.interface';
import { TerminalManager } from '../terminal/terminal-manager';
import { CommandValidator } from './utils/command-validator';
import { SettingsManager } from '../settings/settings-manager';

const DEFAULT_TIMEOUT_SECONDS = 5 * 60; // 5 minutes max

export class RunTerminalTool implements ITool {
    name = 'run_terminal';

    /**
     * Prepare execution for Manual Mode approval.
     * Returns confirmation data with command preview.
     */
    async prepareExecution(
        parameters: Record<string, unknown>
    ): Promise<ToolConfirmation | undefined> {
        const command = parameters.command as string;
        const timeout = Number(parameters.timeout) || DEFAULT_TIMEOUT_SECONDS;

        if (!command) {
            return undefined;
        }

        return {
            toolName: this.name,
            title: 'Run Terminal Command',
            message: `This will execute the following command in your terminal (timeout: ${timeout}s):`,
            command,
            parameters,
        };
    }

    async execute(
        parameters: Record<string, unknown>,
        onProgress?: ToolProgressCallback,
        signal?: AbortSignal,
        _mode?: ChatMode
    ): Promise<ToolExecutionResult> {
        let abortHandler: (() => void) | undefined;

        try {
            const command = parameters.command as string;
            const id = (parameters.id as string) || 'default';
            const timeout = Number(parameters.timeout) || DEFAULT_TIMEOUT_SECONDS;
            const manager = TerminalManager.getInstance();

            // Check if already aborted before starting
            if (signal?.aborted) {
                return {
                    success: false,
                    error: 'Execution aborted'
                };
            }

            if (!command) {
                return {
                    success: false,
                    error: 'Parameter "command" is required'
                };
            }

            // Check if full terminal access is enabled in settings
            const settingsManager = new SettingsManager();
            const settings = settingsManager.getSettings();
            const bypassValidation = settings.miscellaneousSettings?.enableFullTerminalAccess ?? false;

            // Validate command against forbidden patterns (unless bypassed)
            CommandValidator.validate(command, bypassValidation);

            // Command prompt prefix for display
            const commandPrefix = `$ ${command}\n`;

            // Show the command being executed
            if (onProgress) {
                onProgress(commandPrefix);
            }

            // Execute command (spawns process directly)
            manager.executeCommand(id, command);

            // Setup abort handler to kill the process if user cancels
            if (signal) {
                abortHandler = () => {
                    manager.killSession(id);
                    if (onProgress) {
                        onProgress('\n[Aborted by user]\n');
                    }
                };
                signal.addEventListener('abort', abortHandler);
            }

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
                    data: {
                        command,
                        output: result.output + timeoutMsg,
                        exitCode: null
                    }
                };
            }

            // Process finished normally
            const isSuccess = result.exitCode === 0 || result.exitCode === null;
            const output = result.output || '(No output)';

            return {
                success: isSuccess,
                data: {
                    command,
                    output,
                    exitCode: result.exitCode
                },
                // Include output in error field when command fails so AI can see what went wrong
                ...(isSuccess ? {} : { error: `Command failed with exit code ${result.exitCode}:\n${output}` })
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error executing terminal command'
            };
        } finally {
            // Clean up abort listener to prevent memory leaks
            if (signal && abortHandler) {
                signal.removeEventListener('abort', abortHandler);
            }
        }
    }
}