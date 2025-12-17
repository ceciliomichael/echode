import * as path from 'path';

/**
 * Generate a unified diff string between two strings using a simple LCS implementation
 */
export function createUnifiedDiff(originalContent: string, newContent: string, filePath: string): string {
    const originalLines = originalContent.split(/\r?\n/);
    const newLines = newContent.split(/\r?\n/);
    const fileName = path.basename(filePath);

    const diff = computeDiff(originalLines, newLines);

    // Format as unified diff
    // We'll use a simplified version that just shows correct + and - lines
    // but skips the complex hunk headers @@ -x,y +a,b @@ for simplicity if acceptable,
    // or implements a basic hunk generator.

    // Let's implement basic hunk generation for correctness
    const hunks = generateHunks(diff);

    if (hunks.length === 0) {
        return '';
    }

    let output = `--- ${fileName}\n+++ ${fileName}\n`;

    for (const hunk of hunks) {
        output += `@@ -${hunk.originalStart + 1},${hunk.originalLength} +${hunk.newStart + 1},${hunk.newLength} @@\n`;
        output += hunk.lines.join('\n') + '\n';
    }

    return output.trim();
}

type DiffLine =
    | { type: 'equal'; content: string }
    | { type: 'add'; content: string }
    | { type: 'remove'; content: string };

function computeDiff(originalLines: string[], newLines: string[]): DiffLine[] {
    // Standard LCS algorithm
    const m = originalLines.length;
    const n = newLines.length;
    const C: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (originalLines[i - 1] === newLines[j - 1]) {
                C[i][j] = C[i - 1][j - 1] + 1;
            } else {
                C[i][j] = Math.max(C[i][j - 1], C[i - 1][j]);
            }
        }
    }

    const diff: DiffLine[] = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && originalLines[i - 1] === newLines[j - 1]) {
            diff.unshift({ type: 'equal', content: originalLines[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || C[i][j - 1] >= C[i - 1][j])) {
            diff.unshift({ type: 'add', content: newLines[j - 1] });
            j--;
        } else if (i > 0 && (j === 0 || C[i][j - 1] < C[i - 1][j])) {
            diff.unshift({ type: 'remove', content: originalLines[i - 1] });
            i--;
        }
    }

    return diff;
}

interface Hunk {
    originalStart: number;
    originalLength: number;
    newStart: number;
    newLength: number;
    lines: string[];
}

function generateHunks(diff: DiffLine[], contextLines = 3): Hunk[] {
    const hunks: Hunk[] = [];
    let currentHunk: Hunk | null = null;
    let originalIdx = 0;
    let newIdx = 0;

    for (let i = 0; i < diff.length; i++) {
        const line = diff[i];
        const isChange = line.type !== 'equal';

        if (isChange) {
            // Start a new hunk if needed
            if (!currentHunk) {
                const startIdx = Math.max(0, i - contextLines);
                currentHunk = {
                    originalStart: originalIdx, // Approximate, will refine
                    originalLength: 0,
                    newStart: newIdx,       // Approximate, will refine
                    newLength: 0,
                    lines: []
                };

                // Backfill context
                for (let k = startIdx; k < i; k++) {
                    const ctxLine = diff[k];
                    if (ctxLine.type === 'equal') { // Should always be equal in this simple backfill
                        currentHunk.lines.push(' ' + ctxLine.content);
                        currentHunk.originalLength++;
                        currentHunk.newLength++;
                    }
                }

                // Adjust start indices based on context
                currentHunk.originalStart = originalIdx - currentHunk.originalLength;
                currentHunk.newStart = newIdx - currentHunk.newLength;
            }

            // Add current change
            if (line.type === 'add') {
                currentHunk.lines.push('+' + line.content);
                currentHunk.newLength++;
                newIdx++;
            } else if (line.type === 'remove') {
                currentHunk.lines.push('-' + line.content);
                currentHunk.originalLength++;
                originalIdx++;
            }
        } else {
            // Equal line
            if (currentHunk) {
                // Check if we should end the hunk
                // Look ahead to see if there are changes soon
                let hasChangesSoon = false;
                for (let k = 1; k <= contextLines * 2; k++) {
                    if (i + k < diff.length && diff[i + k].type !== 'equal') {
                        hasChangesSoon = true;
                        break;
                    }
                }

                if (hasChangesSoon || currentHunk.lines.length === 0) { // Keep adding context if changes are close
                    // Don't add too much context though
                    // Count consecutive context lines at end of hunk
                    let trailingContext = 0;
                    for (let k = currentHunk.lines.length - 1; k >= 0; k--) {
                        if (currentHunk.lines[k].startsWith(' ')) { trailingContext++; }
                        else { break; }
                    }

                    if (trailingContext < contextLines) {
                        currentHunk.lines.push(' ' + line.content);
                        currentHunk.originalLength++;
                        currentHunk.newLength++;
                    } else {
                        // Close hunk
                        hunks.push(currentHunk);
                        currentHunk = null;
                    }
                } else {
                    // Close hunk with up to contextLines of trailing context
                    // (The loop above handles adding context, if we are here it means we have enough context or EOF)
                    // Actually, we need to add this line as potentially semantic context
                    // But if we are far from next change, we stop.

                    // Helper: peek ahead
                    let distToNextChange = -1;
                    for (let k = 1; k < diff.length - i; k++) {
                        if (diff[i + k].type !== 'equal') {
                            distToNextChange = k;
                            break;
                        }
                    }

                    if (distToNextChange !== -1 && distToNextChange <= contextLines * 2) {
                        // Changes essentially contiguous usually merge within 2*context
                        currentHunk.lines.push(' ' + line.content);
                        currentHunk.originalLength++;
                        currentHunk.newLength++;
                    } else {
                        // End of hunk - include this line as final context if needed
                        // Check how much context we already have
                        let trailingContext = 0;
                        for (let k = currentHunk.lines.length - 1; k >= 0; k--) {
                            if (currentHunk.lines[k].startsWith(' ')) { trailingContext++; }
                            else { break; }
                        }

                        if (trailingContext < contextLines) {
                            currentHunk.lines.push(' ' + line.content);
                            currentHunk.originalLength++;
                            currentHunk.newLength++;
                        } else {
                            hunks.push(currentHunk);
                            currentHunk = null;
                        }
                    }
                }
            }
            // Advance counters for equal line
            originalIdx++;
            newIdx++;
        }
    }

    if (currentHunk) {
        hunks.push(currentHunk);
    }

    return hunks;
}
