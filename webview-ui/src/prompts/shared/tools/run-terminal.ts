/**
 * Shared run_terminal tool instructions
 * Supports restricted and unrestricted modes
 */

export interface RunTerminalOptions {
    fullAccessEnabled?: boolean;
    /** Detected shell type (e.g. "PowerShell", "Command Prompt", "Bash") */
    shellType?: string;
}

export function getRunTerminalInstructions(options: RunTerminalOptions = {}): string {
    const { fullAccessEnabled = false, shellType } = options;

    const base = fullAccessEnabled
        ? getUnrestrictedInstructions()
        : getRestrictedInstructions();

    const shellGuide = shellType ? getShellSpecificGuide(shellType) : '';

    return base + shellGuide;
}

function getUnrestrictedInstructions(): string {
    return `## run_terminal
Execute shell commands with real-time streaming output.

MODE: UNRESTRICTED (Full Terminal Access enabled)
- All commands are allowed, including dev servers and long-running processes.
- Be aware that long-running processes will block until timeout.

Parameters:
- command: Command to run (required)
- id: Session ID for multiple concurrent sessions (optional, default: "default")
- timeout: Max execution time in seconds (optional, default: 300 = 5 minutes)

Behavior:
- Executes the command and streams output in real-time
- Waits for command to complete or timeout
- Automatically terminates process if it exceeds timeout
- Returns full output when done`;
}

function getRestrictedInstructions(): string {
    return `## run_terminal
Execute shell commands with real-time streaming output.

CRITICAL RESTRICTIONS:
- Use this tool ONLY when absolutely necessary for short-lived commands that complete quickly.
- ALLOWED: npm install, npm run build, npm run lint, pip install, cargo build, go build, dotnet build, composer install, bundle install, mvn package, gradle build, make, checking versions, running tests.
- INSTALLATION RULE: Do NOT run installation commands immediately. Always check configuration files (package.json, requirements.txt, etc.) first. If the package is already listed skip installation if not do an install command.
- FORBIDDEN AND BLOCKED (The tool will reject these):
  * Development servers: npm run dev, npm start, yarn dev, pnpm dev, python manage.py runserver, flask run, rails server, cargo run, go run, dotnet run, php artisan serve, etc.
  * Watch modes: npm run watch, tsc --watch, nodemon, webpack --watch, gulp watch.
  * Any command that runs indefinitely or waits for connections.
- ACTION: If you need to test a server or watch mode, ASK THE USER to run it in their terminal. Do not attempt to run it yourself.

Parameters:
- command: Command to run (required)
- id: Session ID for multiple concurrent sessions (optional, default: "default")
- timeout: Max execution time in seconds (optional, default: 300 = 5 minutes)

Behavior:
- Executes the command and streams output in real-time
- Waits for command to complete or timeout
- Automatically terminates process if it exceeds timeout
- Returns full output when done`;
}

/**
 * Returns shell-specific command syntax guidance based on the detected terminal type.
 * This helps the AI write correct commands for the user's actual shell.
 */
function getShellSpecificGuide(shellType: string): string {
    switch (shellType) {
        case 'PowerShell':
            return `

SHELL: PowerShell
You MUST write commands using PowerShell syntax:
- Use semicolons (;) to chain commands, NOT && or ||
- Use \`$env:VAR\` for environment variables, NOT %VAR% or $VAR
- Use \`Remove-Item\` or \`ri\` instead of rm/del for deleting
- Use \`Get-ChildItem\` or \`ls\`/\`dir\` for listing files
- Use \`Set-Location\` or \`cd\` for changing directories
- Use \`Select-String\` instead of grep/findstr
- Use backtick (\`) for line continuation, NOT backslash
- Use \`-and\`/\`-or\` for logical operators in conditions
- Quoting: prefer single quotes for literal strings, double quotes when variable expansion is needed
- Redirect stderr: use 2>&1 to merge stderr into stdout
- Test path existence: \`Test-Path\`
- Create directories: \`New-Item -ItemType Directory -Force\``;

        case 'Command Prompt':
            return `

SHELL: Command Prompt (cmd.exe)
You MUST write commands using cmd.exe syntax:
- Use && to chain commands (run next only if previous succeeds)
- Use & to chain commands unconditionally
- Use %VAR% for environment variables, NOT $VAR or $env:VAR
- Use \`del\` / \`rmdir /s /q\` for deleting files/directories
- Use \`dir\` for listing files (NOT ls)
- Use \`findstr\` instead of grep or Select-String
- Use \`type\` instead of cat
- Use \`copy\`/\`xcopy\`/\`robocopy\` instead of cp
- Use \`move\` instead of mv
- Use \`mkdir\` or \`md\` to create directories
- Use caret (^) for line continuation
- Use \`if exist\` / \`if not exist\` for path checks
- Quoting: use double quotes for paths with spaces
- No native support for piping to grep — use \`| findstr\``;

        case 'Bash':
        case 'Zsh':
            return `

SHELL: ${shellType}
You MUST write commands using ${shellType} syntax:
- Use && to chain commands, || for fallback
- Use $VAR or \${VAR} for environment variables
- Use rm / rm -rf for deleting
- Use ls for listing, grep for searching
- Use backslash (\\) for line continuation
- Use single quotes for literal strings, double quotes for variable expansion
- Use \`[ -f file ]\` / \`[ -d dir ]\` for path checks
- Use \`mkdir -p\` to create nested directories`;

        case 'Fish':
            return `

SHELL: Fish
You MUST write commands using Fish syntax:
- Use \`; and\` to chain commands (NOT &&)
- Use \`set -x VAR value\` to export environment variables
- Use \`$VAR\` for variable expansion (no curly braces needed)
- No support for !! or $? — use \`$status\` for last exit code
- Use \`test -f file\` / \`test -d dir\` for path checks
- Use \`string\` builtin for string manipulation instead of sed/awk where possible
- Use \`begin; ...; end\` for command grouping`;

        case 'Nushell':
            return `

SHELL: Nushell
You MUST write commands using Nushell syntax:
- Nushell uses structured data — commands return tables, not plain text
- Use \`|\` for pipelines (similar to Unix but operates on structured data)
- Use \`let\` for variable assignment: \`let x = 5\`
- Use \`$env.VAR\` for environment variables
- Use \`rm\`, \`ls\`, \`cp\`, \`mv\` (built-in, structured output)
- Use \`open\` to read files, \`save\` to write
- Use \`if\` / \`else\` blocks (no \`[\` test syntax)
- Use \`mkdir\` to create directories`;

        default:
            return `

SHELL: ${shellType}
Write commands compatible with the ${shellType} shell. If unsure about syntax, prefer POSIX-compatible commands.`;
    }
}