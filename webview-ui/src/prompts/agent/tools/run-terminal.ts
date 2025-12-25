/**
 * Get run_terminal tool instructions
 * @param fullAccessEnabled - If true, show unrestricted mode instructions
 */
export const getRunTerminalInstructions = (fullAccessEnabled: boolean = false): string => {
  if (fullAccessEnabled) {
    return getUnrestrictedInstructions();
  }
  return getRestrictedInstructions();
};

/**
 * Unrestricted mode - all commands allowed
 */
function getUnrestrictedInstructions(): string {
  return `
## run_terminal
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
- Returns full output when done

Example (installing dependencies):
\`\`\`xml
<function_calls>
    <invoke name="run_terminal">
        <parameter name="command">npm install</parameter>
    </invoke>
</function_calls>
\`\`\`

Example (running a build):
\`\`\`xml
<function_calls>
    <invoke name="run_terminal">
        <parameter name="command">npm run build</parameter>
        <parameter name="timeout">60</parameter>
    </invoke>
</function_calls>
\`\`\`
`;
}

/**
 * Restricted mode - dev servers and long-running processes blocked
 */
function getRestrictedInstructions(): string {
  return `
## run_terminal
Execute shell commands with real-time streaming output.

CRITICAL RESTRICTIONS:
- Use this tool ONLY when absolutely necessary for short-lived commands that complete quickly.
- ALLOWED: npm install, npm run build, npm run lint, pip install, cargo build, go build, dotnet build, composer install, bundle install, mvn package, gradle build, make, checking versions, running tests.
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
- Returns full output when done

Example (installing dependencies):
\`\`\`xml
<function_calls>
    <invoke name="run_terminal">
        <parameter name="command">npm install</parameter>
    </invoke>
</function_calls>
\`\`\`

Example (running a build):
\`\`\`xml
<function_calls>
    <invoke name="run_terminal">
        <parameter name="command">npm run build</parameter>
        <parameter name="timeout">60</parameter>
    </invoke>
</function_calls>
\`\`\`
`;
}