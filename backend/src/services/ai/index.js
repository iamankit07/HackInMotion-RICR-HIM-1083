import { AllProvidersFailedError } from './errors.js';
import { gemini } from './gemini.js';
import { groq } from './groq.js';

// Order matters: the first configured provider is tried first, the rest are
// fallbacks. Gemini leads because it enforces response schemas server-side.
const PROVIDERS = [gemini, groq];

const activeProviders = () => PROVIDERS.filter((provider) => provider.isConfigured());

export function getAiStatus() {
  const configured = activeProviders().map((provider) => provider.name);

  return {
    available: configured.length > 0,
    providers: configured,
    primary: configured[0] ?? null,
  };
}

/**
 * Free-form generation, used by the tutor chat.
 */
export function generateText({ system, prompt, messages, temperature = 0.7, maxOutputTokens }) {
  return dispatch(
    { system, messages: toMessages(prompt, messages), temperature, maxOutputTokens },
    (text) => text,
  );
}

/**
 * Structured generation. `responseSchema` is handed to the provider so it can
 * constrain the output, and `schema` (zod) validates what actually came back —
 * a model that ignores the shape is treated as a provider failure and the next
 * provider gets a turn.
 */
export function generateJson({
  system,
  prompt,
  messages,
  schema,
  responseSchema,
  temperature = 0.4,
  maxOutputTokens,
}) {
  return dispatch(
    { system, messages: toMessages(prompt, messages), temperature, maxOutputTokens, responseSchema },
    (text) => {
      const parsed = JSON.parse(extractJson(text));
      return schema ? schema.parse(parsed) : parsed;
    },
  );
}

async function dispatch(request, transform) {
  const providers = activeProviders();

  if (providers.length === 0) {
    throw new AllProvidersFailedError([
      { provider: 'none', message: 'no AI provider is configured — set GEMINI_API_KEY' },
    ]);
  }

  const failures = [];

  for (const provider of providers) {
    try {
      return transform(await provider.generate(request));
    } catch (error) {
      failures.push({ provider: provider.name, message: error.message });
      console.warn(`AI provider "${provider.name}" failed: ${error.message}`);
    }
  }

  throw new AllProvidersFailedError(failures);
}

function toMessages(prompt, messages) {
  if (messages?.length) {
    return messages;
  }

  if (!prompt) {
    throw new Error('generate() needs either a prompt or a messages array');
  }

  return [{ role: 'user', content: prompt }];
}

/**
 * Models occasionally wrap JSON in a code fence or add a sentence before it.
 * Rather than failing the request over formatting, pull out the object itself.
 */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = (fenced ? fenced[1] : text).trim();

  if (candidate.startsWith('{') || candidate.startsWith('[')) {
    return candidate;
  }

  const firstBrace = candidate.search(/[[{]/);
  const lastBrace = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));

  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('the response did not contain any JSON');
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}
