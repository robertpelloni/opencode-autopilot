export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isRetryableError(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function fetchWithRetry(
  name: string,
  endpoint: string, 
  options: RequestInit, 
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, options);
      
      if (response.ok) {
        return response;
      }
      
      if (!isRetryableError(response.status) || attempt === retryConfig.maxRetries) {
        return response;
      }
      
      const retryAfter = response.headers.get('retry-after');
      const delayMs = retryAfter 
        ? parseInt(retryAfter, 10) * 1000 
        : Math.min(
            retryConfig.baseDelayMs * Math.pow(2, attempt),
            retryConfig.maxDelayMs
          );
      
      console.log(`[${name}] Retry ${attempt + 1}/${retryConfig.maxRetries} after ${delayMs}ms (status: ${response.status})`);
      await sleep(delayMs);
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === retryConfig.maxRetries) {
        throw lastError;
      }
      
      const delayMs = Math.min(
        retryConfig.baseDelayMs * Math.pow(2, attempt),
        retryConfig.maxDelayMs
      );
      
      console.log(`[${name}] Retry ${attempt + 1}/${retryConfig.maxRetries} after ${delayMs}ms (network error)`);
      await sleep(delayMs);
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}
