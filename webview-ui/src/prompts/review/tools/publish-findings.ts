/**
 * Review Mode - publish_findings tool instructions
 */

export function getPublishFindingsInstructions(): string {
    return `## publish_findings
Create and save a comprehensive code review report.

Parameters:
- content: The complete code review in markdown format (required)
- title: Custom report title (optional, defaults to "Code Review Report")
- scope: Description of what was reviewed (optional)

IMPORTANT:
- Use this at the END of your review to save all findings
- The report is saved to .echode/codereview/review-{uuid}.md
- Include ALL findings organized by severity
- Follow the required report format from your instructions

Report Structure:
1. Executive Summary (2-3 sentences)
2. Metrics (files reviewed, issue counts, health score)
3. Critical Issues (🔴)
4. High Priority (🟠)
5. Medium Priority (🟡)
6. Low Priority (🔵)
7. Suggestions (🟣)
8. Summary & Next Steps`;
}