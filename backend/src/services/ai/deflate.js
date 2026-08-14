/**
 * Strips the handful of tells that give away machine-written prose.
 *
 * The prompts already ask the model to avoid these, and it mostly does. Mostly
 * is not good enough for text a student reads on screen, so the same rules run
 * over the output as well. A prompt is a request; this is the guarantee.
 *
 * Deliberately narrow. It only touches wording that is safe to swap in any
 * sentence, and it leaves the model's structure, facts and formatting alone.
 */

// Ordered longest first so "is crucial for" wins before plain "crucial".
const SUBSTITUTIONS = [
  [/\bis crucial for\b/gi, 'matters for'],
  [/\bis essential for\b/gi, 'is needed for'],
  [/\bis vital for\b/gi, 'matters for'],
  [/\bplays a crucial role in\b/gi, 'is central to'],
  [/\bplays a vital role in\b/gi, 'is central to'],
  [/\bplays a key role in\b/gi, 'is central to'],

  [/\bcrucial\b/gi, 'important'],
  [/\bessential\b/gi, 'important'],
  [/\bvital\b/gi, 'important'],
  [/\bfundamental\b/gi, 'basic'],
  [/\bcomprehensive\b/gi, 'complete'],
  [/\brobust\b/gi, 'reliable'],
  [/\bseamless(ly)?\b/gi, 'smooth$1'],
  [/\bdelve into\b/gi, 'look at'],
  [/\bdelves into\b/gi, 'looks at'],
  [/\bdelving into\b/gi, 'looking at'],
  [/\bdelve\b/gi, 'look'],
  [/\bleverage(s|d)?\b/gi, 'use$1'],
  [/\butilise(s|d)?\b/gi, 'use$1'],
  [/\butilize(s|d)?\b/gi, 'use$1'],
];

/**
 * An em dash between two clauses is the strongest tell of the lot. A full stop
 * would need the next word capitalised and that is not always right, so it
 * becomes a comma, which fits every case.
 *
 * Ranges are left alone: "pages 10—12" and "the 1990—91 season" are not prose.
 */
function replaceClauseDashes(text) {
  return text
    .replace(/\s+—\s+/g, ', ')
    .replace(/(?<=[a-z])—(?=[a-z])/gi, ', ');
}

/** Collapses the damage the substitutions can leave behind. */
function tidy(text) {
  return text
    .replace(/,\s*,/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/,\s*([.!?;:])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .replace(/[ \t]+$/gm, '');
}

/**
 * A slug, an identifier or a URL — anything the rest of the system matches on
 * rather than reads. Topic keys are looked up by exact string, so rewriting a
 * word inside one would orphan every prerequisite pointing at it.
 */
function isIdentifier(text) {
  return (
    /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(text) ||
    /^https?:\/\//.test(text) ||
    !/\s/.test(text.trim())
  );
}

/**
 * Keeps the original casing so a substitution at the start of a sentence does
 * not end up lowercase.
 */
function applyCase(replacement, original) {
  if (original === original.toUpperCase() && original.length > 1) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function deflate(text) {
  if (typeof text !== 'string' || text.length === 0) return text;

  // Prose only. A key or a URL is matched elsewhere by exact value.
  if (isIdentifier(text)) return text;

  let out = replaceClauseDashes(text);

  for (const [pattern, replacement] of SUBSTITUTIONS) {
    out = out.replace(pattern, (match, ...groups) => {
      // $1 in a replacement refers to the first capture group, if there is one.
      const filled = replacement.replace(/\$1/g, groups[0] ?? '');
      return applyCase(filled, match);
    });
  }

  return tidy(out);
}

/** Runs deflate over every string in a parsed AI response, at any depth. */
export function deflateDeep(value) {
  if (typeof value === 'string') return deflate(value);
  if (Array.isArray(value)) return value.map(deflateDeep);

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, deflateDeep(inner)]));
  }

  return value;
}
