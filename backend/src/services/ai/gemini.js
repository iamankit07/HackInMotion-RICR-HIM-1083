import { env } from '../../config/env.js';
import { AiError } from './errors.js';
import { RETRYABLE_STATUSES, getJson, postJson } from './httpClient.js';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 45_000;
const RETRIES = 2;

// How many alternatives to try before giving up and letting the fallback
// provider take over.
const MAX_MODEL_ATTEMPTS = 5;

/**
 * Everything the shared client retries, except 429.
 *
 * The free tier allows a fixed number of requests per day *per model*, so a 429
 * means this model is finished for today — waiting will not bring it back, and
 * every retry spends part of whatever allowance is left. Switching model is the
 * only thing that recovers capacity, so a 429 is handed straight to the model
 * fallback instead of being retried.
 */
const GEMINI_RETRY_STATUSES = new Set([...RETRYABLE_STATUSES].filter((status) => status !== 429));

// Models that exist but cannot answer a text prompt: image, speech, embedding,
// music and the specialised agent models.
const NOT_TEXT_MODELS =
  /(image|tts|audio|embedding|vision|robotics|computer-use|nano-banana|lyria|antigravity|deep-research)/;

/**
 * The model that answered last. Google retires models on its own schedule — a
 * name that worked last month can start returning 404 with "no longer available
 * to new users" — so the working model is discovered at runtime and remembered,
 * rather than being a constant we have to chase.
 */
let workingModel = null;

/**
 * Newer Gemini models reason internally before answering, and those thinking
 * tokens are billed against maxOutputTokens — so a generous-looking budget can
 * be swallowed entirely by thinking, leaving an empty answer. Asking for the
 * shallowest thinking keeps replies fast and leaves room for the actual output.
 *
 * Not every model accepts the option, so support is learned on first use and
 * the request is retried without it rather than failing.
 */
let supportsThinkingLevel = null;

export const gemini = {
  name: 'gemini',

  isConfigured: () => Boolean(env.GEMINI_API_KEY),

  async generate(request) {
    const preferred = workingModel ?? env.GEMINI_MODEL;

    try {
      const answer = await callModel(preferred, request);
      workingModel = preferred;
      return answer;
    } catch (error) {
      if (!shouldTryAnotherModel(error)) {
        throw error;
      }

      console.warn(`Gemini model "${preferred}" ${describe(error)}. Trying another model.`);
      return generateWithFirstWorkingModel(request, preferred);
    }
  },
};

async function callModel(model, request) {
  if (supportsThinkingLevel === false) {
    return send(model, request, false);
  }

  try {
    const answer = await send(model, request, true);
    supportsThinkingLevel = true;
    return answer;
  } catch (error) {
    if (supportsThinkingLevel !== null || !isUnsupportedOption(error)) {
      throw error;
    }

    supportsThinkingLevel = false;
    console.warn('Gemini does not accept a thinking level on this model. Continuing without it.');

    return send(model, request, false);
  }
}

async function send(
  model,
  { system, messages, temperature = 0.7, maxOutputTokens = 8192, responseSchema },
  withThinkingLevel,
) {
  const generationConfig = { temperature, maxOutputTokens };

  if (withThinkingLevel) {
    generationConfig.thinkingConfig = { thinkingLevel: 'low' };
  }

  if (responseSchema) {
    // Gemini validates the shape server-side, so we get parseable JSON back
    // instead of prose wrapped in code fences.
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = responseSchema;
  }

  const payload = {
    contents: messages.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    })),
    generationConfig,
  };

  if (system) {
    payload.systemInstruction = { parts: [{ text: system }] };
  }

  const response = await postJson(`${API_ROOT}/models/${model}:generateContent`, {
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY },
    body: payload,
    timeoutMs: TIMEOUT_MS,
    retries: RETRIES,
    retryOn: GEMINI_RETRY_STATUSES,
    provider: 'gemini',
  });

  return readCandidate(response);
}

const isUnsupportedOption = (error) =>
  error?.status === 400 && /invalid argument|unknown name|not supported/i.test(error.message);

/**
 * Walks the account's actual model list, best candidate first, and sends the
 * real request to each until one answers. Listing alone is not enough to decide
 * — retired models are still listed, and only refuse once you call them — so
 * the request itself is the test. A success costs nothing extra.
 */
async function generateWithFirstWorkingModel(request, alreadyTried) {
  const candidates = (await listTextModels()).filter((model) => model !== alreadyTried);

  if (candidates.length === 0) {
    throw new AiError('This Gemini key has no usable text model', { provider: 'gemini' });
  }

  let lastError;

  for (const model of candidates.slice(0, MAX_MODEL_ATTEMPTS)) {
    try {
      const answer = await callModel(model, request);

      workingModel = model;
      console.log(`Gemini is now using "${model}".`);

      return answer;
    } catch (error) {
      if (!isModelUnavailable(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError ?? new AiError('No Gemini model accepted the request', { provider: 'gemini' });
}

async function listTextModels() {
  const { models = [] } = await getJson(`${API_ROOT}/models?pageSize=200`, {
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY },
    timeoutMs: 10_000,
    provider: 'gemini',
  });

  return models
    .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
    .map((model) => model.name.replace(/^models\//, ''))
    .filter((name) => !NOT_TEXT_MODELS.test(name))
    .sort(byPreference);
}

/**
 * Prefer the aliases Google maintains ("...-latest"), then flash models over
 * pro ones because they are the cheap tier this project is built around, then
 * the highest version number available.
 */
function byPreference(a, b) {
  const score = (name) =>
    (name.endsWith('-latest') ? 100 : 0) +
    (name.includes('flash') ? 50 : 0) +
    (name.includes('preview') ? -10 : 0) +
    versionOf(name);

  return score(b) - score(a);
}

function versionOf(name) {
  const match = name.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

/**
 * Whether a different model could succeed where this one did not.
 *
 *   404  the model has been retired for this account
 *   429  its daily free-tier allowance is spent, and the allowance is per model
 *   400  the model rejected the shape of the request
 *
 * Everything else — a timeout, an outage, a malformed prompt — would fail the
 * same way on any model, so it is raised and the fallback provider takes over.
 */
function shouldTryAnotherModel(error) {
  if (error?.provider !== 'gemini') {
    return false;
  }

  if (error.status === 404 || error.status === 429) {
    return true;
  }

  return error.status === 400 && /model|not found|not supported/i.test(error.message);
}

const describe = (error) =>
  error.status === 429 ? 'has used its daily quota' : 'is not available to this key';

function readCandidate(response) {
  const candidate = response.candidates?.[0];

  if (!candidate) {
    const blocked = response.promptFeedback?.blockReason;

    throw new AiError(
      blocked ? `Gemini blocked the prompt (${blocked})` : 'Gemini returned no candidates',
      { provider: 'gemini' },
    );
  }

  const text = candidate.content?.parts?.map((part) => part.text ?? '').join('').trim();

  // A truncated explanation is still worth reading, so partial text is returned
  // rather than thrown away. Truncated JSON fails to parse a moment later and
  // the fallback provider picks it up, which is the behaviour we want there.
  if (text) {
    return text;
  }

  if (candidate.finishReason === 'MAX_TOKENS') {
    throw new AiError(
      'Gemini used its whole token budget thinking and produced no answer',
      { provider: 'gemini' },
    );
  }

  throw new AiError(`Gemini returned an empty response (${candidate.finishReason ?? 'no reason'})`, {
    provider: 'gemini',
  });
}

/** Forces the next request to rediscover a model. Used by tests. */
export function resetModelCache() {
  workingModel = null;
}
