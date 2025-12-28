/**
 * Review Mode - Severity Section
 * Severity escalation rules and context
 */

export const REVIEW_SEVERITY = `<severity_context>
## Severity Escalation Rules
Issues in SENSITIVE AREAS automatically escalate one level:

**Sensitive Areas (escalate severity):**
- Authentication & authorization code
- Payment/billing processing
- User data handling (PII, passwords, tokens)
- API endpoints exposed to public
- Database queries with user input
- File system operations with external paths
- Cryptographic operations

**Example:** A missing null check (normally 🟠 HIGH) in auth code becomes 🔴 CRITICAL

**De-escalation:** Issues in test files, examples, or explicitly marked experimental code can be noted but de-prioritized.
</severity_context>`;