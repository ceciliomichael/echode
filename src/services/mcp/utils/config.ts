/**
 * MCP Configuration Utilities
 * 
 * Utilities for injecting environment variables and magic variables
 * into MCP server configurations.
 * 
 * Ported from Roo-Code for compatibility.
 */

/**
 * Injectable configuration type definition.
 * Supports nested objects and arrays.
 */
export type InjectableConfigType =
  | string
  | {
      [key: string]:
        | undefined
        | null
        | boolean
        | number
        | InjectableConfigType
        | Array<undefined | null | boolean | number | InjectableConfigType>;
    };

/**
 * Deeply injects environment variables into a configuration object/string/json.
 * 
 * Uses VSCode env:name pattern: https://code.visualstudio.com/docs/reference/variables-reference#_environment-variables
 * 
 * Does not mutate the original object.
 * 
 * @param config - Configuration to process
 * @param notFoundValue - Value to use when a variable is not found (default: empty string)
 * @returns Configuration with variables injected
 */
export async function injectEnv<C extends InjectableConfigType>(
  config: C,
  notFoundValue: string = ''
): Promise<C extends string ? string : C> {
  return injectVariables(config, { env: process.env }, notFoundValue);
}

/**
 * Deeply injects variables into a configuration object/string/json.
 * 
 * Uses VSCode's variables reference pattern:
 * https://code.visualstudio.com/docs/reference/variables-reference#_environment-variables
 * 
 * Does not mutate the original object.
 * 
 * There is special handling for nested (record-type) variables, where it is replaced
 * by `propNotFoundValue` (if available) if the root key exists but the nested key does not.
 * 
 * Matched keys that have `null` | `undefined` values are treated as not found.
 * 
 * @param config - Configuration to process
 * @param variables - Variables to inject (can be flat strings or nested records)
 * @param propNotFoundValue - Value to use when a nested property is not found
 * @returns Configuration with variables injected
 */
export async function injectVariables<C extends InjectableConfigType>(
  config: C,
  variables: Record<string, undefined | null | string | Record<string, undefined | null | string>>,
  propNotFoundValue?: string
): Promise<C extends string ? string : C> {
  const isObject = typeof config === 'object';
  let configString: string = isObject ? JSON.stringify(config) : (config as string);

  for (const [key, value] of Object.entries(variables)) {
    if (value == null) continue;

    if (typeof value === 'string') {
      // Normalize paths to forward slashes for cross-platform compatibility
      configString = configString.replace(
        new RegExp(`\\$\\{${key}\\}`, 'g'),
        value.toPosix()
      );
    } else {
      // Handle nested variables (e.g., ${env:VAR_NAME})
      configString = configString.replace(
        new RegExp(`\\$\\{${key}:([\\w]+)\\}`, 'g'),
        (match, name) => {
          const nestedValue = value[name];

          if (nestedValue == null) {
            console.warn(`[injectVariables] variable "${name}" referenced but not found in "${key}"`);
            return propNotFoundValue ?? match;
          }

          // Normalize paths for string values
          return typeof nestedValue === 'string' ? nestedValue.toPosix() : nestedValue;
        }
      );
    }
  }

  return (isObject ? JSON.parse(configString) : configString) as C extends string ? string : C;
}

/**
 * Prepares variables object for config injection.
 * Includes environment variables and workspace folder.
 * 
 * @param workspacePath - Optional workspace folder path
 * @returns Variables object ready for injection
 */
export function prepareVariables(workspacePath?: string): Record<string, string | Record<string, string | undefined>> {
  return {
    env: process.env as Record<string, string | undefined>,
    workspaceFolder: workspacePath ?? '',
  };
}