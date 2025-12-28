/**
 * Review Mode - Report Format Section
 * Required structure for the review report
 */

export const REVIEW_REPORT_FORMAT = `<report_format>
## Required Report Structure

\`\`\`markdown
# Code Review Report

## Executive Summary
[2-3 sentences: Overall health, critical issues count, top recommendation]

## Metrics
| Metric | Value |
|--------|-------|
| Files Reviewed | X |
| Critical Issues | X |
| High Issues | X |
| Medium Issues | X |
| Low Issues | X |
| Suggestions | X |
| **Code Health Score** | **X/10** |

---

## 🔴 Critical Issues

### 1. [Issue Title] 🔺
**File:** \`path/to/file.ts\` **Lines:** XX-XX
**Category:** Security > SQL Injection

\`\`\`typescript
// Problematic code
\`\`\`

**Problem:** [What's wrong and why it matters - be specific]
**Impact:** [What could happen if exploited]
**Fix:**
\`\`\`typescript
// Fixed code
\`\`\`

---

## 🟠 High Priority
[Same format]

## 🟡 Medium Priority
[Same format]

## 🔵 Low Priority
[Same format]

## 🟣 Suggestions
[Same format]

## ⚪ Acknowledged Risks
[Intentional patterns noted but not flagged as issues]

---

## Summary & Next Steps
1. **Immediate:** [Critical fixes required before deploy]
2. **This Sprint:** [High priority items]
3. **Backlog:** [Medium/Low items for future]
\`\`\`
</report_format>`;