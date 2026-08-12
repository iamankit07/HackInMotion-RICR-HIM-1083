import { env } from '../../config/env.js';
import { AiError } from './errors.js';
import { postJson } from './httpClient.js';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const TIMEOUT_MS = 30_000;
const RETRIES = 1;

/**
 * Fallback provider. Groq's API is OpenAI-compatible and does not accept a
 * response schema, so when structured output is needed the schema is described
 * in the prompt and the reply is validated on our side like any other JSON.
 */
export const groq = {
  name: 'groq',

  isConfigured: () => Boolean(env.GROQ_API_KEY),

  async generate({ system, messages, temperature = 0.7, maxOutputTokens = 4096, responseSchema }) {
    const chatMessages = [];

    if (system) {
      chatMessages.push({ role: 'system', content: system });
    }

    if (responseSchema) {
      chatMessages.push({
        role: 'system',
        content:
          'Reply with a single JSON object and nothing else. It must match this JSON schema exactly:\n' +
          JSON.stringify(responseSchema),
      });
    }

    chatMessages.push(...messages.map(({ role, content }) => ({ role, content })));

    const response = await postJson(ENDPOINT, {
      headers: { authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: {
        model: env.GROQ_MODEL,
        messages: chatMessages,
        temperature,
        max_tokens: maxOutputTokens,
        ...(responseSchema ? { response_format: { type: 'json_object' } } : {}),
      },
      timeoutMs: TIMEOUT_MS,
      retries: RETRIES,
      provider: 'groq',
    });

    const text = response.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new AiError('Groq returned an empty response', { provider: 'groq' });
    }

    return text;
  },
};
