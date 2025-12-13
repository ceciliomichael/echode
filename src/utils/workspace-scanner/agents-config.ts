import * as fs from 'fs';
import * as path from 'path';

/**
 * Read AGENTS.md file from workspace root if it exists
 */
export function getAgentsConfig(workspacePath: string): string | null {
  try {
    const agentsPath = path.join(workspacePath, 'AGENTS.md');
    if (fs.existsSync(agentsPath)) {
      return fs.readFileSync(agentsPath, 'utf8');
    }
  } catch (_error) {
    // File doesn't exist or can't be read
  }
  return null;
}