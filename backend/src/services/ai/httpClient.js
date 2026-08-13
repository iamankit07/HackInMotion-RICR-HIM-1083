import { AiError } from './errors.js';

// Statuses worth trying again: rate limits, gateway hiccups, provider overload.
export const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Exponential backoff with jitter, so parallel requests do not all retry in step.
const backoffDelay = (attempt) => 2 ** (attempt - 1) * 600 + Math.random() * 400;

/**
 * `retryOn` lets a provider opt out of retrying a status that retrying cannot
 * fix. Gemini uses this for 429: its free-tier quota is counted per model, so
 * waiting and asking the same model again only burns what is left, while
 * switching model recovers a whole fresh allowance.
 */
export async function postJson(
  url,
  { headers = {}, body, timeoutMs, retries, provider, retryOn = RETRYABLE_STATUSES },
) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      await sleep(backoffDelay(attempt));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.ok) {
        return await response.json();
      }

      lastError = new AiError(`${provider} responded ${response.status} — ${await readError(response)}`, {
        provider,
        status: response.status,
        retryable: retryOn.has(response.status),
      });

      if (!lastError.retryable) {
        break;
      }
    } catch (error) {
      const timedOut = error.name === 'AbortError';

      lastError = new AiError(
        timedOut ? `${provider} did not respond within ${timeoutMs}ms` : `${provider} is unreachable`,
        { provider, retryable: true, cause: error },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

export async function getJson(url, { headers = {}, timeoutMs, provider }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });

    if (!response.ok) {
      throw new AiError(`${provider} responded ${response.status} — ${await readError(response)}`, {
        provider,
        status: response.status,
        retryable: RETRYABLE_STATUSES.has(response.status),
      });
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function readError(response) {
  try {
    const text = await response.text();
    const parsed = JSON.parse(text);
    return parsed?.error?.message ?? text.slice(0, 300);
  } catch {
    return response.statusText || 'no detail given';
  }
}
