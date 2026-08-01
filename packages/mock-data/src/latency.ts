/** Simulates real network latency (300-800ms) for every mock service call. */
export function networkDelay<T>(value: T, minMs = 300, maxMs = 800): Promise<T> {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
