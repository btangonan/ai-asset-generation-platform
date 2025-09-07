type State = 'closed' | 'open' | 'half';
export function circuitBreaker<T>(fn: () => Promise<T>, opts?: {
  failThreshold?: number; cooldownMs?: number;
}) {
  const failThreshold = opts?.failThreshold ?? 5;
  const cooldownMs = opts?.cooldownMs ?? 10_000;
  let state: State = 'closed';
  let fails = 0, nextTry = 0;

  return async () => {
    const now = Date.now();
    if (state === 'open' && now < nextTry) throw new Error('CIRCUIT_OPEN');
    if (state === 'open' && now >= nextTry) state = 'half';
    try {
      const out = await fn();
      fails = 0; state = 'closed';
      return out;
    } catch (e) {
      fails++; 
      if (fails >= failThreshold) { state = 'open'; nextTry = Date.now() + cooldownMs; }
      throw e;
    }
  };
}