/**
 * Turns the tutor's replies into something a student can actually read.
 *
 * Language models answer in Markdown and LaTeX whether or not you ask them to,
 * so an explanation arrives looking like `**Conic Sections**` and
 * `$x^2 - 4x + 4 = 0$`. Rendered as plain text that is worse than useless —
 * the notation is the part the student needs most.
 *
 * Rather than pull in a full maths typesetter for what is nearly always a
 * variable or an exponent, the common notation is mapped onto the Unicode
 * characters that already exist for it: x² rather than x^2, √ rather than
 * \sqrt. It costs nothing, cannot fail to load, and reads correctly.
 */

const SUPERSCRIPTS = {
  0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ',
  k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ',
  v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ',
};

// Decorations that sit above a symbol. Unicode has combining marks for these,
// so the letter survives instead of turning into the word "vec".
const DECORATORS = {
  '\\vec': '⃗',
  '\\hat': '̂',
  '\\bar': '̄',
  '\\overline': '̄',
  '\\tilde': '̃',
  '\\dot': '̇',
};

const SUBSCRIPTS = {
  0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', i: 'ᵢ', j: 'ⱼ',
  n: 'ₙ', o: 'ₒ', x: 'ₓ',
};

// Only the commands that actually show up in school and entrance-exam material.
const SYMBOLS = {
  '\\times': '×', '\\cdot': '·', '\\div': '÷', '\\pm': '±', '\\mp': '∓',
  '\\leq': '≤', '\\le': '≤', '\\geq': '≥', '\\ge': '≥', '\\neq': '≠', '\\ne': '≠',
  '\\approx': '≈', '\\equiv': '≡', '\\propto': '∝', '\\infty': '∞',
  '\\rightarrow': '→', '\\to': '→', '\\leftarrow': '←', '\\Rightarrow': '⇒',
  '\\implies': '⇒', '\\iff': '⇔', '\\therefore': '∴', '\\because': '∵',
  '\\sum': '∑', '\\prod': '∏', '\\int': '∫', '\\partial': '∂', '\\nabla': '∇',
  '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\cup': '∪', '\\cap': '∩',
  '\\forall': '∀', '\\exists': '∃', '\\angle': '∠', '\\degree': '°', '\\circ': '°',
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\epsilon': 'ε',
  '\\theta': 'θ', '\\lambda': 'λ', '\\mu': 'μ', '\\pi': 'π', '\\rho': 'ρ',
  '\\sigma': 'σ', '\\tau': 'τ', '\\phi': 'φ', '\\omega': 'ω',
  '\\Delta': 'Δ', '\\Sigma': 'Σ', '\\Omega': 'Ω', '\\Theta': 'Θ', '\\Phi': 'Φ',
  '\\ldots': '…', '\\dots': '…', '\\cdots': '⋯',
};

const mapChars = (text, table) =>
  [...text].every((char) => table[char]) ? [...text].map((char) => table[char]).join('') : null;

/** `^2` and `^{10}` become ² and ¹⁰ where Unicode allows, else stay readable. */
function applyScripts(math) {
  return math
    // The single-character case allows signs and brackets as well as word
    // characters, because an ion is written Na^+ and that is the single most
    // common piece of notation in the material this app is used for.
    .replace(/\^\{([^{}]+)\}|\^([\w+\-=()])/g, (whole, braced, single) => {
      const body = braced ?? single;
      return mapChars(body, SUPERSCRIPTS) ?? `^(${body})`;
    })
    .replace(/_\{([^{}]+)\}|_([\w+\-=()])/g, (whole, braced, single) => {
      const body = braced ?? single;
      return mapChars(body, SUBSCRIPTS) ?? `_(${body})`;
    });
}

