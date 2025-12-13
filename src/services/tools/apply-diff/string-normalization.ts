/**
 * String normalization utilities for diff matching
 */

import { NormalizeOptions } from './types';

/**
 * Maps for normalizing special characters to their standard equivalents
 */
export const NORMALIZATION_MAPS = {
    SMART_QUOTES: {
        "\u201C": '"', // Left double quote (U+201C)
        "\u201D": '"', // Right double quote (U+201D)
        "\u2018": "'", // Left single quote (U+2018)
        "\u2019": "'", // Right single quote (U+2019)
    },
    TYPOGRAPHIC: {
        "\u2026": "...", // Ellipsis
        "\u2014": "-", // Em dash
        "\u2013": "-", // En dash
        "\u00A0": " ", // Non-breaking space
    },
} as const;

/**
 * Default normalization options
 */
export const DEFAULT_OPTIONS: NormalizeOptions = {
    smartQuotes: true,
    typographicChars: true,
    extraWhitespace: true,
    trim: true,
};

/**
 * Normalize a string by replacing special characters with standard equivalents
 * @param str - The string to normalize
 * @param options - Normalization options
 * @returns Normalized string
 */
export function normalizeString(str: string, options: NormalizeOptions = DEFAULT_OPTIONS): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let normalized = str;

    if (opts.smartQuotes) {
        for (const [smart, regular] of Object.entries(NORMALIZATION_MAPS.SMART_QUOTES)) {
            normalized = normalized.replace(new RegExp(smart, "g"), regular);
        }
    }

    if (opts.typographicChars) {
        for (const [typographic, regular] of Object.entries(NORMALIZATION_MAPS.TYPOGRAPHIC)) {
            normalized = normalized.replace(new RegExp(typographic, "g"), regular);
        }
    }

    if (opts.extraWhitespace) {
        normalized = normalized.replace(/\s+/g, " ");
    }

    if (opts.trim) {
        normalized = normalized.trim();
    }

    return normalized;
}