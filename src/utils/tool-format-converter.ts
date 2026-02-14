/**
 * Tool Format Converter
 * 
 * Bidirectional conversion between XML tool format and Kimi tool format.
 * Converts tool calls in assistant messages to match the target model's expected format.
 * 
 * XML Format:
 * <echode:function_calls>
 *   <echode:invoke name="tool_name">
 *     <echode:parameter name="param1">value1</echode:parameter>
 *   </echode:invoke>
 * </echode:function_calls>
 * 
 * Kimi Format:
 * <tool_calls_section_begin>
 * <tool_call_begin> tool_name:0 <tool_call_argument_begin> {"param1":"value1"} <tool_call_end>
 * <tool_calls_section_end>
 */

import { TOOL_XML_NAMESPACE } from '../tool-xml';

/**
 * Detect if content contains XML format tool calls
 */
export function hasXmlToolCalls(content: string): boolean {
	const functionCallsPattern = new RegExp(`<${TOOL_XML_NAMESPACE}:function_calls[\\s>]`);
	return functionCallsPattern.test(content);
}

/**
 * Detect if content contains Kimi format tool calls
 */
export function hasKimiToolCalls(content: string): boolean {
	return content.includes('<tool_calls_section_begin>');
}

/**
 * Parse XML invoke block and extract tool data
 */
function parseXmlInvokeBlock(invokeContent: string): { name: string; parameters: Record<string, unknown> } | null {
	const nameMatch = invokeContent.match(/name\s*=\s*["']([^"']+)["']/);
	if (!nameMatch) {
		return null;
	}

	const toolName = nameMatch[1];
	const parameters: Record<string, unknown> = {};

	// Parse parameters using regex
	const paramRegex = new RegExp(
		`<${TOOL_XML_NAMESPACE}:parameter(?:\\s+[^>]+)?\\s+name\\s*=\\s*["']([^"']+)["'][^>]*>([\\s\\S]*?)</${TOOL_XML_NAMESPACE}:parameter>`,
		'g'
	);

	let match: RegExpExecArray | null;
	while ((match = paramRegex.exec(invokeContent)) !== null) {
		const paramName = match[1];
		const rawValue = match[2];

		// For edit tool, preserve content (no unescaping) but strip only outer newlines to avoid XML indentation artifacts
		if (toolName === 'edit' && (paramName === 'old_string' || paramName === 'new_string' || paramName === 'explanation')) {
			const cleaned = rawValue.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
			const logPreview = (value: string) => {
				const max = 200;
				return value.length > max ? `${value.slice(0, max)}…(truncated ${value.length - max} chars)` : value;
			};
			try {
				console.log('[tool-format-converter] edit param parsed', {
					toolName,
					paramName,
					rawPreview: logPreview(rawValue),
					cleanedPreview: logPreview(cleaned),
				});
			} catch {
				// avoid breaking parsing due to logging issues
			}
			parameters[paramName] = cleaned;
			continue;
		}

		let paramValue = rawValue;

		// Trim but preserve internal whitespace for code content
		paramValue = paramValue.replace(/^\r?\n/, '').replace(/\r?\n$/, '');

		parameters[paramName] = parseParameterValue(paramValue);
	}

	return { name: toolName, parameters };
}

/**
 * Parse parameter value with type coercion
 */
function parseParameterValue(value: string): unknown {
	const trimmed = value.trim();

	// Try JSON parsing first
	if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length > 1) {
		try {
			return JSON.parse(trimmed);
		} catch {
			// Fall through to other parsing
		}
	}

	// Boolean
	if (trimmed === 'true') {return true;}
	if (trimmed === 'false') {return false;}

	// Number
	if (trimmed && !isNaN(Number(trimmed))) {
		return Number(trimmed);
	}

	// String (unescape XML entities)
	return value
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

/**
 * Convert XML tool format to Kimi format
 */
function convertXmlToKimi(content: string): string {
	const functionCallsRegex = new RegExp(
		`<${TOOL_XML_NAMESPACE}:function_calls>([\\s\\S]*?)</${TOOL_XML_NAMESPACE}:function_calls>`,
		'g'
	);

	return content.replace(functionCallsRegex, (match, innerContent) => {
		const invokeRegex = new RegExp(
			`<${TOOL_XML_NAMESPACE}:invoke([^>]*)>([\\s\\S]*?)</${TOOL_XML_NAMESPACE}:invoke>`,
			'g'
		);

		const toolCalls: string[] = [];
		let invokeMatch: RegExpExecArray | null;

		while ((invokeMatch = invokeRegex.exec(innerContent)) !== null) {
			const invokeContent = invokeMatch[0];
			const parsed = parseXmlInvokeBlock(invokeContent);

			if (parsed) {
				const argsJson = JSON.stringify(parsed.parameters);
				toolCalls.push(`<tool_call_begin> ${parsed.name}:${toolCalls.length} <tool_call_argument_begin> ${argsJson} <tool_call_end>`);
			}
		}

		if (toolCalls.length === 0) {
			return match; // Keep original if parsing failed
		}

		return `<tool_calls_section_begin>\n${toolCalls.join('\n')}\n<tool_calls_section_end>`;
	});
}

