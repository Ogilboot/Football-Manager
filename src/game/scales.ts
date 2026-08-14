export const MAX_ATTR = 20;
export const MAX_CA = 200;
export const MAX_PA = 200;
export const MAX_CONDITION = 100;
export const MAX_SHARPNESS = 100;
export const MAX_MORALE = 20;
export const MAX_RATING = 10;

export function toFmAttr(attr: number): number {
  return Math.max(1, Math.min(MAX_ATTR, Math.round(attr / 5)));
}

export function toFmAbility(n: number): number {
  return Math.max(1, Math.min(MAX_CA, Math.round(n * 2)));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
