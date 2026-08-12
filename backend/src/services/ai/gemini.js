import { env } from '../../config/env.js';
import { AiError } from './errors.js';
import { getJson, postJson } from './httpClient.js';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 45_000;
const RETRIES = 2;

// Model names change between Gemini releases. Rather than hard-coding one and
// breaking the day it is retired, we verify the configured model on first use
// and fall back to whatever flash-tier model the account can actually see.
let resolvedModel = null;

export const gemini = {
  name: 'gemini',

  isConfigured: () => Boolean(env.GEMINI_API_KEY),

  async generate({ system, messages, temperature = 0.7, maxOutputTokens = 4096, responseSchema }) {
    const model = await resolveModel();

    const generationConfig = { temperature, maxOutputTokens };

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
      provider: 'gemini',
    });

    return readCandidate(response);
  },
};

async function resolveModel() {
  if (resolvedModel) {
    return resolvedModel;
  }

  const preferred = env.GEMINI_MODEL;

  try {
    await getJson(`${API_ROOT}/models/${preferred}`, {
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY },
      timeoutMs: 10_000,
      provider: 'gemini',
    });

    resolvedModel = preferred;
    return resolvedModel;
  } catch (error) {
    if (error.status !== 404 && error.status !== 400) {
      throw error;
    }
  }

  console.warn(`Gemini model "${preferred}" is unavailable. Looking for an alternative.`);
  resolvedModel = await pickAvailableModel();
  console.log(`Using Gemini model "${resolvedModel}".`);

  return resolvedModel;
}

async function pickAvailableModel() {
  const { models = [] } = await getJson(`${API_ROOT}/models?pageSize=200`, {
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY },
    timeoutMs: 10_000,
    provider: 'gemini',
  });

  const usable = models
    .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
    .map((model) => model.name.replace(/^models\//, ''))
    .filter((name) => !name.includes('vision') && !name.includes('embedding'));

  // Flash models are the cheap, fast tier and the reason we picked Gemini.
  const flash = usable.find((name) => name.includes('flash'));
  const chosen = flash ?? usable[0];

  if (!chosen) {
    throw new AiError('This Gemini key has no usable text generation models', {
      provider: 'gemini',
    });
  }

  return chosen;
}

function readCandidate(response) {
  const candidate = response.candidates?.[0];

  if (!candidate) {
    const blocked = response.promptFeedback?.blockReason;

    throw new AiError(
      blocked ? `Gemini blocked the prompt (${blocked})` : 'Gemini returned no candidates',
      { provider: 'gemini' },
    );
  }

  if (candidate.finishReason === 'MAX_TOKENS') {
    throw new AiError('Gemini hit the output limit before finishing', {
      provider: 'gemini',
      retryable: false,
    });
  }

  const text = candidate.content?.parts?.map((part) => part.text ?? '').join('').trim();

  if (!text) {
    throw new AiError(`Gemini returned an empty response (${candidate.finishReason ?? 'no reason'})`, {
      provider: 'gemini',
    });
  }

  return text;
}

// Exposed for tests and for forcing re-resolution after a configuration change.
export function resetModelCache() {
  resolvedModel = null;
}
