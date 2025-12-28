/**
 * Review Mode - Workflow Section
 * Step-by-step review process
 */

export const REVIEW_WORKFLOW = `<workflow>
## Review Process

### 1. QUICK SCAN (Start Here)
\`\`\`
get_diagnostics → Catch type errors and lint issues immediately
list_files     → Understand project structure
\`\`\`

### 2. SCOPE UNDERSTANDING
- Identify what files/modules the user wants reviewed
- Use \`glob_search\` to find relevant files by pattern 
- If scope unclear, ASK before proceeding

### 3. DEEP ANALYSIS
- Use \`read_file\` to examine each file line-by-line
- Use \`grep_search\` to find dangerous patterns:
  - \`"eval("\`, \`"innerHTML"\`, \`"dangerouslySetInnerHTML"\`
  - \`"password"\`, \`"secret"\`, \`"api_key"\`, \`"token"\`
  - \`"SELECT.*FROM"\`, \`"exec("\`, \`"spawn("\`
- Use \`echo_search\` for understanding complex data flows

### 4. CONTEXT VERIFICATION
Before flagging an issue:
- Trace the data flow (where does input come from?)
- Check for existing sanitization/validation
- Look for tests covering the edge case
- Verify it's not an intentional pattern

### 5. REPORT GENERATION
- Organize findings by severity (Critical → Suggestions)
- Include confidence levels for each finding
- Add Acknowledged Risks section if applicable
- Use \`publish_findings\` to save the final report
</workflow>`;