/** Converts a LaTeX fragment to plain readable notation. */
export function latexToText(input) {
  let out = input;

  // Fractions and roots first — they wrap other expressions.
  for (let i = 0; i < 3; i += 1) {
    out = out.replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, top, bottom) => `(${top})/(${bottom})`);
    out = out.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, (m, degree, body) => `${degree}√(${body})`);
    out = out.replace(/\\sqrt\s*\{([^{}]*)\}/g, (m, body) => `√(${body})`);
  }

  out = out.replace(/\\(?:left|right|displaystyle|,|;|!|quad|qquad)\s?/g, '');
  out = out.replace(/\\text\s*\{([^{}]*)\}/g, '$1');
  out = out.replace(/\\(?:mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g, '$1');

  for (const [command, mark] of Object.entries(DECORATORS)) {
    const pattern = new RegExp(`\\${command}\\s*\\{([^{}]*)\\}`, 'g');
    out = out.replace(pattern, (m, body) => body + mark);
  }

  for (const [command, symbol] of Object.entries(SYMBOLS)) {
    out = out.split(command).join(symbol);
  }

  out = applyScripts(out);

  // Anything left is a command we do not translate; drop the backslash rather
  // than show it, and tidy the braces the replacements left behind.
  out = out.replace(/\\([a-zA-Z]+)/g, '$1').replace(/[{}]/g, '');

  // Brackets only earn their place around a compound expression: (a+b)/2 needs
  // them, (2) does not.
  out = out.replace(/\(([^()\s+\-*/]+)\)\/\(/g, '$1/(');
  out = out.replace(/\/\(([^()\s+\-*/]+)\)/g, '/$1');

  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Replaces the maths spans in a line, leaving ordinary prose untouched.
 * Handles $...$, $$...$$ and \( ... \) / \[ ... \].
 */
export function stripMath(line) {
  return line
    .replace(/\$\$([\s\S]+?)\$\$/g, (m, body) => latexToText(body))
    .replace(/\\\[([\s\S]+?)\\\]/g, (m, body) => latexToText(body))
    .replace(/\\\(([\s\S]+?)\\\)/g, (m, body) => latexToText(body))
    // Single $ last, and only when it is not a currency amount like $20.
    // The digits have to be followed by a space or the end of a clause to count
    // as money — a digit followed by notation, as in $3\text{Na}^+$, is maths.
    .replace(/\$(?!\d+(?:\.\d+)?(?:[\s,.;:!?)]|$))([^$\n]+?)\$/g, (m, body) => latexToText(body));
}

/**
 * Notation the model writes without wrapping it in maths delimiters at all —
 * `x^2/a^2 + y^2/b^2 = 1`, `sqrt(a^2 + b^2)`. It arrives as ordinary prose, so
 * stripMath never sees it, yet it is exactly as unreadable.
 *
 * The rules here are deliberately narrow. `^` only counts when it is pressed up
 * against what it raises, so the bitwise `a ^ b` in a programming question is
 * left alone, and subscripts are ignored entirely because `snake_case` is far
 * more common in prose than `a_1`.
 */
export function normalizeLooseMath(text) {
  let out = text.replace(/\bsqrt\s*\(/gi, '√(');

  out = out.replace(/([A-Za-z0-9)\]}])\^(\{[^{}]+\}|\([^()]+\)|[A-Za-z0-9]+)/g, (whole, base, raw) => {
    const body = raw.replace(/^[{(]|[})]$/g, '');
    const mapped = mapChars(body, SUPERSCRIPTS);
    return mapped ? base + mapped : whole;
  });

  return out;
}

/**
 * Splits a line into styled runs. Returns objects rather than markup so the
 * component decides how to render, and nothing is injected as raw HTML.
 */
export function parseInline(line) {
  const text = normalizeLooseMath(stripMath(line));
  const runs = [];
  const pattern = /(\*\*\*|\*\*|__|\*|_|`)(.+?)\1/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      runs.push({ text: text.slice(cursor, match.index) });
    }

    const [, marker, body] = match;
    runs.push({
      text: body,
      bold: marker === '**' || marker === '__' || marker === '***',
      italic: marker === '*' || marker === '_' || marker === '***',
      code: marker === '`',
    });

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    runs.push({ text: text.slice(cursor) });
  }

  return runs.length ? runs : [{ text }];
}

/**
 * Groups the reply into paragraphs, list items and headings so the shape of the
 * explanation survives, not just its words.
 */
export function parseBlocks(content) {
  const blocks = [];

  for (const rawLine of String(content ?? '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      blocks.push({ type: 'bullet', runs: parseInline(bullet[1]) });
      continue;
    }

    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      blocks.push({ type: 'numbered', marker: numbered[1], runs: parseInline(numbered[2]) });
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', runs: parseInline(heading[1]) });
      continue;
    }

    blocks.push({ type: 'paragraph', runs: parseInline(line) });
  }

  return blocks;
}
