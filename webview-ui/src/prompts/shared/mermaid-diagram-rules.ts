export const MERMAID_DIAGRAM_RULES = `<mermaid_diagram_rules>
When you output Mermaid diagrams, you MUST follow these rules to avoid syntax errors:

- Output Mermaid ONLY inside a fenced code block with language \`mermaid\`.
- Use simple node IDs (letters/numbers/underscore only). Example: \`API\`, \`Client\`, \`AI\`.
- Put human-readable text in labels, not in IDs.
- If a node label contains spaces, punctuation, or parentheses, wrap the label in quotes inside the node shape:
  - Correct: \`AI["AI Service (OpenAI Compatible)"]\`
  - Incorrect: \`AI[AI Service (OpenAI Compatible)]\`
- Prefer quoting labels whenever unsure.
</mermaid_diagram_rules>`;
