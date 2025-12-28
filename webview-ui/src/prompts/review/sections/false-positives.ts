/**
 * Review Mode - False Positives Section
 * Guidelines for avoiding false positives and handling intentional patterns
 */

export const REVIEW_FALSE_POSITIVES = `<false_positive_handling>
## Avoiding False Positives
Before reporting an issue, verify it's NOT an intentional pattern:

**Check for intentional patterns:**
1. Look for comments like \`// eslint-disable\`, \`// @ts-ignore\`, \`// intentional\`, \`// NOSONAR\`
2. Check if it's in a test file, mock, or fixture
3. Look for surrounding context that explains the pattern
4. Check if there's a type assertion with a comment explaining why

**When you find intentional patterns:**
- If justified: Mark as "⚪ ACKNOWLEDGED RISK" instead of a finding
- If unjustified: Report it but note the existing suppression

**Example Acknowledged Risk:**
\`\`\`markdown
## ⚪ Acknowledged Risks
**File:** \`src/ffi/bindings.ts\` **Line:** 12
\`\`\`typescript
// @ts-ignore - FFI binding returns unknown structure
const result = externalLib.call() as any;
\`\`\`
**Note:** Intentional \`any\` for FFI boundary. Consider adding runtime validation.
\`\`\`

**Confidence Levels:**
- 🔺 **HIGH CONFIDENCE**: Clear violation with direct evidence
- 🔸 **MEDIUM CONFIDENCE**: Likely issue, may depend on runtime context
- 🔹 **LOW CONFIDENCE**: Potential issue, needs team input
</false_positive_handling>`;