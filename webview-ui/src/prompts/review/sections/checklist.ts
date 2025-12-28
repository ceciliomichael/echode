/**
 * Review Mode - Analysis Checklist
 * Detailed checklist for identifying issues
 */

export const REVIEW_CHECKLIST = `<analysis_checklist>
## 🔴 CRITICAL - Security Vulnerabilities
- **Injection attacks**: SQL/NoSQL injection, command injection, LDAP injection
- **XSS**: Unescaped user input in HTML/JS, innerHTML with user data
- **Auth flaws**: Bypass vulnerabilities, weak session management, timing attacks
- **Authz flaws**: IDOR, privilege escalation, missing permission checks
- **Secrets exposure**: Hardcoded API keys, passwords, tokens in code
- **Path traversal**: Unsanitized file paths (../ attacks)
- **Insecure crypto**: Weak algorithms (MD5/SHA1 for passwords), poor key handling
- **Deserialization**: Unsafe parsing of untrusted data

## 🟠 HIGH - Bugs & Logic Errors
- **Null safety**: Missing null/undefined checks leading to crashes
- **Concurrency**: Race conditions, deadlocks, improper async handling
- **Boundary errors**: Off-by-one, array out-of-bounds, incorrect loop conditions
- **Resource leaks**: Unclosed connections, file handles, event listeners
- **Error handling gaps**: Swallowed errors, unhandled promise rejections
- **State bugs**: Stale closures, incorrect mutations, shared mutable state
- **Logic errors**: Infinite loops, unreachable code, incorrect boolean logic

## 🟡 MEDIUM - Performance Issues
- **Database**: N+1 queries, missing indexes, unbounded fetches (no pagination)
- **Memory**: Leaks from listeners, circular refs, large object retention
- **Rendering**: Unnecessary re-renders, missing memoization, layout thrashing
- **Algorithms**: O(n²) when O(n) possible, redundant computations
- **Network**: Duplicate requests, missing caching, no request deduplication
- **Bundle**: Unused imports, missing code splitting, large dependencies

## 🔵 LOW - Code Quality
- **Architecture**: SOLID violations, tight coupling, missing abstractions
- **DRY violations**: Duplicated logic that should be extracted
- **Naming**: Unclear or misleading variable/function names
- **Type safety**: \`any\` types, incorrect interfaces, missing generics
- **Complexity**: Deep nesting, complex conditionals, magic numbers
- **Documentation**: Missing docs for public APIs or complex logic

## 🟣 SUGGESTIONS - Best Practices
- **Accessibility**: Missing ARIA, poor keyboard navigation, color contrast
- **Validation**: Missing input sanitization, incomplete schema validation
- **Observability**: Missing logging, no error tracking, poor debuggability
- **Testability**: Tightly coupled code, hard-to-mock dependencies
- **Deprecations**: Using deprecated APIs or patterns
</analysis_checklist>`;