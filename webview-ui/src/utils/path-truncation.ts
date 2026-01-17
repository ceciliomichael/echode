/**
 * Truncates a file path in the middle to fit within a reasonable display length.
 * 
 * Examples:
 * - "src/components/ui/button.tsx" -> "src/.../button.tsx" (if too long)
 * - "src/app.ts" -> "src/app.ts" (short enough, no truncation)
 * - "very/deep/nested/folder/structure/file.ts" -> "very/.../file.ts"
 */
export function truncatePathMiddle(path: string, maxLength: number = 40): string {
  if (!path || path.length <= maxLength) {
    return path;
  }

  const parts = path.split('/');
  
  // If only filename or very short path, return as-is
  if (parts.length <= 2) {
    return path;
  }

  const fileName = parts[parts.length - 1];
  const firstDir = parts[0];
  
  // Minimum format: "first/.../filename"
  const minFormat = `${firstDir}/.../${fileName}`;
  
  // If even minimum format is too long, just use it anyway (better than nothing)
  if (minFormat.length >= maxLength) {
    return minFormat;
  }

  // Try to include more path segments from the start
  let result = minFormat;
  let includedFromStart = 1;
  
  for (let i = 1; i < parts.length - 1; i++) {
    const potentialPath = [...parts.slice(0, i + 1), '...', fileName].join('/');
    if (potentialPath.length <= maxLength) {
      result = potentialPath;
      includedFromStart = i + 1;
    } else {
      break;
    }
  }

  // If we included all but the last directory, no need for ellipsis
  if (includedFromStart === parts.length - 1) {
    return path;
  }

  return result;
}

/**
 * Extracts the directory path from a full file path (excludes filename).
 * Returns empty string if path has no directory.
 */
export function getDirectoryPath(path: string): string {
  if (!path) return '';
  
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return '';
  
  return path.substring(0, lastSlash);
}