// Minimal in-process counters for canary gating and smoke visibility.
export const metrics = {
  requests: 0,
  errors: 0,
  imagesGenerated: 0,
  urlRefreshes: 0,
};

export function inc(key: keyof typeof metrics, n = 1) {
  metrics[key] += n;
}