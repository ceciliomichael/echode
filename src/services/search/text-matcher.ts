import { distance } from 'fastest-levenshtein';

export type SemanticMatchMode = 'tokens' | 'fuzzyTokens' | 'semanticLite';

export interface SemanticMatchOptions {
  minTokenCoverage: number;
  fuzzyThreshold: number;
  allowFuzzy: boolean;
  requireAllTokens: boolean;
  weightCoverage: number;
  weightFuzzy: number;
  weightOrder: number;
  weightProximity: number;
  exactBonus: number;
  maxCandidateWords?: number;
}

export interface SemanticMatchScore {
  score: number;
  matchedTokens: number;
  totalTokens: number;
}

interface TokenPosition {
  value: string;
  start: number;
}

function normalizeText(value: string): string {
  return value.toLowerCase();
}

function splitQueryTokens(query: string): string[] {
  const normalized = normalizeText(query);
  const rawTokens = normalized.split(/[^a-z0-9]+/i);
  const tokens: string[] = [];

  for (const token of rawTokens) {
    if (token.length > 0) {
      tokens.push(token);
    }
  }

  return tokens;
}

function tokenizeWithPositions(text: string, maxWords: number): TokenPosition[] {
  const tokens: TokenPosition[] = [];
  let current = '';
  let currentStart = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const isLetter = (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z');
    const isDigit = character >= '0' && character <= '9';
    const isSeparator = !isLetter && !isDigit;

    if (isSeparator) {
      if (current.length > 0) {
        tokens.push({ value: current, start: currentStart });
        if (tokens.length >= maxWords) {
          return tokens;
        }
        current = '';
      }
    } else {
      if (current.length === 0) {
        currentStart = index;
      }
      current += character;
    }
  }

  if (current.length > 0 && tokens.length < maxWords) {
    tokens.push({ value: current, start: currentStart });
  }

  return tokens;
}

function similarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) {
    return 0;
  }

  const editDistance = distance(left, right);
  const ratio = 1 - editDistance / maxLength;

  if (ratio < 0) {
    return 0;
  }

  if (ratio > 1) {
    return 1;
  }

  return ratio;
}

export function scoreTextMatch(query: string, candidate: string, options: SemanticMatchOptions): SemanticMatchScore | null {
  const tokens = splitQueryTokens(query);
  if (tokens.length === 0) {
    return null;
  }

  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedCandidate) {
    return null;
  }

  const maxCandidateWords = options.maxCandidateWords ?? 64;
  const words = tokenizeWithPositions(normalizedCandidate, maxCandidateWords);

  const matches: { index: number; position: number; similarity: number }[] = [];

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    let bestSimilarity = 0;
    let bestPosition = -1;

    const exactIndex = normalizedCandidate.indexOf(token);
    if (exactIndex !== -1) {
      bestSimilarity = 1;
      bestPosition = exactIndex;
    } else if (options.allowFuzzy) {
      for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
        const word = words[wordIndex];
        const wordSimilarity = similarity(token, word.value);

        if (wordSimilarity > bestSimilarity) {
          bestSimilarity = wordSimilarity;
          bestPosition = word.start;
        }
      }
    }

    const requiredThreshold = options.allowFuzzy ? options.fuzzyThreshold : 1;

    if (bestSimilarity >= requiredThreshold && bestPosition >= 0) {
      matches.push({ index: tokenIndex, position: bestPosition, similarity: bestSimilarity });
    }
  }

  const matchedTokens = matches.length;
  const totalTokens = tokens.length;

  if (matchedTokens === 0) {
    return null;
  }

  const coverage = matchedTokens / totalTokens;

  if (options.requireAllTokens && matchedTokens < totalTokens) {
    return null;
  }

  if (coverage < options.minTokenCoverage) {
    return null;
  }

  let fuzzyQuality = 0;
  for (const match of matches) {
    fuzzyQuality += match.similarity;
  }
  fuzzyQuality /= matchedTokens;

  let minPosition = Number.POSITIVE_INFINITY;
  let maxPosition = -1;

  for (const match of matches) {
    if (match.position < minPosition) {
      minPosition = match.position;
    }
    if (match.position > maxPosition) {
      maxPosition = match.position;
    }
  }

  let proximityScore = 1;
  if (minPosition !== Number.POSITIVE_INFINITY && maxPosition >= 0) {
    const span = maxPosition - minPosition + 1;
    const maxSpan = normalizedCandidate.length;
    if (maxSpan > 0) {
      const ratio = span / maxSpan;
      const clamped = Math.min(Math.max(ratio, 0), 1);
      proximityScore = 1 - clamped;
    }
  }

  let orderScore = 1;
  if (matches.length > 1) {
    let outOfOrder = 0;
    for (let index = 1; index < matches.length; index += 1) {
      if (matches[index].position < matches[index - 1].position) {
        outOfOrder += 1;
      }
    }
    const maxOutOfOrder = matches.length - 1;
    if (maxOutOfOrder > 0) {
      orderScore = 1 - outOfOrder / maxOutOfOrder;
    }
  }

  const coverageScore = coverage;
  const fuzzyScore = fuzzyQuality;
  const normalizedOrder = orderScore;
  const normalizedProximity = proximityScore;

  let score = coverageScore * options.weightCoverage;
  score += fuzzyScore * options.weightFuzzy;
  score += normalizedOrder * options.weightOrder;
  score += normalizedProximity * options.weightProximity;

  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length > 0 && normalizedCandidate.indexOf(normalizedQuery) !== -1) {
    score += options.exactBonus;
  }

  if (score > 1) {
    score = 1;
  }

  if (score < 0) {
    score = 0;
  }

  return {
    score,
    matchedTokens,
    totalTokens,
  };
}
