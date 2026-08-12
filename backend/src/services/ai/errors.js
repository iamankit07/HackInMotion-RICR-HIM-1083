/**
 * Raised by an AI provider. `retryable` decides whether the caller should back
 * off and try again, or give up and move to the next provider.
 */
export class AiError extends Error {
  constructor(message, { provider, status, retryable = false, cause } = {}) {
    super(message, { cause });
    this.name = 'AiError';
    this.provider = provider;
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Raised when every configured provider has been tried and none of them worked.
 * Callers catch this to fall back to cached or non-AI behaviour rather than
 * failing the whole request.
 */
export class AllProvidersFailedError extends Error {
  constructor(failures) {
    const summary = failures.map((f) => `${f.provider}: ${f.message}`).join('; ');
    super(`No AI provider could handle the request (${summary})`);
    this.name = 'AllProvidersFailedError';
    this.failures = failures;
  }
}
