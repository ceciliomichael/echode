export const getRunTerminalInstructions = (): string => `
## run_terminal
Execute shell commands with real-time streaming output.

CRITICAL RESTRICTIONS:
- Use this tool ONLY for short-lived commands that complete quickly.
- ALLOWED: npm install, npm run build, npm run lint, pip install, cargo build, go build, dotnet build, composer install, bundle install, mvn package, gradle build, make, checking versions, running tests.
- NEVER ALLOWED (unless user explicitly requests it in their message):
  * Development servers: npm run dev, npm start, yarn dev, pnpm dev, python manage.py runserver, flask run, rails server, cargo run (for servers), go run (for servers), dotnet run, php artisan serve, hugo server, gatsby develop, vite, next dev, nuxt dev, remix dev, astro dev.
  * Watch modes: npm run watch, tsc --watch, nodemon, webpack --watch, gulp watch.
  * Any command that runs indefinitely or waits for connections.
- If unsure whether a command starts a server or runs indefinitely, DO NOT run it.

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
<invoke name="run_terminal">
    <parameter name="command">npm install</parameter>
</invoke>
\`\`\`

Example (running a build):
\`\`\`xml
<invoke name="run_terminal">
    <parameter name="command">npm run build</parameter>
    <parameter name="timeout">60</parameter>
</invoke>
\`\`\`
`;