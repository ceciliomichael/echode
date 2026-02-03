/**
 * Shared report_back tool instructions
 */

export function getReportBackInstructions(): string {
    return `## report_back
Report the final result back to the main agent and end the session.

Parameters:
- result: (REQUIRED) The result data object containing your findings

IMPORTANT:
- Session tracking is AUTOMATIC - you do NOT need to provide a session ID
- Use this tool when you have completed your assigned task
- The result should contain all relevant findings, data, or conclusions`;
}