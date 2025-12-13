/**
 * Parameter parsing utilities for XML tool calls
 * Single Responsibility: Parse parameter values from XML content
 */

import { unescapeXml } from './xml-utils';
import { findMatchingParameterClose } from './tag-matcher';

/** Parameters that should preserve exact whitespace (for code content) */
const WHITESPACE_PRESERVED_PARAMS = [
  'old_string',
  'new_string',
  'content',
  'edits',
  'diff',
  'blocks',
];

/**
 * Parse XML-style parameters from invoke block content
 * Format: <parameter name="paramName">value</parameter>
 * Supports both simple values and JSON values inside parameter tags
 * Uses balanced tag matching to handle nested parameter tags in content
 */
export function parseXMLParameters(content: string): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  const processedParams = new Set<string>();

  const openingParamRegex = /<parameter\s+name\s*=\s*["']([^"']+)["']\s*>/g;
  let match: RegExpExecArray | null;

  while ((match = openingParamRegex.exec(content)) !== null) {
    const paramName = match[1];
    const openTagEnd = match.index + match[0].length;

    if (processedParams.has(paramName)) {
      continue;
    }

    const closePos = findMatchingParameterClose(content, openTagEnd);

    if (closePos !== -1) {
      const paramValue = content.slice(openTagEnd, closePos);
      const shouldPreserveWhitespace = WHITESPACE_PRESERVED_PARAMS.includes(paramName);

      // Strip only leading/trailing newlines, preserve internal whitespace
      const finalValue = shouldPreserveWhitespace
        ? paramValue.replace(/^\n/, '').replace(/\n$/, '')
        : paramValue.trim();

      const unescapedValue = unescapeXml(finalValue);
      parameters[paramName] = parseParamValue(unescapedValue, shouldPreserveWhitespace);
      processedParams.add(paramName);
    } else {
      // No closing tag - streaming parameter (partial content)
      const partialContent = content.slice(openTagEnd);
      parameters[paramName] = unescapeXml(partialContent);
      processedParams.add(paramName);
    }
  }

  return parameters;
}

/**
 * Parse parameter value with type coercion
 * @param value - The string value to parse
 * @param isRawString - If true, return value as-is without any parsing (for code content)
 */
export function parseParamValue(value: string, isRawString = false): unknown {
  if (isRawString) {
    return value;
  }

  const trimmedValue = value.trim();

  // Try to parse as JSON (for arrays, objects)
  if (trimmedValue.startsWith('[') || trimmedValue.startsWith('{')) {
    try {
      return JSON.parse(trimmedValue);
    } catch {
      if (trimmedValue.startsWith('[')) {
        const completeObjects = extractCompleteJsonObjects(trimmedValue);
        if (completeObjects.length > 0) {
          return completeObjects;
        }
      }
    }
  }

  // Handle newline-separated JSON objects
  if (trimmedValue.includes('\n') && trimmedValue.includes('{')) {
    try {
      const lines = trimmedValue.split('\n').filter((line) => line.trim());
      const objects = lines
        .map((line) => {
          try {
            return JSON.parse(line.trim());
          } catch {
            return null;
          }
        })
        .filter((obj) => obj !== null);

      if (objects.length > 1) {
        return objects;
      }
      if (objects.length === 1 && lines.length === 1) {
        return objects[0];
      }
    } catch {
      // Fall through
    }
  }

  // Handle boolean values
  if (trimmedValue === 'true') return true;
  if (trimmedValue === 'false') return false;

  // Handle numeric values
  if (trimmedValue && !isNaN(Number(trimmedValue))) {
    return Number(trimmedValue);
  }

  return value;
}

/**
 * Extract complete JSON objects from a partial array string
 * Used for streaming arrays like edits: [{...}, {...}]
 */
export function extractCompleteJsonObjects(partialArray: string): unknown[] {
  const objects: unknown[] = [];
  const content = partialArray.slice(1).trim();

  let depth = 0;
  let objStart = -1;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (char === '}') {
      depth--;

      if (depth === 0 && objStart !== -1) {
        const objStr = content.slice(objStart, i + 1);
        try {
          const obj = JSON.parse(objStr);
          objects.push(obj);
        } catch {
          // Skip malformed object
        }
        objStart = -1;
      }
    }
  }

  return objects;
}
