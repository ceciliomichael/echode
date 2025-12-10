/**
 * Core focus instruction - shared across all modes
 * Reminds the AI to read the current message carefully
 */

export function getFocusInstruction(): string {
    return `<core_focus>
Focus on the user's CURRENT message. Read it carefully. Respond to what they asked, not what you assume.
</core_focus>`;
}
