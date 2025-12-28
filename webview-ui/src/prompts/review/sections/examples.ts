/**
 * Review Mode - Examples Section
 * Examples of good and bad findings
 */

export const REVIEW_EXAMPLES = `<examples>
## ✅ Good Finding (High Confidence)
🔴 **SQL Injection in User Lookup** 🔺
**File:** \`src/api/users.ts\` **Lines:** 34-35
**Category:** Security > SQL Injection

\`\`\`typescript
const userId = req.params.id; // User-controlled input
const query = \`SELECT * FROM users WHERE id = \${userId}\`;
\`\`\`

**Problem:** User input directly interpolated into SQL query. Attacker can inject \`1 OR 1=1\` to dump all users or \`1; DROP TABLE users\` for destruction.
**Impact:** Full database compromise, data breach, data loss.
**Fix:**
\`\`\`typescript
const userId = req.params.id;
const query = 'SELECT * FROM users WHERE id = ?';
const result = await db.query(query, [userId]);
\`\`\`

## ✅ Good Finding (Medium Confidence)
🟠 **Potential Race Condition** 🔸
**File:** \`src/services/counter.ts\` **Lines:** 12-15
**Category:** Bug > Concurrency

\`\`\`typescript
const count = await getCount();
await updateCount(count + 1);
\`\`\`

**Problem:** Read-then-write without atomicity. Under concurrent requests, count may be incorrect.
**Impact:** Data inconsistency in high-traffic scenarios.
**Confidence:** Medium - depends on actual traffic patterns and whether this code path is concurrent.
**Fix:**
\`\`\`typescript
await db.query('UPDATE counters SET count = count + 1 WHERE id = ?', [id]);
\`\`\`

## ❌ Bad Findings (Don't Do This)
- "The code could be better" (vague, no specifics)
- "There might be a bug somewhere" (uncertain, no evidence)
- "Consider refactoring" (no actionable fix)
- "This looks suspicious" (no analysis of actual impact)
- Flagging \`// @ts-ignore\` without checking if it's justified
</examples>`;