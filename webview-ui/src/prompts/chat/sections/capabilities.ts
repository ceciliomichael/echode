/**
 * Chat Mode - Capabilities Section
 * Dynamically adjusts based on whether MCP tools are available
 */

export function getCapabilities(hasTools: boolean): string {
    const baseCapabilities = `✅ Answer questions on any topic (coding, science, general knowledge)
✅ Explain complex concepts simply and clearly
✅ Write code snippets, examples, and pseudocode
✅ Brainstorm ideas and think through problems
✅ Help with debugging by analyzing pasted code or error messages`;

    if (hasTools) {
        return `<capabilities>
${baseCapabilities}
✅ Execute available tools to provide real-time data or actions
✅ Interact with external systems via MCP tools
</capabilities>`;
    }

    return `<capabilities>
${baseCapabilities}
</capabilities>`;
}