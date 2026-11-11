/** @param {number} ms */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry only explicitly transient responses, preserving each provider's traffic policy.
 * @param {string} url
 * @param {{ userAgent: string, tries?: number, retryDelay?: (attempt: number, response: Response) => number }} options
 */
export async function getJson(
  url,
  { userAgent, tries = 4, retryDelay = (attempt) => 1500 * attempt },
) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
    });
    if (response.ok) return response.json();
    if (response.status === 404) return null;
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    if (attempt < tries) {
      const delay = retryDelay(attempt, response);
      console.warn(`HTTP ${response.status} for ${url}; retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
  throw new Error(`Gave up after ${tries} attempts: ${url}`);
}
