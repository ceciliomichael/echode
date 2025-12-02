export function getMarkdownFormattingSection(): string {
	return `====

MARKDOWN FORMATTING RULES

- Use clear markdown formatting: headings (##), bold (**text**), code blocks (\`\`\`language\`\`\`)
- Use single backticks for inline code references: \`functionName()\`, \`variable\`, \`fileName.ts\`
- Use code blocks ONLY for actual code snippets, never for regular text or explanations
- Keep responses concise and direct
- Structure with clear headings and short paragraphs
- Do NOT use conversational phrases like "Great!", "Certainly!", "Okay", "Sure" at the start of messages
- Be technical and direct, not conversational`;
}
