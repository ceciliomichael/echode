import * as cp from 'child_process';
import * as os from 'os';
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { PathResolver } from '../path-resolver';

interface CommandSession {
    id: string;
    process: cp.ChildProcess;
    outputBuffer: string;
    command: string;
    startedAt: number;
    exitCode: number | null;
    finished: boolean;
}

export class TerminalManager extends EventEmitter {
    private static instance: TerminalManager;
    private sessions: Map<string, CommandSession> = new Map();
    private readonly defaultShell: string;
    private readonly shellArgs: string[];
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        super();
        if (os.platform() === 'win32') {
            this.defaultShell = 'cmd.exe';
            this.shellArgs = ['/c'];
        } else {
            this.defaultShell = '/bin/bash';
            this.shellArgs = ['-c'];
        }
        this.outputChannel = vscode.window.createOutputChannel('EchoDE Terminal');
    }

    public static getInstance(): TerminalManager {
        if (!TerminalManager.instance) {
            TerminalManager.instance = new TerminalManager();
        }
        return TerminalManager.instance;
    }

    /**
     * Show the output channel
     */
    public showOutput(): void {
        this.outputChannel.show(true);
    }

    /**
     * Execute a command directly (not in a persistent shell)
     * The process exits when the command finishes.
     */
    public executeCommand(id: string, command: string, cwd?: string): CommandSession {
        // Kill any existing session with same ID
        this.killSession(id);

        // Determine correct CWD using PathResolver
        let workingDir: string;
        try {
            const resolved = PathResolver.resolve(cwd || '.');
            workingDir = resolved.absolutePath;
        } catch {
            workingDir = cwd || process.cwd();
        }

        // Spawn the command directly through shell
        const processInstance = cp.spawn(this.defaultShell, [...this.shellArgs, command], {
            cwd: workingDir,
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                // Force Python to use unbuffered stdout/stderr for real-time streaming
                PYTHONUNBUFFERED: '1'
            }
        });

        const session: CommandSession = {
            id,
            process: processInstance,
            outputBuffer: '',
            command,
            startedAt: Date.now(),
            exitCode: null,
            finished: false
        };

        this.outputChannel.appendLine(`[${id}] $ ${command}`);
        this.outputChannel.appendLine(`[${id}] Running in: ${workingDir}`);

        // Handle stdout
        if (processInstance.stdout) {
            processInstance.stdout.on('data', (data: Buffer) => {
                const text = data.toString();
                session.outputBuffer += text;
                this.outputChannel.append(text);
                this.emit('output', { id, text });
            });
        }

        // Handle stderr
        if (processInstance.stderr) {
            processInstance.stderr.on('data', (data: Buffer) => {
                const text = data.toString();
                session.outputBuffer += text;
                this.outputChannel.append(text);
                this.emit('output', { id, text });
            });
        }

        // Handle process errors
        processInstance.on('error', (error: Error) => {
            const msg = `\n[Error: ${error.message}]\n`;
            session.outputBuffer += msg;
            this.outputChannel.append(msg);
            session.finished = true;
            this.emit('finished', { id, exitCode: null, error: error.message });
        });

        // Handle process exit
        processInstance.on('close', (code: number | null) => {
            session.exitCode = code;
            session.finished = true;
            const duration = ((Date.now() - session.startedAt) / 1000).toFixed(1);
            this.outputChannel.appendLine(`[${id}] Exited with code ${code} (${duration}s)`);
            this.emit('finished', { id, exitCode: code });
        });

        this.sessions.set(id, session);
        return session;
    }

    /**
     * Wait for command output with streaming support.
     * Returns when: process exits OR timeout reached.
     */
    public async waitForOutput(
        id: string, 
        timeoutSeconds: number, 
        onData?: (data: string) => void
    ): Promise<{ output: string; exitCode: number | null; timedOut: boolean }> {
        const session = this.sessions.get(id);
        if (!session) {
            return { output: '', exitCode: null, timedOut: false };
        }

        // Setup streaming listener
        let outputListener: ((event: { id: string; text: string }) => void) | undefined;
        if (onData) {
            outputListener = (event: { id: string; text: string }) => {
                if (event.id === id) {
                    const stripped = this.stripAnsi(event.text);
                    if (stripped.length > 0) {
                        onData(stripped);
                    }
                }
            };
            this.on('output', outputListener);

            // Send existing buffer immediately
            if (session.outputBuffer.length > 0) {
                const stripped = this.stripAnsi(session.outputBuffer);
                if (stripped.length > 0) {
                    onData(stripped);
                }
            }
        }

        return new Promise((resolve) => {
            let elapsed = 0;
            const interval = 100;
            const timeoutMs = timeoutSeconds * 1000;

            const cleanup = () => {
                if (outputListener) {
                    this.removeListener('output', outputListener);
                }
            };

            const check = () => {
                const isFinished = session.finished;
                const isTimeout = elapsed >= timeoutMs;

                if (isFinished || isTimeout) {
                    cleanup();
                    const output = this.stripAnsi(session.outputBuffer);
                    resolve({
                        output,
                        exitCode: session.exitCode,
                        timedOut: isTimeout && !isFinished
                    });
                } else {
                    elapsed += interval;
                    setTimeout(check, interval);
                }
            };

            // Check immediately in case already finished
            check();
        });
    }

    /**
     * Kill a running session
     */
    public killSession(id: string, signal: NodeJS.Signals = 'SIGTERM'): boolean {
        const session = this.sessions.get(id);
        if (session && !session.finished) {
            try {
                session.process.kill(signal);
                session.finished = true;
                this.outputChannel.appendLine(`[${id}] Killed with ${signal}`);
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }

    /**
     * Get session info
     */
    public getSession(id: string): CommandSession | undefined {
        return this.sessions.get(id);
    }

    /**
     * Check if a session is still running
     */
    public isRunning(id: string): boolean {
        const session = this.sessions.get(id);
        return session ? !session.finished : false;
    }

    private stripAnsi(str: string): string {
        const ansiPattern = [
            '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
            '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
        ].join('|');
        return str.replace(new RegExp(ansiPattern, 'g'), '');
    }
}