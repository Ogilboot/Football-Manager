import { getPlayer } from "./data";
import { pickWeighted, samplePoisson, type Rng } from "./rng";
import type { MatchResult, Scorer } from "./types";

export type CaResolver = (playerId: number) => number;

function pickBestXI(squad: number[], caOf: CaResolver): number[] {
  const players = squad.map((id) => ({ id, p: getPlayer(id), ca: caOf(id) }));
  const by = (cat: string, count: number): number[] =>
    players
      .filter((x) => x.p.category === cat)
      .sort((a, b) => b.ca - a.ca)
      .slice(0, count)
      .map((x) => x.id);

  let xi = [...by("GK", 1), ...by("DF", 4), ...by("MF", 3), ...by("FW", 3)];
  if (xi.length < 11) {
    const used = new Set(xi);
    const fill = players
      .filter((x) => !used.has(x.id))
      .sort((a, b) => b.ca - a.ca)
      .map((x) => x.id);
    xi = [...xi, ...fill].slice(0, 11);
  }
  return xi;
}

export function teamStrength(squad: number[], caOf: CaResolver): number {
  if (!squad.length) return 55;
  const xi = pickBestXI(squad, caOf);
  const sum = xi.reduce((s, id) => s + caOf(id), 0);
  return sum / xi.length;
}

function pickScorers(squad: number[], goals: number, rng: Rng): Scorer[] {
  if (goals <= 0) return [];
  const outfield = squad.filter((id) => getPlayer(id).category !== "GK");
  if (!outfield.length) return [];
  const scorers: Scorer[] = [];
  for (let g = 0; g < goals; g++) {
    const id = pickWeighted(
      outfield,
      (pid) => {
        const p = getPlayer(pid);
        const posBoost = p.category === "FW" ? 25 : p.category === "MF" ? 12 : p.category === "DF" ? 4 : 1;
        return p.attrs.finishing + posBoost;
      },
      rng,
    );
    scorers.push({ playerId: id, minute: 1 + Math.floor(rng() * 90) });
  }
  return scorers.sort((a, b) => a.minute - b.minute);
}

export function simulateMatch(
  homeId: number,
  awayId: number,
  homeSquad: number[],
  awaySquad: number[],
  caOf: CaResolver,
  rng: Rng = Math.random,
): MatchResult {
  const homeStr = teamStrength(homeSquad, caOf);
  const awayStr = teamStrength(awaySquad, caOf);
  const diff = (homeStr - awayStr) / 10;

  const homeXg = Math.max(0.1, 1.35 + 0.4 * diff);
  const awayXg = Math.max(0.1, 1.05 - 0.4 * diff);

  const homeGoals = Math.min(9, samplePoisson(homeXg, rng));
  const awayGoals = Math.min(9, samplePoisson(awayXg, rng));

  return {
    homeId,
    awayId,
    homeGoals,
    awayGoals,
    homeScorers: pickScorers(homeSquad, homeGoals, rng),
    awayScorers: pickScorers(awaySquad, awayGoals, rng),
  };
}
