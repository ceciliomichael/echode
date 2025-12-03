import type { ChatMode } from '../../types/chat-mode';

export function getVisualizationGuidelinesSection(mode: ChatMode): string {
	const outputFormatJudgment = `====

VISUALIZATION & OUTPUT FORMAT GUIDELINES

<output_format_judgment>
When producing markdown content (diagrams, documentation, explanations):

RESPOND INLINE (default) when:
- Answering questions or explaining concepts
- Content is conversational or transient
- Visualizing to aid understanding
- Short content (< 100 lines)
- No explicit file creation request

CREATE FILE only when:
- User explicitly requests file creation ("create a file", "save as", "write to")
- Content is a persistent deliverable (README, documentation, specs)
- User says "document this in a file", "generate [filename]"

Default to inline responses—avoid cluttering workspace with unnecessary files.
</output_format_judgment>`;

	const mermaidSelection = `
<mermaid_usage>
Use mermaid diagrams when visualization clarifies understanding:

DIAGRAM TYPE SELECTION:
- Process/decision flow → flowchart TD or LR
- Time-ordered interactions → sequenceDiagram
- State transitions → stateDiagram-v2
- Hierarchies/dependencies → graph TD
- Class relationships → classDiagram (when relevant)

BEST PRACTICES:
- Keep diagrams focused: aim for 5-12 nodes max
- Split complex systems into multiple focused diagrams
- Use clear, descriptive labels
- Format: ALWAYS include both opening and closing code fences:
  \`\`\`mermaid
  [diagram content here]
  \`\`\`
</mermaid_usage>`;

	let modeSpecificGuidance: string;

	if (mode === 'plan') {
		modeSpecificGuidance = `
<planning_visualization>
Leverage diagrams to communicate architecture and design:

USE MERMAID FOR:
- System/component architecture (graph TD)
- Data flow between modules (flowchart)
- API interaction sequences (sequenceDiagram)
- State machines for complex logic (stateDiagram-v2)
- File/module dependency maps (graph)

Diagrams help users validate understanding before implementation.
Create diagrams proactively when planning multi-component changes.
</planning_visualization>`;
	} else if (mode === 'ask') {
		modeSpecificGuidance = `
<qa_visualization>
Use diagrams when they answer the question more clearly than text:

GOOD USE CASES:
- "How does X work?" → sequenceDiagram or flowchart
- "What's the architecture?" → graph/flowchart
- "Explain the relationship between..." → graph or classDiagram
- Complex logic explanations → flowchart

Skip diagrams for simple factual answers or code-focused questions.
</qa_visualization>`;
	} else {
		modeSpecificGuidance = `
<implementation_visualization>
Prioritize code over diagrams. Use mermaid only when:

- Explaining complex refactoring or architectural changes
- User explicitly requests a diagram
- Clarifying intricate logic before implementation

Focus on implementation; diagrams are supplementary, not primary output.
</implementation_visualization>`;
	}

	return `${outputFormatJudgment}
${mermaidSelection}
${modeSpecificGuidance}`;
}
