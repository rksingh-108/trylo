export const duration = {
  instant: 0.1,
  fast: 0.18,
  base: 0.28,
  slow: 0.45,
  route: 0.8,
} as const;

export const easing = {
  standard: [0.4, 0, 0.2, 1],
  decelerate: [0, 0, 0.2, 1],
  accelerate: [0.4, 0, 1, 1],
  spring: [0.34, 1.56, 0.64, 1],
} as const;

export const motion = { duration, easing } as const;
