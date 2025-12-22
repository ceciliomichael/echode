/**
 * Review Mode - grep_search tool instructions
 */

export function getGrepSearchInstructions(): string {
    return `## grep_search
Fast text/pattern search across files - essential for security review.

Parameters:
- query: Text or pattern to find (required)
- path: Directory to search (recommended)
- isRegex: Enable regex patterns (optional)
- includes: Glob filters like "*.ts" (optional)

Usage for Code Review:
- Find security anti-patterns: "eval(", "innerHTML", "dangerouslySetInnerHTML"
- Locate hardcoded secrets: "password", "apiKey", "secret"
- Track function usage across codebase
- Find TODO/FIXME comments indicating known issues

Security Patterns to Search:
- SQL: "query(", "\${" (template literals in queries)
- XSS: "innerHTML", "document.write"
- Secrets: "Bearer ", "sk-", "password ="
- Dangerous: "eval(", "Function(", "exec("`;
}