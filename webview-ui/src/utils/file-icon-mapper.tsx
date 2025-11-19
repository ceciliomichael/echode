import type { IconType } from 'react-icons';
import {
  SiTypescript,
  SiJavascript,
  SiHtml5,
  SiCss3,
  SiPython,
  SiCplusplus,
  SiC,
  SiSharp,
  SiGo,
  SiRust,
  SiRuby,
  SiPhp,
  SiSwift,
  SiR,
  SiJson,
  SiMarkdown,
  SiVuedotjs,
  SiSvelte,
  SiDart,
  SiScala,
  SiClojure,
  SiElixir,
  SiErlang,
  SiLua,
  SiGraphql,
  SiDocker,
  SiKotlin,
  SiSass,
  SiYaml,
} from 'react-icons/si';
import { 
  VscFile,
  VscFileMedia,
  VscJson,
  VscMarkdown,
  VscCode,
} from 'react-icons/vsc';
import { BsFileText } from 'react-icons/bs';

/**
 * File icon configuration with language-specific colors
 */
interface FileIconConfig {
  icon: IconType;
  color: string;
  label: string;
}

/**
 * Language-specific icon mappings with distinctive colors
 */
const LANGUAGE_ICONS: Record<string, FileIconConfig> = {
  // TypeScript/JavaScript
  ts: { icon: SiTypescript, color: '#3178c6', label: 'TypeScript' },
  tsx: { icon: SiTypescript, color: '#3178c6', label: 'TypeScript React' },
  js: { icon: SiJavascript, color: '#f7df1e', label: 'JavaScript' },
  jsx: { icon: SiJavascript, color: '#61dafb', label: 'React' },
  mjs: { icon: SiJavascript, color: '#f7df1e', label: 'JavaScript Module' },
  cjs: { icon: SiJavascript, color: '#f7df1e', label: 'JavaScript CommonJS' },

  // Web
  html: { icon: SiHtml5, color: '#e34c26', label: 'HTML' },
  htm: { icon: SiHtml5, color: '#e34c26', label: 'HTML' },
  css: { icon: SiCss3, color: '#264de4', label: 'CSS' },
  scss: { icon: SiSass, color: '#cc6699', label: 'SCSS' },
  sass: { icon: SiSass, color: '#cc6699', label: 'Sass' },
  less: { icon: VscCode, color: '#1d365d', label: 'Less' },

  // Python
  py: { icon: SiPython, color: '#3776ab', label: 'Python' },
  pyw: { icon: SiPython, color: '#3776ab', label: 'Python' },
  pyi: { icon: SiPython, color: '#3776ab', label: 'Python Interface' },

  // Java/Kotlin
  java: { icon: VscCode, color: '#007396', label: 'Java' },
  kt: { icon: SiKotlin, color: '#7f52ff', label: 'Kotlin' },
  kts: { icon: SiKotlin, color: '#7f52ff', label: 'Kotlin Script' },

  // C/C++
  c: { icon: SiC, color: '#555555', label: 'C' },
  cpp: { icon: SiCplusplus, color: '#00599c', label: 'C++' },
  cc: { icon: SiCplusplus, color: '#00599c', label: 'C++' },
  cxx: { icon: SiCplusplus, color: '#00599c', label: 'C++' },
  h: { icon: SiC, color: '#555555', label: 'Header' },
  hpp: { icon: SiCplusplus, color: '#00599c', label: 'C++ Header' },

  // C#
  cs: { icon: SiSharp, color: '#239120', label: 'C#' },
  csx: { icon: SiSharp, color: '#239120', label: 'C# Script' },

  // Go
  go: { icon: SiGo, color: '#00add8', label: 'Go' },

  // Rust
  rs: { icon: SiRust, color: '#dea584', label: 'Rust' },

  // Ruby
  rb: { icon: SiRuby, color: '#cc342d', label: 'Ruby' },
  erb: { icon: SiRuby, color: '#cc342d', label: 'Ruby ERB' },

  // PHP
  php: { icon: SiPhp, color: '#777bb4', label: 'PHP' },

  // Swift
  swift: { icon: SiSwift, color: '#fa7343', label: 'Swift' },

  // R
  r: { icon: SiR, color: '#276dc3', label: 'R' },

  // Shell
  sh: { icon: VscCode, color: '#89e051', label: 'Shell' },
  bash: { icon: VscCode, color: '#89e051', label: 'Bash' },
  zsh: { icon: VscCode, color: '#89e051', label: 'Zsh' },
  fish: { icon: VscCode, color: '#89e051', label: 'Fish' },

  // Config/Data
  json: { icon: SiJson, color: '#f7df1e', label: 'JSON' },
  jsonc: { icon: VscJson, color: '#f7df1e', label: 'JSON with Comments' },
  yaml: { icon: SiYaml, color: '#cb171e', label: 'YAML' },
  yml: { icon: SiYaml, color: '#cb171e', label: 'YAML' },
  toml: { icon: VscFile, color: '#9c4221', label: 'TOML' },
  xml: { icon: VscCode, color: '#e34c26', label: 'XML' },
  ini: { icon: VscFile, color: '#6d6d6d', label: 'INI' },
  env: { icon: VscFile, color: '#ecd53f', label: 'Environment' },

  // Markdown/Docs
  md: { icon: SiMarkdown, color: '#083fa1', label: 'Markdown' },
  mdx: { icon: VscMarkdown, color: '#083fa1', label: 'MDX' },
  txt: { icon: BsFileText, color: '#6d6d6d', label: 'Text' },
  rst: { icon: VscFile, color: '#6d6d6d', label: 'reStructuredText' },

  // Images
  png: { icon: VscFileMedia, color: '#a074c4', label: 'PNG Image' },
  jpg: { icon: VscFileMedia, color: '#a074c4', label: 'JPEG Image' },
  jpeg: { icon: VscFileMedia, color: '#a074c4', label: 'JPEG Image' },
  gif: { icon: VscFileMedia, color: '#a074c4', label: 'GIF Image' },
  svg: { icon: VscFileMedia, color: '#ffb13b', label: 'SVG Image' },
  webp: { icon: VscFileMedia, color: '#a074c4', label: 'WebP Image' },
  ico: { icon: VscFileMedia, color: '#a074c4', label: 'Icon' },

  // Other languages
  vue: { icon: SiVuedotjs, color: '#42b883', label: 'Vue' },
  svelte: { icon: SiSvelte, color: '#ff3e00', label: 'Svelte' },
  dart: { icon: SiDart, color: '#0175c2', label: 'Dart' },
  scala: { icon: SiScala, color: '#dc322f', label: 'Scala' },
  clj: { icon: SiClojure, color: '#5881d8', label: 'Clojure' },
  ex: { icon: SiElixir, color: '#4e2a8e', label: 'Elixir' },
  exs: { icon: SiElixir, color: '#4e2a8e', label: 'Elixir Script' },
  erl: { icon: SiErlang, color: '#b83998', label: 'Erlang' },
  lua: { icon: SiLua, color: '#000080', label: 'Lua' },
  sql: { icon: VscCode, color: '#e38c00', label: 'SQL' },
  graphql: { icon: SiGraphql, color: '#e10098', label: 'GraphQL' },
  gql: { icon: SiGraphql, color: '#e10098', label: 'GraphQL' },

  // Build/Config files
  dockerfile: { icon: SiDocker, color: '#2496ed', label: 'Dockerfile' },
  makefile: { icon: VscCode, color: '#6d6d6d', label: 'Makefile' },
  gradle: { icon: VscCode, color: '#02303a', label: 'Gradle' },
};

