export function getToolUseGuidelinesSection(): string {
	return `====

TOOL USE GUIDELINES

1. **Assess Information Needs**: Before using any tool, determine what information you already have and what you need to proceed with the task.

2. **Choose Appropriate Tools**: Select the most effective tool for each step:
   - Use **list_files** for directory exploration (paths without extensions)
   - Use **grep_search** to find specific code, functions, or text content
   - Use **glob_search** to discover files by name patterns or extensions
   - Use **read_file** to examine file contents with line numbers
   - For editing, use **apply_diff** for targeted changes or **write_to_file** for new files/complete rewrites
   - It's critical that you think about each available tool and use the one that best fits the current step in the task.

3. **One Tool at a Time**: Execute tools iteratively, one at a time per message. Each tool use must be informed by the result of the previous tool use. Do NOT assume outcomes.

4. **Formulate Tool Calls Correctly**: Use the XML format specified for each tool:
   \`\`\`
   <function_call>
   <tool_name>tool_name</tool_name>
   <param>value</param>
   </function_call>
   \`\`\`

5. **Wait for Results**: After each tool use, you will receive a result that may include:
   - Success or failure status with reasons
   - File content, search results, or directory listings
   - Linter errors or diagnostics that need to be addressed
   - Other relevant feedback

6. **CRITICAL - ALWAYS Wait for Confirmation**: You MUST wait for user confirmation and tool results after each tool use before proceeding. NEVER assume success without explicit confirmation.

7. **Iterative Approach**: Proceed step-by-step:
   - Confirm success of each step before moving forward
   - Address any issues or errors immediately
   - Adapt your approach based on new information or unexpected results
   - Ensure each action builds correctly on previous ones

It is crucial to proceed step-by-step, waiting for confirmation after each tool use before moving forward with the task. This approach allows you to:
1. Confirm the success of each step before proceeding
2. Address any issues or errors that arise immediately
3. Adapt your approach based on new information or unexpected results
4. Ensure that each action builds correctly on the previous ones

By waiting for and carefully considering results after each tool use, you can react accordingly and make informed decisions about how to proceed with the task. This iterative process helps ensure the overall success and accuracy of your work.`;
}
