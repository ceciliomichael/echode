/**
 * Apply-diff module exports
 */

// Types
export type { DiffResult, DiffStrategy, NormalizeOptions, ValidationResult, FuzzySearchResult } from './types';

// Strategy
export { MultiSearchReplaceDiffStrategy } from './diff-strategy';

// Utilities (exported for testing and advanced usage)
export { validateMarkerSequencing } from './diff-validator';
export { addLineNumbers, everyLineHasLineNumbers, stripLineNumbers } from './line-number-utils';
export { getSimilarity, fuzzySearch, BUFFER_LINES } from './fuzzy-search';
export { normalizeString, NORMALIZATION_MAPS, DEFAULT_OPTIONS } from './string-normalization';