/**
 * Get file icon configuration based on file path or extension
 */
export function getFileIconConfig(filePath: string): FileIconConfig {
  if (!filePath) {
    return { icon: VscFile, color: 'var(--vscode-foreground)', label: 'File' };
  }

  // Extract filename and extension
  const fileName = filePath.split('/').pop()?.split('\\').pop() || '';
  const extension = fileName.includes('.') 
    ? fileName.split('.').pop()?.toLowerCase() || ''
    : '';

  // Special case for files without extension but specific names
  const lowerFileName = fileName.toLowerCase();
  if (lowerFileName === 'dockerfile' || lowerFileName.startsWith('dockerfile.')) {
    return LANGUAGE_ICONS.dockerfile;
  }
  if (lowerFileName === 'makefile' || lowerFileName.startsWith('makefile.')) {
    return LANGUAGE_ICONS.makefile;
  }

  // Look up by extension
  if (extension && LANGUAGE_ICONS[extension]) {
    return LANGUAGE_ICONS[extension];
  }

  // Default fallback
  return { icon: VscFile, color: 'var(--vscode-foreground)', label: 'File' };
}

/**
 * Map language IDs to extensions
 */
const LANGUAGE_ID_TO_EXTENSION: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  javascriptreact: 'jsx',
  typescriptreact: 'tsx',
  python: 'py',
  rust: 'rs',
  ruby: 'rb',
  markdown: 'md',
  jsonc: 'json',
  shell: 'sh',
  bash: 'sh',
  sh: 'sh',
  zsh: 'sh',
  csharp: 'cs',
  dockerfile: 'dockerfile',
};

/**
 * Get file icon configuration based on language ID
 */
export function getLanguageIcon(languageId: string): FileIconConfig {
  const normalizedId = languageId.toLowerCase();
  
  // Direct lookup in LANGUAGE_ICONS (if languageId matches extension, e.g. 'css', 'html', 'go')
  if (LANGUAGE_ICONS[normalizedId]) {
    return LANGUAGE_ICONS[normalizedId];
  }
  
  // Map via extension
  const extension = LANGUAGE_ID_TO_EXTENSION[normalizedId];
  if (extension && LANGUAGE_ICONS[extension]) {
    return LANGUAGE_ICONS[extension];
  }
  
  // Fallback
  return { icon: VscCode, color: 'var(--vscode-foreground)', label: languageId };
}

/**
 * Extract filename from path
 */
export function extractFileName(filePath: string): string {
  if (!filePath) return 'Unknown';
  return filePath.split('/').pop()?.split('\\').pop() || filePath;
}
