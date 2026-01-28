/**
 * Line number utilities from Roo Code
 * Critical for AI accuracy with edit and read_file tools
 */

/**
 * Adds line numbers to content in the format "N | content"
 * @param content The content to add line numbers to
 * @param startLine The starting line number (default 1)
 * @returns Content with line numbers prepended
 */
export function addLineNumbers(content: string, startLine: number = 1): string {
	// If content is empty, return empty string - empty files should not have line numbers
	// If content is empty but startLine > 1, return "startLine | " because we know the file is not empty
	// but the content is empty at that line offset
	if (content === "") {
		return startLine === 1 ? "" : `${startLine} | \n`;
	}

	// Split into lines and handle trailing line feeds (\n)
	const lines = content.split("\n");
	const lastLineEmpty = lines[lines.length - 1] === "";
	if (lastLineEmpty) {
		lines.pop();
	}

	const maxLineNumberWidth = String(startLine + lines.length - 1).length;
	const numberedContent = lines
		.map((line, index) => {
			const lineNumber = String(startLine + index).padStart(maxLineNumberWidth, " ");
			return `${lineNumber} | ${line}`;
		})
		.join("\n");

	return numberedContent + "\n";
}

/**
 * Checks if every line in the content has line numbers prefixed (e.g., "1 | content" or "123 | content")
 * Line numbers must be followed by a single pipe character (not double pipes)
 */
export function everyLineHasLineNumbers(content: string): boolean {
	const lines = content.split(/\r?\n/); // Handles both CRLF and LF line endings
	return lines.length > 0 && lines.every((line) => /^\s*\d+\s+\|(?!\|)/.test(line));
}

/**
 * Strips line numbers from content while preserving the actual content.
 *
 * @param content The content to process
 * @param aggressive When false (default): Only strips lines with clear number patterns like "123 | content"
 *                   When true: Uses a more lenient pattern that also matches lines with just a pipe character,
 *                   which can be useful when LLMs don't perfectly format the line numbers in diffs
 * @returns The content with line numbers removed
 */
export function stripLineNumbers(content: string, aggressive: boolean = false): string {
	// Split into lines to handle each line individually
	const lines = content.split(/\r?\n/);

	// Process each line
	const processedLines = lines.map((line) => {
		// Match line number pattern and capture everything after the pipe
		const match = aggressive ? line.match(/^\s*(?:\d+\s)?\|\s(.*)$/) : line.match(/^\s*\d+\s+\|(?!\|)\s?(.*)$/);
		return match ? match[1] : line;
	});

	// Join back with original line endings
	const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";
	let result = processedLines.join(lineEnding);

	// Preserve trailing newline if present in original content
	if (content.endsWith(lineEnding)) {
		if (!result.endsWith(lineEnding)) {
			result += lineEnding;
		}
	}

	return result;
}

/**
 * Truncates multi-line output while preserving context from both the beginning and end.
 * When truncation is needed, it keeps 20% of the lines from the start and 80% from the end,
 * with a clear indicator of how many lines were omitted in between.
 *
 * IMPORTANT: Character limit takes precedence over line limit.
 *
 * @param content The multi-line string to truncate
 * @param lineLimit Optional maximum number of lines to keep
 * @param characterLimit Optional maximum number of characters to keep
 * @returns The truncated string with an indicator of omitted content
 */
export function truncateOutput(content: string, lineLimit?: number, characterLimit?: number): string {
	// If no limits are specified, return original content
	if (!lineLimit && !characterLimit) {
		return content;
	}

	// Character limit takes priority over line limit
	if (characterLimit && content.length > characterLimit) {
		const beforeLimit = Math.floor(characterLimit * 0.2); // 20% of characters before
		const afterLimit = characterLimit - beforeLimit; // remaining 80% after

		const startSection = content.slice(0, beforeLimit);
		const endSection = content.slice(-afterLimit);
		const omittedChars = content.length - characterLimit;

		return startSection + `\n[...${omittedChars} characters omitted...]\n` + endSection;
	}

	// If character limit is not exceeded or not specified, check line limit
	if (!lineLimit) {
		return content;
	}

	// Count total lines
	let totalLines = 0;
	let pos = -1;
	while ((pos = content.indexOf("\n", pos + 1)) !== -1) {
		totalLines++;
	}
	// Account for content that doesn't end with newline
	if (content.length > 0 && !content.endsWith("\n")) {
		totalLines++;
	}

	// If within line limit, return original
	if (totalLines <= lineLimit) {
		return content;
	}

	// Calculate how many lines to keep from start and end
	const beforeLines = Math.floor(lineLimit * 0.2); // 20% before
	const afterLines = lineLimit - beforeLines; // 80% after

	// Split content into lines
	const lines = content.split("\n");

	// Extract sections
	const startLines = lines.slice(0, beforeLines);
	const endLines = lines.slice(-afterLines);
	const omittedLines = totalLines - lineLimit;

	return startLines.join("\n") + `\n[...${omittedLines} lines omitted...]\n` + endLines.join("\n");
}
