/**
 * MCP Configuration Validation Schemas
 * 
 * Zod schemas for validating MCP server configurations.
 * Matches Roo-Code's implementation for robust config validation.
 */

import * as vscode from 'vscode';
import { z } from 'zod';

// Error messages for better user feedback
export const ValidationErrors = {
  TYPE_ERROR: "Server type must be 'stdio', 'sse', or 'streamable-http'",
  STDIO_FIELDS_ERROR: "For 'stdio' type servers, you must provide a 'command' field and can optionally include 'args' and 'env'",
  SSE_FIELDS_ERROR: "For 'sse' type servers, you must provide a 'url' field and can optionally include 'headers'",
  STREAMABLE_HTTP_FIELDS_ERROR: "For 'streamable-http' type servers, you must provide a 'url' field and can optionally include 'headers'",
  MIXED_FIELDS_ERROR: "Cannot mix 'stdio' and ('sse' or 'streamable-http') fields. For 'stdio' use 'command', 'args', and 'env'. For 'sse'/'streamable-http' use 'url' and 'headers'",
  MISSING_FIELDS_ERROR: "Server configuration must include either 'command' (for stdio) or 'url' (for sse/streamable-http) and a corresponding 'type' if 'url' is used.",
  URL_TYPE_REQUIRED: "Configuration with 'url' must explicitly specify 'type' as 'sse' or 'streamable-http'.",
} as const;

// Base configuration schema for common settings shared by all server types
const BaseConfigSchema = z.object({
  disabled: z.boolean().optional(),
  timeout: z.number().min(1).max(3600).optional().default(60),
  alwaysAllow: z.array(z.string()).default([]),
  watchPaths: z.array(z.string()).optional(),
  disabledTools: z.array(z.string()).default([]),
});

// Helper to get default cwd
const getDefaultCwd = (): string => {
  return vscode.workspace.workspaceFolders?.at(0)?.uri.fsPath ?? process.cwd();
};

// Stdio server configuration schema
const StdioConfigSchema = BaseConfigSchema.extend({
  type: z.enum(['stdio']).optional(),
  command: z.string().min(1, 'Command cannot be empty'),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional().default(getDefaultCwd),
  env: z.record(z.string()).optional(),
  // Ensure no SSE/HTTP fields are present
  url: z.undefined().optional(),
  headers: z.undefined().optional(),
}).transform((data) => ({
  ...data,
  type: 'stdio' as const,
}));

// SSE server configuration schema
const SseConfigSchema = BaseConfigSchema.extend({
  type: z.enum(['sse']).optional(),
  url: z.string().url('URL must be a valid URL format'),
  headers: z.record(z.string()).optional(),
  // Ensure no stdio fields are present
  command: z.undefined().optional(),
  args: z.undefined().optional(),
  env: z.undefined().optional(),
}).transform((data) => ({
  ...data,
  type: 'sse' as const,
}));

// Streamable HTTP server configuration schema
const StreamableHttpConfigSchema = BaseConfigSchema.extend({
  type: z.enum(['streamable-http']).optional(),
  url: z.string().url('URL must be a valid URL format'),
  headers: z.record(z.string()).optional(),
  // Ensure no stdio fields are present
  command: z.undefined().optional(),
  args: z.undefined().optional(),
  env: z.undefined().optional(),
}).transform((data) => ({
  ...data,
  type: 'streamable-http' as const,
}));

/**
 * Union schema for all server configuration types.
 * Automatically infers the server type based on provided fields.
 */
export const ServerConfigSchema = z.union([
  StdioConfigSchema,
  SseConfigSchema,
  StreamableHttpConfigSchema,
]);

/**
 * Schema for the entire MCP settings file structure.
 */
export const McpSettingsSchema = z.object({
  mcpServers: z.record(ServerConfigSchema),
});

// Type exports
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type StdioServerConfig = z.infer<typeof StdioConfigSchema>;
export type SseServerConfig = z.infer<typeof SseConfigSchema>;
export type StreamableHttpServerConfig = z.infer<typeof StreamableHttpConfigSchema>;
export type McpSettings = z.infer<typeof McpSettingsSchema>;

/**
 * Validates and normalizes server configuration with pre-validation checks.
 * Provides detailed error messages for common configuration mistakes.
 * 
 * @param config - Raw configuration object to validate
 * @param serverName - Optional server name for error messages
 * @returns Validated and normalized configuration
 * @throws Error with detailed message if validation fails
 */
export function validateServerConfig(
  config: unknown,
  serverName?: string
): ServerConfig {
  if (!config || typeof config !== 'object') {
    throw new Error(
      serverName
        ? `Invalid configuration for server "${serverName}": Configuration must be an object`
        : 'Invalid server configuration: Configuration must be an object'
    );
  }

  const rawConfig = config as Record<string, unknown>;

  // Detect configuration issues before validation
  const hasStdioFields = rawConfig.command !== undefined;
  const hasUrlFields = rawConfig.url !== undefined;

  // Check for mixed fields (stdio vs url-based)
  if (hasStdioFields && hasUrlFields) {
    throw new Error(ValidationErrors.MIXED_FIELDS_ERROR);
  }

  // Infer type for stdio if not provided
  if (!rawConfig.type && hasStdioFields) {
    rawConfig.type = 'stdio';
  }

  // For url-based configs, type must be provided by the user
  if (hasUrlFields && !rawConfig.type) {
    throw new Error(ValidationErrors.URL_TYPE_REQUIRED);
  }

  // Validate type if provided
  if (rawConfig.type && !['stdio', 'sse', 'streamable-http'].includes(rawConfig.type as string)) {
    throw new Error(ValidationErrors.TYPE_ERROR);
  }

  // Check for type/field mismatch
  if (rawConfig.type === 'stdio' && !hasStdioFields) {
    throw new Error(ValidationErrors.STDIO_FIELDS_ERROR);
  }
  if (rawConfig.type === 'sse' && !hasUrlFields) {
    throw new Error(ValidationErrors.SSE_FIELDS_ERROR);
  }
  if (rawConfig.type === 'streamable-http' && !hasUrlFields) {
    throw new Error(ValidationErrors.STREAMABLE_HTTP_FIELDS_ERROR);
  }

  // If neither command nor url is present
  if (!hasStdioFields && !hasUrlFields) {
    throw new Error(ValidationErrors.MISSING_FIELDS_ERROR);
  }

  // Validate the config against the schema
  try {
    return ServerConfigSchema.parse(rawConfig);
  } catch (validationError) {
    if (validationError instanceof z.ZodError) {
      const errorMessages = validationError.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      throw new Error(
        serverName
          ? `Invalid configuration for server "${serverName}": ${errorMessages}`
          : `Invalid server configuration: ${errorMessages}`
      );
    }
    throw validationError;
  }
}

/**
 * Safely parses MCP settings with error handling.
 * Returns a result object instead of throwing.
 * 
 * @param content - JSON string content to parse
 * @returns Object with success status and data or error
 */
export function parseMcpSettings(content: string): {
  success: boolean;
  data?: McpSettings;
  error?: string;
} {
  try {
    const parsed = JSON.parse(content);
    const result = McpSettingsSchema.safeParse(parsed);
    
    if (result.success) {
      return { success: true, data: result.data };
    }
    
    const errorMessages = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    
    return { success: false, error: errorMessages };
  } catch (parseError) {
    return { 
      success: false, 
      error: parseError instanceof Error ? parseError.message : 'Invalid JSON syntax' 
    };
  }
}