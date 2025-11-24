/**
 * Diff statistics utilities from Roo Code
 * Provides sanitization and stats computation for unified diffs
 */

export interface DiffStats {
	added: number;
	removed: number;
}

/**
 * Remove non-semantic diff noise like "No newline at end of file"
 */
export function sanitizeUnifiedDiff(diff: string): string {
	if (!diff) {
		return diff;
	}
	return diff.replace(/\r\n/g, "\n").replace(/(^|\n)[ \t]*(?:\\ )?No newline at end of file[ \t]*(?=\n|$)/gi, "$1");
}

/**
 * Compute +/− counts from a unified diff (ignores headers/hunk lines)
 * This provides a simple way to show how many lines were added/removed
 */
export function computeUnifiedDiffStats(diff?: string): DiffStats | null {
	if (!diff) {
		return null;
	}

	try {
		let added = 0;
		let removed = 0;

		// Split into lines and count + and - prefixes
		const lines = diff.split('\n');
		for (const line of lines) {
			const firstChar = line[0];
			if (firstChar === '+' && !line.startsWith('+++')) {
				added++;
			} else if (firstChar === '-' && !line.startsWith('---')) {
				removed++;
			}
		}

		if (added > 0 || removed > 0) {
			return { added, removed };
		}
		return { added: 0, removed: 0 };
	} catch {
		// If parsing fails for any reason, signal no stats
		return null;
	}
}

/**
 * Compute diff stats from any supported diff format
 */
export function computeDiffStats(diff?: string): DiffStats | null {
	if (!diff) {
		return null;
	}
	return computeUnifiedDiffStats(diff);
}

/**
 * Build a unified diff for a brand new file (all content lines are additions).
 * This is a simplified version that marks all lines as additions.
 */
export function convertNewFileToUnifiedDiff(content: string, filePath?: string): string {
	const fileName = filePath || "file";
	const normalized = (content || "").replace(/\r\n/g, "\n");
	const lines = normalized.split('\n');

	let diff = `--- /dev/null\n+++ ${fileName}\n@@ -0,0 +1,${lines.length} @@\n`;
	for (const line of lines) {
		diff += `+${line}\n`;
	}

	return diff;
}
