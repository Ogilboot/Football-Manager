import { hashString, mulberry32, sampleNormal } from "./rng";
import { MAX_ATTR } from "./scales";
import type { Personality } from "./types";

function roll(center: number, spread: number, rng: () => number): number {
  const v = Math.round(center + sampleNormal(rng) * spread);
  return Math.max(1, Math.min(MAX_ATTR, v));
}

export function generatePersonality(playerId: number, name: string): Personality {
  const rng = mulberry32(hashString(`${playerId}:${name}`));
  return {
    consistency: roll(11, 4, rng),
    ambition: roll(10, 5, rng),
    professionalism: roll(12, 4, rng),
    determination: roll(11, 4, rng),
    pressure: roll(11, 4, rng),
    bigMatches: roll(11, 4, rng),
    injuryProneness: roll(12, 4, rng),
    adaptability: roll(10, 5, rng),
  };
}
