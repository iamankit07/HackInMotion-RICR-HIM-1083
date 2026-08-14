/**
 * Finds text you cannot read.
 *
 * Walks every page in both themes, works out each text node's real background
 * by climbing until it hits an opaque one, and reports anything under the WCAG
 * AA contrast ratio. Catches exactly the fault where a colour was picked for
 * one theme and inherited by the other.
 *
 *   node scripts/audit-contrast.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:5000/api';

// WCAG AA: 4.5 for body text, 3.0 once text is large.
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;

const call = async (method, path, body, token) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({}));
};

const AUDIT = ({ aaNormal, aaLarge }) => {
  const parse = (colour) => {
    const parts = colour.match(/[\d.]+/g)?.map(Number) ?? [];
    return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
  };

  const luminance = ({ r, g, b }) => {
    const channel = (value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const ratio = (fg, bg) => {
    const a = luminance(fg);
    const b = luminance(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };

  // Climb until something actually paints a background.
  const backgroundOf = (element) => {
    let node = element;
    while (node && node !== document.documentElement) {
      const colour = parse(getComputedStyle(node).backgroundColor);
      if (colour.a > 0.85) return colour;
      node = node.parentElement;
    }
    return parse(getComputedStyle(document.body).backgroundColor);
  };

  const problems = [];

  for (const element of document.querySelectorAll('body *')) {
    const text = [...element.childNodes]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent.trim())
      .join(' ')
      .trim();

    if (!text) continue;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || style.opacity === '0') continue;

    const fg = parse(style.color);
    // Deliberately faded text is a different judgement from a wrong colour.
    if (fg.a < 0.5) continue;

    const bg = backgroundOf(element);
    const size = parseFloat(style.fontSize);
    const bold = Number(style.fontWeight) >= 700;
    const isLarge = size >= 24 || (size >= 18.66 && bold);
    const required = isLarge ? aaLarge : aaNormal;
    const contrast = ratio(fg, bg);

    if (contrast < required) {
      problems.push({
        text: text.slice(0, 42),
        contrast: Math.round(contrast * 100) / 100,
        required,
        colour: style.color,
        background: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
        selector: `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 36)}`,
      });
    }
  }

  return problems;
};

async function seed() {
  const email = `contrast-${Date.now()}@example.com`;
  const reg = await call('POST', '/auth/register', { name: 'Contrast', email, password: 'TestPass123' });
  const token = reg?.data?.token;

  const goal = await call('POST', '/goals', {
    subject: 'Human Anatomy', examType: 'MBBS first year',
    deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    dailyMinutes: 90, studyDays: [0, 1, 2, 3, 4, 5, 6], confidence: 'beginner',
  }, token);
  const goalId = goal?.data?.goal?.id ?? goal?.data?.id;

  await call('PUT', `/goals/${goalId}/topics`, {
    topics: [
      { title: 'Bones and Skeleton', summary: 'Skeleton', difficulty: 3, weight: 4, estimatedMinutes: 90, prerequisites: [] },
      { title: 'Muscles', summary: 'Muscles', difficulty: 4, weight: 4, estimatedMinutes: 90, prerequisites: [] },
    ],
  }, token);
  await call('POST', `/goals/${goalId}/plan`, {}, token);

  const group = await call('POST', '/groups', { name: 'Anatomy crew', goalId }, token);

  return { email, goalId, groupId: group?.data?.group?.id };
}

async function main() {
  const { email, goalId, groupId } = await seed();
  const browser = await chromium.launch();

  let total = 0;

  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
    const page = await context.newPage();

    console.log(`\n########## ${theme.toUpperCase()} ##########`);

    const audit = async (name) => {
      await page.waitForTimeout(700);
      const problems = await page.evaluate(AUDIT, { aaNormal: AA_NORMAL, aaLarge: AA_LARGE });
      total += problems.length;
      console.log(`${problems.length === 0 ? 'ok   ' : 'FAIL '} ${name.padEnd(12)} ${problems.length} unreadable`);
      for (const problem of problems.slice(0, 6)) {
        console.log(`        "${problem.text}"  ${problem.contrast}:1 (needs ${problem.required})  ${problem.colour} on ${problem.background}`);
        console.log(`          ${problem.selector}`);
      }
    };

    for (const [name, path] of [['landing', '/'], ['sign-in', '/sign-in'], ['sign-up', '/sign-up']]) {
      await page.goto(`${APP}${path}`, { waitUntil: 'networkidle' });
      await audit(name);
    }

    await page.goto(`${APP}/sign-in`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[autocomplete="current-password"]', 'TestPass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/goals**', { timeout: 20000 });

    for (const [name, path] of [
      ['dashboard', '/goals'],
      ['new goal', '/goals/new'],
      ['setup', `/goals/${goalId}/setup`],
      ['plan', `/goals/${goalId}/plan`],
      ['explore', `/goals/${goalId}/explore/bones-and-skeleton`],
      ['tutor', `/goals/${goalId}/tutor`],
      ['groups', '/groups'],
      ['group', `/groups/${groupId}`],
    ]) {
      await page.goto(`${APP}${path}`, { waitUntil: 'networkidle' });
      await audit(name);
    }

    // The quick-doubt panel only exists once opened.
    await page.goto(`${APP}/goals`, { waitUntil: 'networkidle' });
    await page.locator('button[aria-label="Ask a quick doubt"]').click();
    await audit('quick doubt');

    await context.close();
  }

  console.log(`\n${total === 0 ? 'PASS' : `FAIL — ${total}`} contrast problems across both themes`);
  await browser.close();
  process.exit(total === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
