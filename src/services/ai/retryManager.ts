import { DEFAULT_MAX_RETRIES } from "./constants.js";

export class RetryManager {
  constructor(private readonly maxRetries = DEFAULT_MAX_RETRIES) {}

  async run<T>(work: (attempt: number) => Promise<T>, shouldRetry: (error: unknown) => boolean) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await work(attempt);
      } catch (error) {
        lastError = error;
        if (attempt >= this.maxRetries || !shouldRetry(error)) {
          throw error;
        }
      }
    }
    throw lastError;
  }
}

export const retryManager = new RetryManager();