/**
 * Parse Kimi tool call and extract tool data
 */
function parseKimiToolCall(line: string): { name: string; index: number; parameters: Record<string, unknown> } | null {
	const match = line.match(/<tool_call_begin>\s+(\w+):(\d+)\s+<tool_call_argument_begin>\s+(.+?)\s+<tool_call_end>/);
	if (!match) {
		return null;
	}

	const [, toolName, indexStr, argsJson] = match;

	try {
		const parameters = JSON.parse(argsJson.trim());
		return { name: toolName, index: parseInt(indexStr, 10), parameters };
	} catch {
		return null;
	}
}

/**
 * Convert Kimi format to XML tool format
 */
function convertKimiToXml(content: string): string {
	const sectionRegex = /<tool_calls_section_begin>([\s\S]*?)<tool_calls_section_end>/g;

	return content.replace(sectionRegex, (match, innerContent) => {
		const lines = innerContent.split('\n').filter((line: string) => line.trim());
		const invokes: string[] = [];

		for (const line of lines) {
			const parsed = parseKimiToolCall(line.trim());
			if (parsed) {
				const paramsXml = Object.entries(parsed.parameters)
					.map(([name, value]) => {
						const valueStr = typeof value === 'object' 
							? JSON.stringify(value) 
							: String(value);
						const escapedValue = valueStr
							.replace(/&/g, '&amp;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;')
							.replace(/"/g, '&quot;')
							.replace(/'/g, '&apos;');
						return `  <${TOOL_XML_NAMESPACE}:parameter name="${name}">${escapedValue}</${TOOL_XML_NAMESPACE}:parameter>`;
					})
					.join('\n');

				invokes.push(`<${TOOL_XML_NAMESPACE}:invoke name="${parsed.name}">\n${paramsXml}\n</${TOOL_XML_NAMESPACE}:invoke>`);
			}
		}

		if (invokes.length === 0) {
			return match; // Keep original if parsing failed
		}

		return `<${TOOL_XML_NAMESPACE}:function_calls>\n${invokes.join('\n')}\n</${TOOL_XML_NAMESPACE}:function_calls>`;
	});
}

/**
 * Convert tool calls in content to target format
 * @param content - Message content potentially containing tool calls
 * @param targetIsKimi - Whether target model uses Kimi format (true) or XML format (false)
 * @returns Content with tool calls converted to target format
 */
export function convertToolFormat(content: string, targetIsKimi: boolean): string {
	if (!content || typeof content !== 'string') {
		return content;
	}

	// If targeting Kimi format
	if (targetIsKimi) {
		// Convert XML to Kimi only if XML format is detected
		if (hasXmlToolCalls(content)) {
			return convertXmlToKimi(content);
		}
		return content; // Already Kimi or no tool calls
	}

	// If targeting XML format
	if (hasKimiToolCalls(content)) {
		return convertKimiToXml(content);
	}
	return content; // Already XML or no tool calls
}

/**
 * Convert tool calls in all assistant messages to target format
 * @param messages - Array of chat messages
 * @param targetIsKimi - Whether target model uses Kimi format
 * @returns Messages with tool calls converted
 */
export function convertMessagesToolFormat<T extends { role: string; content: unknown }>(
	messages: T[],
	targetIsKimi: boolean
): T[] {
	return messages.map(msg => {
		// Only convert assistant messages that might contain tool calls
		if (msg.role !== 'assistant') {
			return msg;
		}

		// Handle string content
		if (typeof msg.content === 'string') {
			return {
				...msg,
				content: convertToolFormat(msg.content, targetIsKimi)
			};
		}

		// Handle array content (multimodal)
		if (Array.isArray(msg.content)) {
			return {
				...msg,
				content: msg.content.map((part: { type: string; text?: string }) => {
					if (part.type === 'text' && part.text) {
						return { ...part, text: convertToolFormat(part.text, targetIsKimi) };
					}
					return part;
				})
			};
		}

		return msg;
	});
}
