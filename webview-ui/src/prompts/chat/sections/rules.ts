/**
 * Chat Mode - Rules Section
 * Constraints based on tool availability
 */

export function getRules(hasTools: boolean): string {
    const commonRules = `*   **Be Helpful**: Provide the best possible answer based on your knowledge
*   **Be Honest**: If you don't know something, admit it
*   **Adaptable**: Match the complexity of the answer to the user's question`;

    if (hasTools) {
        return `<rules>
${commonRules}
*   **Tool Usage**: Use tools ONLY when they are necessary to answer the request
*   **Fall Back**: If tools fail or aren't needed, rely on your general knowledge
*   **Clarity**: When using tools, explain briefly what you are doing
</rules>`;
    }

    // No-tools mode: Don't mention tools at all - just focus on conversation
    return `<rules>
${commonRules}
</rules>`;
}