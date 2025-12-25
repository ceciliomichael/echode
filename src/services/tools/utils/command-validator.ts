export class CommandValidator {
    private static readonly FORBIDDEN_PATTERNS: RegExp[] = [
        // Node.js / JavaScript / TypeScript
        // Uses \b to match at word boundaries, catching chained commands (e.g., "cd x && npm start")
        /\bnpm\s+(run\s+)?(start|dev|serve|watch|live|hot)\b/i,
        /\byarn\s+(start|dev|serve|watch|live|hot)\b/i,
        /\bpnpm\s+(start|dev|serve|watch|live|hot)\b/i,
        /\bbun\s+(run\s+)?(start|dev|serve|watch|live|hot)\b/i,
        /\bnpx\s+(nodemon|ts-node-dev|vite|next|nuxt|react-scripts|webpack(-dev-server)?|parcel|live-server|http-server)\b/i,
        /\bnode\s+--watch\b/i,
        /\bnodemon\b/i,
        /\bvite\b/i,
        /\bnext(\s+dev)?\b/i,
        /\bnuxt\b/i,
        /\bgatsby\s+develop\b/i,
        /\breact-scripts\s+start\b/i,

        // Python
        /python.*manage\.py\s+runserver/i,
        /\bflask\s+run\b/i,
        /\buvicorn\b/i,
        /\bgunicorn\b/i,
        /\bdaphne\b/i,
        /\bcelery\b/i,
        /\bstreamlit\s+run\b/i,

        // Ruby / Rails
        /\brails\s+(server|s)\b/i,
        /\bbundle\s+exec\s+rails\s+(server|s)\b/i,
        /\brackup\b/i,
        /\bpuma\b/i,
        /\bsidekiq\b/i,

        // Go
        /\bgo\s+run\b/i, // Often used for servers
        /\bair\b/i, // Go live reload

        // PHP
        /\bphp\s+artisan\s+serve\b/i,
        /\bphp\s+-S\b/i,
        /\bsymfony\s+server:start\b/i,

        // Java / JVM
        /\bmvn\s+(spring-boot:run|jetty:run|tomcat7:run)\b/i,
        /\bgradle\s+(bootRun|run)\b/i,

        // Dart / Flutter
        /\bflutter\s+run\b/i,
        /\bdart\s+run\b/i,

        // Rust
        /\bcargo\s+(run|watch)\b/i,

        // .NET
        /\bdotnet\s+(run|watch)\b/i,

        // General / System
        /\bwatch\s/i,
        /\btail\s+-f\b/i,
        /\bdocker-compose\s+up\b/i,
        /\bdocker\s+run.*-d\b/i,
    ];

    /**
     * Validates if a command is allowed to be executed.
     * Throws error if command is forbidden (unless bypassed).
     * @param command - The command to validate
     * @param bypassValidation - If true, skip all validation checks
     */
    static validate(command: string, bypassValidation: boolean = false): void {
        // Skip validation if full terminal access is enabled
        if (bypassValidation) {
            return;
        }

        const normalizedCommand = command.trim();

        for (const pattern of this.FORBIDDEN_PATTERNS) {
            if (pattern.test(normalizedCommand)) {
                throw new Error(
                    "Command blocked: Starting development servers or long-running processes is not allowed. Please ask the user to run this command in their terminal."
                );
            }
        }
    }
}