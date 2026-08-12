const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
const TOKEN_KEY = 'lakshya.token';

let token = localStorage.getItem(TOKEN_KEY);

export function getToken() {
  return token;
}

export function setToken(next) {
  token = next;

  if (next) {
    localStorage.setItem(TOKEN_KEY, next);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Mirrors the shape the API sends back on failure, so a screen can show
 * `error.message` directly and pick field errors out of `error.details`.
 */
export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details ?? [];
  }

  /** Field errors keyed by field name, for putting messages under inputs. */
  get fieldErrors() {
    return Object.fromEntries(this.details.map((detail) => [detail.field, detail.message]));
  }

  get isOffline() {
    return this.status === 0;
  }

  /** The AI provider could not be reached — worth offering a retry. */
  get isAiUnavailable() {
    return this.status === 503;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError('We could not reach the server. Check your connection and try again.', 0);
  }

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // An expired or invalid token means the stored session is useless — drop it
    // so the app falls back to the sign-in screen instead of looping on 401s.
    if (response.status === 401) {
      setToken(null);
    }

    throw new ApiError(
      payload?.error?.message ?? 'Something went wrong. Please try again.',
      response.status,
      payload?.error?.details,
    );
  }

  return payload?.data ?? null;
}

const goalPath = (goalId, suffix = '') => `/goals/${goalId}${suffix}`;

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: (options) => request('/auth/me', options),
  health: () => request('/health'),

  goals: {
    list: () => request('/goals'),
    create: (body) => request('/goals', { method: 'POST', body }),
    get: (goalId) => request(goalPath(goalId)),
    update: (goalId, body) => request(goalPath(goalId), { method: 'PATCH', body }),
    remove: (goalId) => request(goalPath(goalId), { method: 'DELETE' }),

    generateTopics: (goalId) => request(goalPath(goalId, '/topics/generate'), { method: 'POST' }),
    setTopics: (goalId, topics) => request(goalPath(goalId, '/topics'), { method: 'PUT', body: { topics } }),
  },

  plan: {
    get: (goalId) => request(goalPath(goalId, '/plan')),
    create: (goalId) => request(goalPath(goalId, '/plan'), { method: 'POST' }),
    replan: (goalId, reason) => request(goalPath(goalId, '/plan/replan'), { method: 'POST', body: { reason } }),
    versions: (goalId) => request(goalPath(goalId, '/plan/versions')),
    today: (goalId) => request(goalPath(goalId, '/today')),
    updateSession: (goalId, sessionId, status) =>
      request(goalPath(goalId, `/sessions/${sessionId}`), { method: 'PATCH', body: { status } }),
  },

  assessments: {
    list: (goalId) => request(goalPath(goalId, '/assessments')),
    get: (goalId, assessmentId) => request(goalPath(goalId, `/assessments/${assessmentId}`)),
    createDiagnostic: (goalId, questionCount) =>
      request(goalPath(goalId, '/assessments/diagnostic'), { method: 'POST', body: { questionCount } }),
    createMock: (goalId, body) =>
      request(goalPath(goalId, '/assessments/mock'), { method: 'POST', body: body ?? {} }),
    submit: (goalId, assessmentId, answers) =>
      request(goalPath(goalId, `/assessments/${assessmentId}/submit`), {
        method: 'POST',
        body: { answers },
      }),
  },

  tutor: {
    conversations: (goalId) => request(goalPath(goalId, '/conversations')),
    conversation: (goalId, conversationId) =>
      request(goalPath(goalId, `/conversations/${conversationId}`)),
    start: (goalId, body) => request(goalPath(goalId, '/conversations'), { method: 'POST', body }),
    reply: (goalId, conversationId, body) =>
      request(goalPath(goalId, `/conversations/${conversationId}/messages`), { method: 'POST', body }),
    remove: (goalId, conversationId) =>
      request(goalPath(goalId, `/conversations/${conversationId}`), { method: 'DELETE' }),
  },
};
