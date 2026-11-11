// generateSW serializes these callbacks: keep them self-contained (no closed-over helpers).
export const conditionalDatasetRequests = {
  requestWillFetch: async ({ request }) => {
    const cacheName = new URL(request.url).pathname.endsWith("/manifest.json")
      ? "pm-data-manifest"
      : "pm-datasets";
    const cached = await caches.match(request, { cacheName });
    const etag = cached?.headers.get("ETag");
    if (!etag) return request;
    const headers = new Headers(request.headers);
    headers.set("If-None-Match", etag);
    return new Request(request, { headers });
  },
  fetchDidSucceed: async ({ request, response }) => {
    if (response.status !== 304) return response;
    const cacheName = new URL(request.url).pathname.endsWith("/manifest.json")
      ? "pm-data-manifest"
      : "pm-datasets";
    const cached = await caches.match(request, { cacheName });
    if (!cached) throw new Error("Dataset revalidation returned 304 without a cached body");
    return cached;
  },
};
