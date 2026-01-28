/**
 * XML utilities from Roo Code
 * Critical for parsing XML tool calls without entity processing issues
 */

/**
 * Simple XML entity unescaping
 * This is used for basic XML parsing without a full XML parser
 */
export function unescapeXmlEntities(text: string): string {
	if (!text) {
		return text;
	}

	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

/**
 * Escapes XML entities for safe XML embedding
 */
export function escapeXmlEntities(text: string): string {
	if (!text) {
		return text;
	}

	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Parses XML content for diff operations
 * IMPORTANT: Does NOT process HTML entities to prevent mismatches
 * 
 * Use this for:
 * - edit tool parsing
 * - Comparing parsed content against original file content
 * - Any operation where exact character matching is required
 */
export function parseXmlForDiff(xmlString: string): Record<string, string> {
	const result: Record<string, string> = {};

	// Simple regex-based XML parsing that doesn't process entities
	// This ensures exact character matching for diff operations
	const tagPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
	let match;

	while ((match = tagPattern.exec(xmlString)) !== null) {
		const tagName = match[1];
		const content = match[2];
		result[tagName] = content; // Don't unescape - keep exact content
	}

	return result;
}

/**
 * Parses XML content for general tool use
 * Processes HTML entities for normal tool parameter parsing
 */
export function parseXml(xmlString: string): Record<string, string> {
	const result: Record<string, string> = {};

	const tagPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
	let match;

	while ((match = tagPattern.exec(xmlString)) !== null) {
		const tagName = match[1];
		const content = match[2];
		result[tagName] = unescapeXmlEntities(content); // Unescape for normal use
	}

	return result;
}
