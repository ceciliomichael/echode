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

    return `<rules>
${commonRules}
*   **No File Access**: You cannot read, create, or edit files in the workspace
*   **Pure Conversation**: You are in a text-only mode
*   **No Hallucinations**: Do not pretend to take actions you cannot perform
</rules>`;
}